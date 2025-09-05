import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface WhatsAppInstance {
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

  const fetchInstances = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { data, error: fetchError } = await supabase
        .from('whatsapp_instances')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) {
        throw fetchError;
      }

      setInstances(data || []);
    } catch (err) {
      console.error('Error fetching WhatsApp instances:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInstances();
  }, []);

  const sendGalleryLink = async (
    clientName: string,
    clientPhone: string,
    galleryToken: string,
    expirationDate: string
  ): Promise<boolean> => {
    try {
      console.log('📱 Enviando link da galeria via WhatsApp...');
      
      // Get active WhatsApp instance
      const { data: instances } = await supabase
        .from('whatsapp_instances')
        .select('*')
        .order('created_at', { ascending: false });

      const activeInstance = instances?.find(instance => 
        instance.status === 'connected' || instance.status === 'created'
      ) || instances?.[0];

      if (!activeInstance) {
        console.error('Nenhuma instância WhatsApp ativa encontrada');
        return false;
      }

      const { evolution_api_url, evolution_api_key } = activeInstance.instance_data;
      
      if (!evolution_api_url || !evolution_api_key) {
        console.error('Credenciais WhatsApp não configuradas');
        return false;
      }

      const galleryLink = `${window.location.origin}/gallery/${galleryToken}`;
      const expirationDateFormatted = new Date(expirationDate).toLocaleDateString('pt-BR');
      
      const message = `📸 *Sua galeria está pronta!*\n\n` +
                     `Olá ${clientName}!\n\n` +
                     `Suas fotos já estão disponíveis para visualização e seleção.\n\n` +
                     `🔗 *Link da galeria:*\n${galleryLink}\n\n` +
                     `⏰ *Importante:*\n` +
                     `• Link válido até: ${expirationDateFormatted}\n` +
                     `• Selecione suas fotos favoritas\n` +
                     `• Prazo para seleção: 7 dias\n\n` +
                     `📝 *Como usar:*\n` +
                     `1. Clique no link acima\n` +
                     `2. Visualize todas as fotos\n` +
                     `3. Selecione suas favoritas\n` +
                     `4. Confirme sua seleção\n\n` +
                     `Em caso de dúvidas, entre em contato conosco.\n\n` +
                     `_Mensagem automática do sistema_`;

      // Clean phone number
      let cleanPhone = clientPhone.replace(/\D/g, '');
      if (!cleanPhone.startsWith('55')) {
        cleanPhone = '55' + cleanPhone;
      }

      const response = await fetch(`${evolution_api_url}/message/sendText/${activeInstance.instance_name}`, {
        method: 'POST',
        headers: {
          'apikey': evolution_api_key,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          number: cleanPhone,
          text: message
        })
      });

      if (response.ok) {
        console.log('✅ Link da galeria enviado via WhatsApp');
        return true;
      } else {
        console.error('❌ Erro ao enviar link da galeria:', await response.text());
        return false;
      }

    } catch (error) {
      console.error('Erro ao enviar link da galeria:', error);
      return false;
    }
  };

  const refetch = () => {
    fetchInstances();
  };

  return {
    instances,
    loading,
    error,
    sendGalleryLink,
    refetch
  };
}