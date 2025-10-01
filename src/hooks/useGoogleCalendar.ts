import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface GoogleCalendarSettings {
  id: string;
  calendar_id: string;
  service_account_email: string;
  service_account_key: any;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function useGoogleCalendar() {
  const [settings, setSettings] = useState<GoogleCalendarSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('google_calendar_settings')
        .select('*')
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      setSettings(data);
    } catch (error) {
      console.error('Erro ao buscar configurações do Google Calendar:', error);
      setError(error instanceof Error ? error.message : 'Erro ao buscar configurações');
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async (
    calendarId: string,
    serviceAccountEmail: string,
    serviceAccountKey: string
  ): Promise<boolean> => {
    try {
      console.log('🔄 Salvando configurações do Google Calendar...');
      console.log('Calendar ID:', calendarId);
      console.log('Service Account Email:', serviceAccountEmail);

      // Verificar se usuário está autenticado
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('❌ Usuário não autenticado');
        setError('Você precisa estar autenticado para salvar configurações.');
        return false;
      }
      console.log('✅ Usuário autenticado:', user.email);

      // Parse service account key JSON
      let keyObject;
      try {
        console.log('📝 Parseando JSON da Service Account Key...');
        keyObject = JSON.parse(serviceAccountKey);
        console.log('✅ JSON parseado com sucesso');
      } catch (parseError) {
        console.error('❌ Erro ao parsear JSON:', parseError);
        setError('JSON da Service Account Key inválido. Verifique se é um JSON válido.');
        return false;
      }

      // Validate required fields
      console.log('🔍 Validando campos obrigatórios...');
      if (!keyObject.private_key || !keyObject.client_email) {
        console.error('❌ Campos obrigatórios faltando:', {
          has_private_key: !!keyObject.private_key,
          has_client_email: !!keyObject.client_email
        });
        setError('JSON da Service Account Key está incompleto. Certifique-se de que contém "private_key" e "client_email".');
        return false;
      }
      console.log('✅ Campos obrigatórios presentes');

      // Desativar configurações antigas
      if (settings) {
        console.log('🔄 Desativando configuração antiga...');
        await supabase
          .from('google_calendar_settings')
          .update({ is_active: false })
          .eq('id', settings.id);
        console.log('✅ Configuração antiga desativada');
      }

      // Inserir nova configuração
      console.log('💾 Inserindo nova configuração no banco...');
      const { data, error } = await supabase
        .from('google_calendar_settings')
        .insert({
          calendar_id: calendarId,
          service_account_email: serviceAccountEmail,
          service_account_key: keyObject,
          is_active: true,
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Erro do Supabase:', error);
        throw error;
      }

      console.log('✅ Configurações salvas com sucesso!');
      setSettings(data);
      setError(null);
      return true;
    } catch (error) {
      console.error('❌ Erro ao salvar configurações:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido ao salvar configurações';
      setError(errorMessage);
      return false;
    }
  };

  const updateSettings = async (
    calendarId: string,
    serviceAccountEmail: string,
    serviceAccountKey?: string
  ): Promise<boolean> => {
    try {
      if (!settings) {
        return await saveSettings(calendarId, serviceAccountEmail, serviceAccountKey || '{}');
      }

      let updateData: any = {
        calendar_id: calendarId,
        service_account_email: serviceAccountEmail,
        updated_at: new Date().toISOString(),
      };

      // Se uma nova key foi fornecida, parse e adicione
      if (serviceAccountKey && serviceAccountKey.trim()) {
        try {
          const keyObject = JSON.parse(serviceAccountKey);
          if (!keyObject.private_key || !keyObject.client_email) {
            setError('JSON da Service Account Key está incompleto');
            return false;
          }
          updateData.service_account_key = keyObject;
        } catch (parseError) {
          setError('JSON da Service Account Key inválido');
          return false;
        }
      }

      const { data, error } = await supabase
        .from('google_calendar_settings')
        .update(updateData)
        .eq('id', settings.id)
        .select()
        .single();

      if (error) throw error;

      setSettings(data);
      return true;
    } catch (error) {
      console.error('Erro ao atualizar configurações:', error);
      setError(error instanceof Error ? error.message : 'Erro ao atualizar configurações');
      return false;
    }
  };

  const deleteSettings = async (): Promise<boolean> => {
    try {
      if (!settings) return false;

      const { error } = await supabase
        .from('google_calendar_settings')
        .delete()
        .eq('id', settings.id);

      if (error) throw error;

      setSettings(null);
      return true;
    } catch (error) {
      console.error('Erro ao deletar configurações:', error);
      setError(error instanceof Error ? error.message : 'Erro ao deletar configurações');
      return false;
    }
  };

  const testConnection = async (): Promise<{ success: boolean; message: string }> => {
    try {
      if (!settings) {
        return {
          success: false,
          message: 'Nenhuma configuração encontrada. Salve as configurações primeiro.',
        };
      }

      // Testar conexão verificando disponibilidade em um período de 1 hora a partir de agora
      const now = new Date();
      const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/check-calendar-availability`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            startDateTime: now.toISOString(),
            endDateTime: oneHourLater.toISOString(),
          }),
        }
      );

      const result = await response.json();

      if (result.success) {
        return {
          success: true,
          message: '✅ Conexão com Google Calendar estabelecida com sucesso!',
        };
      } else {
        return {
          success: false,
          message: `❌ Erro ao conectar: ${result.error || 'Erro desconhecido'}`,
        };
      }
    } catch (error) {
      console.error('Erro ao testar conexão:', error);
      return {
        success: false,
        message: `❌ Erro ao testar conexão: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
      };
    }
  };

  return {
    settings,
    loading,
    error,
    saveSettings,
    updateSettings,
    deleteSettings,
    testConnection,
    refetch: fetchSettings,
  };
}
