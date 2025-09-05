import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface WhatsAppInstance {
  id: string;
  instance_name: string;
  status: string;
  instance_data: {
    evolution_api_url?: string;
    evolution_api_key?: string;
  };
  created_at: string;
  updated_at: string;
}

export function useWhatsApp() {
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchInstances();
  }, []);

  const fetchInstances = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('whatsapp_instances')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInstances(data || []);
    } catch (err) {
      console.error('Erro ao buscar instâncias WhatsApp:', err);
      setError(err instanceof Error ? err.message : 'Falha ao buscar instâncias');
    } finally {
      setLoading(false);
    }
  };

  const testConnection = async (): Promise<{ success: boolean; message: string }> => {
    const activeInstance = instances.find(instance => 
      instance.status === 'connected' || instance.status === 'created'
    ) || instances[0];

    if (!activeInstance) {
      return {
        success: false,
        message: 'Nenhuma instância WhatsApp encontrada'
      };
    }

    const { evolution_api_url, evolution_api_key } = activeInstance.instance_data;

    if (!evolution_api_url || !evolution_api_key) {
      return {
        success: false,
        message: 'Credenciais WhatsApp não configuradas'
      };
    }

    try {
      const { data, error } = await supabase.functions.invoke('send-selection-confirmation', {
        body: {
          action: 'test-connection',
          evolution_api_url,
          evolution_api_key,
          instance_name: activeInstance.instance_name
        }
      });

      if (error) {
        return {
          success: false,
          message: `Erro na conexão: ${error.message}`
        };
      }

      return data || { success: false, message: 'Resposta inválida' };
    } catch (error) {
      return {
        success: false,
        message: `Erro de rede: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
      };
    }
  };

  const sendGalleryLink = async (
    clientName: string,
    clientPhone: string,
    galleryToken: string,
    expirationDate: string
  ): Promise<boolean> => {
    try {
      const galleryLink = `${window.location.origin}/gallery/${galleryToken}`;
      const expirationDateFormatted = new Date(expirationDate).toLocaleDateString('pt-BR');
      
      const message = `📸 *Sua galeria está pronta!*\n\n` +
                    `Olá ${clientName}!\n\n` +
                    `Suas fotos já estão disponíveis para visualização e seleção.\n\n` +
                    `🔗 *Link da galeria:*\n${galleryLink}\n\n` +
                    `⏰ *Importante:*\n` +
                    `• Link válido até: ${expirationDateFormatted}\n` +
                    `• Selecione suas fotos favoritas\n` +
                    `• Você tem 7 dias para fazer a seleção\n\n` +
                    `📱 Acesse pelo celular ou computador!\n\n` +
                    `_Mensagem automática do sistema_`;

      const { data, error } = await supabase.functions.invoke('send-whatsapp-message', {
        body: {
          clientName,
          clientPhone,
          message
        }
      });

      if (error) {
        console.error('Erro ao enviar link da galeria:', error);
        return false;
      }

      return data?.success || false;
    } catch (error) {
      console.error('Erro ao enviar link da galeria:', error);
      return false;
    }
  };

  return {
    instances,
    loading,
    error,
    testConnection,
    sendGalleryLink,
    refetch: fetchInstances
  };
}