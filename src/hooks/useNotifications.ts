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
        .from('triagem_notification_templates')
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
        .from('triagem_notification_templates')
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

  /**
   * Verifica se já existe uma notificação idêntica na fila
   */
  const checkDuplicateNotification = async (
    appointmentId: string,
    templateType: string
  ): Promise<boolean> => {
    try {
      // Buscar notificações duplicadas (pendentes OU enviadas nos últimos 5 minutos)
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

      const { data, error } = await supabase
        .from('triagem_notification_queue')
        .select('id, status, sent_at, created_at')
        .eq('appointment_id', appointmentId)
        .eq('template_type', templateType)
        .or(`status.eq.pending,and(status.eq.sent,sent_at.gte.${fiveMinutesAgo})`)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') { // Ignorar erro "multiple rows"
        console.error('Erro ao verificar duplicatas:', error);
        return false;
      }

      if (data) {
        console.log(`⚠️ Notificação ${templateType} já existe: status=${data.status}, created=${data.created_at}`);
        return true;
      }

      return false;
    } catch (err) {
      console.error('Erro ao verificar duplicatas:', err);
      return false;
    }
  };

  /**
   * Busca e processa um template de notificação
   */
  const processTemplate = async (
    templateType: string,
    variables: Record<string, string>
  ): Promise<string | null> => {
    try {
      // Buscar template
      const { data: template, error } = await supabase
        .from('triagem_notification_templates')
        .select('message_template')
        .eq('type', templateType)
        .eq('is_active', true)
        .maybeSingle();

      if (error || !template) {
        console.error(`❌ Template ${templateType} não encontrado:`, error);
        return null;
      }

      // Processar variáveis
      let message = template.message_template;
      Object.entries(variables).forEach(([key, value]) => {
        message = message.replace(new RegExp(`{{${key}}}`, 'g'), value || '');
      });

      // Validar se todas as variáveis foram substituídas
      if (message.includes('{{') && message.includes('}}')) {
        console.warn('⚠️ Variáveis não substituídas encontradas:', message.match(/{{[^}]+}}/g));
      }

      return message;
    } catch (err) {
      console.error('Erro ao processar template:', err);
      return null;
    }
  };

  /**
   * Agenda uma notificação na fila (com proteção contra duplicatas)
   */
  const scheduleNotificationSafe = async (
    appointmentId: string,
    templateType: string,
    recipientPhone: string,
    recipientName: string,
    scheduledFor: string,
    variables: Record<string, string>
  ): Promise<boolean> => {
    try {
      console.log(`📝 Agendando notificação: ${templateType} para ${recipientName} (${scheduledFor})`);

      // Validação de entrada
      if (!appointmentId || !templateType || !recipientPhone || !recipientName) {
        console.error('❌ Dados obrigatórios faltando');
        return false;
      }

      // IMPORTANTE: Verificar duplicatas ANTES de processar template
      const isDuplicate = await checkDuplicateNotification(appointmentId, templateType);
      if (isDuplicate) {
        console.log(`⏭️ Pulando notificação duplicada: ${templateType}`);
        return true; // Retorna sucesso pois já existe
      }

      // Processar template
      const message = await processTemplate(templateType, variables);
      if (!message) {
        console.error(`❌ Falha ao processar template: ${templateType}`);
        return false;
      }

      // Inserir na fila
      const { error } = await supabase
        .from('triagem_notification_queue')
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
        return false;
      }

      console.log(`✅ Notificação ${templateType} agendada com sucesso`);
      return true;
    } catch (err) {
      console.error('❌ Erro crítico ao agendar notificação:', err);
      return false;
    }
  };

  /**
   * Agenda todas as notificações de um agendamento (lembretes)
   */
  const scheduleAllAppointmentNotifications = async (appointment: Appointment): Promise<boolean> => {
    try {
      console.log('📋 Agendando lembretes para:', appointment.client?.name);

      const { data: settings } = await supabase
        .from('triagem_settings')
        .select('*')
        .single();

      if (!settings) {
        console.error('❌ Configurações não encontradas');
        return false;
      }

      const appointmentDate = new Date(appointment.scheduled_date);
      const clientName = appointment.client?.name || 'Cliente';
      const clientPhone = appointment.client?.phone || '';

      const { data: sessionType } = await supabase
        .from('triagem_session_types')
        .select('*')
        .eq('name', appointment.session_type)
        .maybeSingle();

      const formatCurrency = (amount: number): string => {
        return new Intl.NumberFormat('pt-BR', {
          style: 'currency',
          currency: 'BRL'
        }).format(amount);
      };

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
        delivery_days: (settings.delivery_days || 7).toString(),
        price_per_photo: formatCurrency(settings.price_commercial_hour || 30),
        minimum_photos: (appointment.minimum_photos || 5).toString(),
        studio_name: settings.studio_name || '',
        studio_phone: settings.studio_phone || ''
      };

      const results: boolean[] = [];

      // Lembrete 1 dia antes
      const oneDayBefore = new Date(appointmentDate.getTime() - 24 * 60 * 60 * 1000);
      if (oneDayBefore > new Date()) {
        results.push(
          await scheduleNotificationSafe(
            appointment.id,
            'reminder_1_day_before',
            clientPhone,
            clientName,
            oneDayBefore.toISOString(),
            variables
          )
        );
      }

      // Lembrete 2 horas antes
      const twoHoursBefore = new Date(appointmentDate.getTime() - 2 * 60 * 60 * 1000);
      if (twoHoursBefore > new Date()) {
        results.push(
          await scheduleNotificationSafe(
            appointment.id,
            'reminder_day_of_session',
            clientPhone,
            clientName,
            twoHoursBefore.toISOString(),
            variables
          )
        );
      }

      const successCount = results.filter(r => r).length;
      console.log(`✅ ${successCount}/${results.length} lembretes agendados`);

      return successCount > 0;
    } catch (error) {
      console.error('❌ Erro ao agendar lembretes:', error);
      return false;
    }
  };

  /**
   * Agenda notificações de galeria (gallery_ready + selection_reminder)
   */
  const scheduleGalleryNotifications = async (
    appointmentId: string,
    galleryLink: string
  ): Promise<boolean> => {
    try {
      console.log('📸 Agendando notificações de galeria');

      const { data: appointment } = await supabase
        .from('triagem_appointments')
        .select('*, client:triagem_clients(*)')
        .eq('id', appointmentId)
        .single();

      if (!appointment) {
        console.error('❌ Appointment não encontrado');
        return false;
      }

      const { data: settings } = await supabase
        .from('triagem_settings')
        .select('delivery_days')
        .eq('tenant_id', appointment.tenant_id)
        .maybeSingle();

      const clientName = appointment.client?.name || 'Cliente';
      const clientPhone = appointment.client?.phone || '';

      const variables = {
        client_name: clientName,
        gallery_link: galleryLink,
        delivery_days: (settings?.delivery_days || 7).toString()
      };

      // Notificação imediata de galeria pronta
      const galleryReady = await scheduleNotificationSafe(
        appointmentId,
        'gallery_ready',
        clientPhone,
        clientName,
        new Date().toISOString(),
        variables
      );

      // Lembrete de seleção (6 dias depois)
      const selectionReminderDate = new Date();
      selectionReminderDate.setDate(selectionReminderDate.getDate() + 6);

      const selectionReminder = await scheduleNotificationSafe(
        appointmentId,
        'selection_reminder',
        clientPhone,
        clientName,
        selectionReminderDate.toISOString(),
        variables
      );

      console.log(`✅ Galeria: ready=${galleryReady}, reminder=${selectionReminder}`);
      return galleryReady && selectionReminder;
    } catch (error) {
      console.error('❌ Erro ao agendar notificações de galeria:', error);
      return false;
    }
  };

  /**
   * Processa a fila de notificações manualmente
   */
  const processNotificationQueue = async (): Promise<boolean> => {
    try {
      console.log('🔄 Processando fila de notificações...');

      // Proteção contra processamento simultâneo
      const processingKey = 'queue_processing_' + Date.now();
      const existingProcess = sessionStorage.getItem('queue_processing');

      if (existingProcess) {
        const timeSinceLastProcess = Date.now() - parseInt(existingProcess);
        if (timeSinceLastProcess < 5000) {
          console.log('⚠️ Fila processada recentemente, aguardando...');
          return true;
        }
      }

      sessionStorage.setItem('queue_processing', Date.now().toString());

      try {
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-scheduled-notifications`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
              'Content-Type': 'application/json'
            }
          }
        );

        if (response.ok) {
          const result = await response.json();
          console.log('✅ Fila processada:', result);
          return true;
        } else {
          console.error('❌ Erro ao processar fila:', response.status);
          return false;
        }
      } finally {
        // Limpar após 5 segundos
        setTimeout(() => {
          sessionStorage.removeItem('queue_processing');
        }, 5000);
      }
    } catch (error) {
      console.error('❌ Erro ao processar fila:', error);
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
    scheduleGalleryNotifications,
    processNotificationQueue,
    refetch: fetchTemplates
  };
}
