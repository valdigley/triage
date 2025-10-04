import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface WhatsAppInstance {
  evolution_instance_name: string | null;
  evolution_instance_apikey: string | null;
  whatsapp_connected: boolean;
  whatsapp_qrcode: string | null;
}

export function useWhatsAppInstance() {
  const [instance, setInstance] = useState<WhatsAppInstance | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchInstance = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { data: tenantUser } = await supabase
        .from('triagem_tenant_users')
        .select('tenant_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!tenantUser) throw new Error('Tenant não encontrado');

      const { data, error } = await supabase
        .from('triagem_settings')
        .select('evolution_instance_name, evolution_instance_apikey, whatsapp_connected, whatsapp_qrcode')
        .eq('tenant_id', tenantUser.tenant_id)
        .maybeSingle();

      if (error) throw error;
      setInstance(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar instância');
      console.error('Erro ao buscar instância WhatsApp:', err);
    } finally {
      setLoading(false);
    }
  };

  const createInstance = async (): Promise<{ success: boolean; message: string; qrcode?: string }> => {
    try {
      setCreating(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { data: tenantUser } = await supabase
        .from('triagem_tenant_users')
        .select('tenant_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!tenantUser) throw new Error('Tenant não encontrado');

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      const response = await fetch(`${supabaseUrl}/functions/v1/create-whatsapp-instance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({
          tenantId: tenantUser.tenant_id
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao criar instância');
      }

      await fetchInstance();

      return {
        success: true,
        message: result.message || 'Instância criada com sucesso',
        qrcode: result.qrcode
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao criar instância';
      setError(errorMessage);
      return {
        success: false,
        message: errorMessage
      };
    } finally {
      setCreating(false);
    }
  };

  const refreshQRCode = async (): Promise<{ success: boolean; qrcode?: string; message?: string }> => {
    try {
      if (!instance?.evolution_instance_name) {
        throw new Error('Instância não configurada');
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { data: globalSettings } = await supabase
        .from('global_settings')
        .select('evolution_server_url, evolution_auth_api_key')
        .maybeSingle();

      if (!globalSettings) {
        throw new Error('Servidor Evolution não configurado');
      }

      const response = await fetch(
        `${globalSettings.evolution_server_url}/instance/connect/${instance.evolution_instance_name}`,
        {
          method: 'GET',
          headers: {
            'apikey': globalSettings.evolution_auth_api_key
          }
        }
      );

      const result = await response.json();

      if (result.qrcode?.base64) {
        return {
          success: true,
          qrcode: result.qrcode.base64
        };
      }

      return {
        success: false,
        message: 'QR Code não disponível'
      };
    } catch (err) {
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Erro ao obter QR Code'
      };
    }
  };

  const checkConnection = async (): Promise<boolean> => {
    try {
      if (!instance?.evolution_instance_name) {
        return false;
      }

      const { data: globalSettings } = await supabase
        .from('global_settings')
        .select('evolution_server_url, evolution_auth_api_key')
        .maybeSingle();

      if (!globalSettings) {
        return false;
      }

      const response = await fetch(
        `${globalSettings.evolution_server_url}/instance/connectionState/${instance.evolution_instance_name}`,
        {
          method: 'GET',
          headers: {
            'apikey': globalSettings.evolution_auth_api_key
          }
        }
      );

      const result = await response.json();
      const isConnected = result.state === 'open';

      // Atualizar status no banco se mudou
      if (isConnected !== instance.whatsapp_connected) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: tenantUser } = await supabase
            .from('triagem_tenant_users')
            .select('tenant_id')
            .eq('user_id', user.id)
            .maybeSingle();

          if (tenantUser) {
            await supabase
              .from('triagem_settings')
              .update({ whatsapp_connected: isConnected })
              .eq('tenant_id', tenantUser.tenant_id);

            await fetchInstance();
          }
        }
      }

      return isConnected;
    } catch (err) {
      console.error('Erro ao verificar conexão:', err);
      return false;
    }
  };

  const deleteInstance = async (): Promise<{ success: boolean; message: string }> => {
    try {
      if (!instance?.evolution_instance_name) {
        throw new Error('Instância não configurada');
      }

      const { data: globalSettings } = await supabase
        .from('global_settings')
        .select('evolution_server_url, evolution_auth_api_key')
        .maybeSingle();

      if (!globalSettings) {
        throw new Error('Servidor Evolution não configurado');
      }

      // Deletar instância no Evolution
      const response = await fetch(
        `${globalSettings.evolution_server_url}/instance/delete/${instance.evolution_instance_name}`,
        {
          method: 'DELETE',
          headers: {
            'apikey': globalSettings.evolution_auth_api_key
          }
        }
      );

      if (!response.ok) {
        throw new Error('Erro ao deletar instância no servidor');
      }

      // Limpar configurações no banco
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: tenantUser } = await supabase
          .from('triagem_tenant_users')
          .select('tenant_id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (tenantUser) {
          await supabase
            .from('triagem_settings')
            .update({
              evolution_instance_name: null,
              evolution_instance_apikey: null,
              whatsapp_connected: false,
              whatsapp_qrcode: null
            })
            .eq('tenant_id', tenantUser.tenant_id);

          await fetchInstance();
        }
      }

      return {
        success: true,
        message: 'Instância deletada com sucesso'
      };
    } catch (err) {
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Erro ao deletar instância'
      };
    }
  };

  useEffect(() => {
    fetchInstance();
  }, []);

  return {
    instance,
    loading,
    creating,
    error,
    createInstance,
    refreshQRCode,
    checkConnection,
    deleteInstance,
    refetch: fetchInstance
  };
}
