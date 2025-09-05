import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { NotificationTemplate, Appointment } from '../types';

export function useNotifications() {
  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('notification_templates')
        .select('*')
        .order('type', { ascending: true });

      if (error) throw error;
      setTemplates(data || []);
    } catch (err) {
      console.error('Erro ao buscar templates:', err);
      setError(err instanceof Error ? err.message : 'Falha ao buscar templates');
    } finally {
      setLoading(false);
    }
  };

  const updateTemplate = async (id: string, updates: Partial<NotificationTemplate>) => {
    try {
      const { error } = await supabase
        .from('notification_templates')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      
      await fetchTemplates();
      return true;
    } catch (err) {
      console.error('Erro ao atualizar template:', err);
      setError(err instanceof Error ? err.message : 'Falha ao atualizar template');
      return false;
    }
  };

  // Sistema robusto de agendamento de notificações
  const scheduleNotificationSafe = async (
    appointmentId: string,
    templateType: string,
    recipientPhone: string,
    recipientName: string,
    scheduledFor: string,
    variables: Record<string, string>,
    retryCount: number = 0
  ): Promise<boolean> => {
    const maxRetries = 3;
    
    try {
      console.log(`📝 Agendando notificação: ${templateType} para ${recipientName}`);
      
      // Validação de entrada
      if (!appointmentId || !templateType || !recipientPhone || !recipientName) {
        console.error('❌ Dados obrigatórios faltando para notificação');
        return false;
      }

      // Verificar se já existe notificação idêntica pendente
      const { data: existingNotification } = await supabase
        .from('notification_queue')
        .select('id')
        .eq('appointment_id', appointmentId)
        .eq('template_type', templateType)
        .eq('status', 'pending')
        .maybeSingle();

      if (existingNotification) {
        console.log(`⚠️ Notificação ${templateType} já existe na fila, pulando duplicata`);
        return true;
      }

      // Buscar template com retry
      let template = templates.find(t => t.type === templateType && t.is_active);
      if (!template) {
        // Tentar buscar diretamente do banco se não estiver no cache
        const { data: dbTemplate, error } = await supabase
          .from('notification_templates')
          .select('*')
          .eq('type', templateType)
          .eq('is_active', true)
          .single();
          
        if (error || !dbTemplate) {
          console.error(`❌ Template ${templateType} não encontrado:`, error);
          return false;
        }
        
        // Adicionar ao cache local
        setTemplates(prev => [...prev, dbTemplate]);
        template = dbTemplate;
      }

      // Processar variáveis do template
      let message = template.message_template;
      Object.entries(variables).forEach(([key, value]) => {
        message = message.replace(new RegExp(`{{${key}}}`, 'g'), value);
      });

      // Validar se a mensagem foi processada corretamente
      if (message.includes('{{') && message.includes('}}')) {
        console.warn('⚠️ Variáveis não substituídas na mensagem:', message);
      }

      // Inserir na fila com retry automático
      const { error } = await supabase
        .from('notification_queue')
        .insert({
          appointment_id: appointmentId,
          template_type: templateType,
          recipient_phone: recipientPhone,
          recipient_name: recipientName,
          message,
          scheduled_for: scheduledFor
        });

      if (error) {
        console.error('❌ Erro ao inserir na fila:', error);
        
        // Retry logic
        if (retryCount < maxRetries) {
          console.log(`🔄 Tentativa ${retryCount + 1}/${maxRetries} em 2 segundos...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
          return await scheduleNotificationSafe(
            appointmentId, templateType, recipientPhone, 
            recipientName, scheduledFor, variables, retryCount + 1
          );
        }
        
        return false;
      }
      
      console.log('✅ Notificação agendada com sucesso na fila');
      return true;
    } catch (err) {
      console.error('❌ Erro crítico ao agendar notificação:', err);
      
      // Retry em caso de erro crítico
      if (retryCount < maxRetries) {
        console.log(`🔄 Retry crítico ${retryCount + 1}/${maxRetries}...`);
        await new Promise(resolve => setTimeout(resolve, 3000));
        return await scheduleNotificationSafe(
          appointmentId, templateType, recipientPhone, 
          recipientName, scheduledFor, variables, retryCount + 1
        );
      }
      
      return false;
    }
  };

  // Função para agendar todas as notificações de um agendamento
  const scheduleAllAppointmentNotifications = async (appointment: Appointment): Promise<boolean> => {
    try {
      console.log('📋 Agendando todas as notificações para:', appointment.client?.name);
      
      // Buscar configurações
      const { data: settings } = await supabase
        .from('settings')
        .select('delivery_days, studio_address, studio_maps_url, price_commercial_hour')
        .single();

      if (!settings) {
        console.error('❌ Configurações não encontradas');
        return false;
      }
      const appointmentDate = new Date(appointment.scheduled_date);
      const clientName = appointment.client?.name || 'Cliente';
      const clientPhone = appointment.client?.phone || '';

      // Buscar tipo de sessão
      const { data: sessionType } = await supabase
        .from('session_types')
        .select('*')
        .eq('name', appointment.session_type)
        .single();

      // Formatação de moeda
      const formatCurrency = (amount: number): string => {
        return new Intl.NumberFormat('pt-BR', {
          style: 'currency',
          currency: 'BRL'
        }).format(amount);
      };
      // Variáveis comuns para todos os templates
      const variables = {
        client_name: clientName,
        amount: formatCurrency(appointment.total_amount),
        session_type: sessionType?.label || appointment.session_type,
        appointment_date: appointmentDate.toLocaleDateString('pt-BR', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        }),
        appointment_time: appointmentDate.toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit'
        }),
        studio_address: settings.studio_address || '',
        studio_maps_url: settings.studio_maps_url || '',
        delivery_days: (settings?.delivery_days || 7).toString(),
        price_per_photo: formatCurrency(settings.price_commercial_hour || 30),
        minimum_photos: (appointment.minimum_photos || 5).toString()
      };
      
      // Agendar lembrete 1 dia antes
      const oneDayBefore = new Date(appointmentDate.getTime() - 24 * 60 * 60 * 1000);
      if (oneDayBefore > new Date()) {
        const result1 = await scheduleNotificationSafe(
          appointment.id,
          'reminder_1_day_before',
          clientPhone,
          clientName,
          oneDayBefore.toISOString(),
          variables
        );
        results.push(result1);
      }
      // Agendar lembrete 2 horas antes
      const twoHoursBefore = new Date(appointmentDate.getTime() - 2 * 60 * 60 * 1000);
      if (twoHoursBefore > new Date()) {
        const result2 = await scheduleNotificationSafe(
          appointment.id,
          'reminder_day_of_session',
          clientPhone,
          clientName,
          twoHoursBefore.toISOString(),
          variables
        );
        results.push(result2);
      }
      const successCount = results.filter(r => r).length;
      console.log(`✅ ${successCount}/${results.length} notificações agendadas com sucesso`);
      
      return successCount > 0; // Sucesso se pelo menos uma foi agendada
    } catch (error) {
      console.error('❌ Erro ao agendar notificações do agendamento:', error);
      return false;
    }
  };
  // Função para processar fila manualmente (fallback)
  const processNotificationQueue = async (): Promise<boolean> => {
    try {
      console.log('🔄 Processando fila de notificações manualmente...');
      
      // Verificar se já está processando
      const processingKey = 'queue_processing';
      const isProcessing = sessionStorage.getItem(processingKey);
      
      if (isProcessing) {
        console.log('⚠️ Fila já está sendo processada, ignorando');
        return true;
      }
      
      sessionStorage.setItem(processingKey, 'true');
      
      try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-scheduled-notifications`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('✅ Fila processada:', result);
        return true;
      } else {
        console.error('❌ Erro ao processar fila:', response.status);
        return false;
      }
      } finally {
        sessionStorage.removeItem(processingKey);
      }
    } catch (error) {
      console.error('❌ Erro crítico ao processar fila:', error);
      return false;
    }
  };
  return {
    templates,
    loading,
    error,
    updateTemplate,
    scheduleNotificationSafe,
    scheduleAllAppointmentNotifications,
    processNotificationQueue,
    refetch: fetchTemplates
  };
}