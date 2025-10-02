import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useTenant } from './useTenant';

interface GoogleCalendarSettings {
  id: string;
  calendar_id: string;
  service_account_email: string;
  service_account_key: any;
  is_active: boolean;
  tenant_id: string;
  created_at: string;
  updated_at: string;
}

export function useGoogleCalendar() {
  const [settings, setSettings] = useState<GoogleCalendarSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { tenant, loading: tenantLoading } = useTenant();

  useEffect(() => {
    if (tenantLoading) return;

    if (tenant) {
      fetchSettings();
    } else {
      setLoading(false);
    }
  }, [tenant, tenantLoading]);

  const fetchSettings = async () => {
    if (!tenant) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('triagem_google_calendar_settings')
        .select('*')
        .eq('tenant_id', tenant.id)
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
    serviceAccountJson?: string
  ): Promise<boolean> => {
    try {
      console.log('🔄 Salvando configurações do Google Calendar...');
      console.log('Calendar ID:', calendarId);

      // Verificar se usuário está autenticado
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('❌ Usuário não autenticado');
        setError('Você precisa estar autenticado para salvar configurações.');
        return false;
      }
      console.log('✅ Usuário autenticado:', user.email);

      // Se tem JSON novo, processar
      let updateData: any = {
        calendar_id: calendarId,
      };

      if (serviceAccountJson) {
        // Parse service account key JSON
        let keyObject;
        try {
          console.log('📝 Parseando JSON da Service Account...');
          keyObject = JSON.parse(serviceAccountJson);
          console.log('✅ JSON parseado com sucesso');
        } catch (parseError) {
          console.error('❌ Erro ao parsear JSON:', parseError);
          setError('JSON inválido. Verifique o formato.');
          return false;
        }

        // Validate required fields
        console.log('🔍 Validando campos obrigatórios...');
        console.log('🔍 Keys no JSON:', Object.keys(keyObject));
        console.log('🔍 Tipo do objeto:', typeof keyObject);
        console.log('🔍 JSON completo:', JSON.stringify(keyObject, null, 2));

        if (!keyObject.private_key || !keyObject.client_email) {
          console.error('❌ Campos obrigatórios faltando!');
          console.error('📋 Campos encontrados:', {
            has_type: !!keyObject.type,
            has_project_id: !!keyObject.project_id,
            has_private_key: !!keyObject.private_key,
            has_client_email: !!keyObject.client_email,
            total_keys: Object.keys(keyObject).length,
            keys: Object.keys(keyObject)
          });
          setError(
            '❌ JSON incompleto ou mal formatado.\n\n' +
            'Certifique-se de:\n' +
            '1️⃣ Copiar TODO o conteúdo do arquivo JSON (incluindo as chaves { })\n' +
            '2️⃣ O JSON deve conter os campos "private_key" e "client_email"\n' +
            '3️⃣ Cole o texto completo sem modificações\n\n' +
            `Campos encontrados: ${Object.keys(keyObject).join(', ')}`
          );
          return false;
        }
        console.log('✅ Campos obrigatórios presentes');
        console.log('📧 Client email:', keyObject.client_email);
        console.log('🔑 Private key type:', typeof keyObject.private_key);
        console.log('🔑 Private key length:', keyObject.private_key?.length);

        // Normalizar a private key - APENAS salvar como está no JSON original
        const normalizedPrivateKey = keyObject.private_key;

        console.log('📊 Private key info:');
        console.log('  - Length:', normalizedPrivateKey.length);
        console.log('  - Starts with:', normalizedPrivateKey.substring(0, 30));
        console.log('  - Ends with:', normalizedPrivateKey.substring(normalizedPrivateKey.length - 30));
        console.log('  - Contém \\n literal?', normalizedPrivateKey.includes('\\n'));
        console.log('  - Split por \\n:', normalizedPrivateKey.split('\n').length, 'partes');

        // Criar objeto otimizado com apenas campos necessários
        // IMPORTANTE: Salvar a private_key EXATAMENTE como veio no JSON
        const optimizedKey = {
          type: "service_account",
          private_key: normalizedPrivateKey, // SEM modificações!
          client_email: keyObject.client_email,
          token_uri: "https://oauth2.googleapis.com/token",
          universe_domain: "googleapis.com"
        };

        updateData.service_account_email = keyObject.client_email;
        updateData.service_account_key = optimizedKey;

        console.log('✅ JSON processado');
      }

      // Se já existe configuração, atualizar. Senão, inserir
      if (settings && !serviceAccountJson) {
        // Apenas atualizar calendar_id
        console.log('🔄 Atualizando calendar_id...');
        const { data, error } = await supabase
          .from('triagem_google_calendar_settings')
          .update(updateData)
          .eq('id', settings.id)
          .select()
          .single();

        if (error) {
          console.error('❌ Erro do Supabase:', error);
          throw error;
        }

        setSettings(data);
      } else {
        if (!tenant) {
          console.error('❌ Tenant não encontrado');
          setError('Tenant não encontrado');
          return false;
        }

        // Desativar configurações antigas e inserir nova
        if (settings) {
          console.log('🔄 Desativando configuração antiga...');
          await supabase
            .from('triagem_google_calendar_settings')
            .update({ is_active: false })
            .eq('id', settings.id);
        }

        console.log('💾 Inserindo nova configuração...');
        updateData.is_active = true;
        updateData.tenant_id = tenant.id;

        const { data, error } = await supabase
          .from('triagem_google_calendar_settings')
          .insert(updateData)
          .select()
          .single();

        if (error) {
          console.error('❌ Erro do Supabase:', error);
          throw error;
        }

        setSettings(data);
      }

      console.log('✅ Configurações salvas com sucesso!');
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
    serviceAccountJson?: string
  ): Promise<boolean> => {
    return await saveSettings(calendarId, serviceAccountJson);
  };

  const deleteSettings = async (): Promise<boolean> => {
    try {
      if (!settings) return false;

      const { error } = await supabase
        .from('triagem_google_calendar_settings')
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
