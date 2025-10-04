import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useTenant } from './useTenant';

interface WhatsAppInstance {
  id: string;
  instance_name: string;
  status: string;
  tenant_id: string;
  instance_data: {
    evolution_api_url?: string;
    evolution_api_key?: string;
    saved_at?: string;
  };
  last_updated: string;
}

export function useWhatsApp() {
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  const [loading, setLoading] = useState(false);
  const { tenant, loading: tenantLoading } = useTenant();

  const fetchInstances = async () => {
    if (!tenant) {
      console.warn('⚠️ Tenant não disponível para buscar instâncias');
      return;
    }

    try {
      console.log('🔍 Buscando instâncias WhatsApp para tenant:', tenant.id);
      const { data, error } = await supabase
        .from('triagem_whatsapp_instances')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      console.log(`📱 ${data?.length || 0} instância(s) encontrada(s):`, data);
      setInstances(data || []);
    } catch (error) {
      console.error('❌ Erro ao buscar instâncias WhatsApp:', error);
    }
  };

  const getActiveInstance = (): WhatsAppInstance | null => {
    console.log(`🔍 Buscando instância ativa entre ${instances.length} instâncias`);

    // Buscar instância ativa (connected ou created)
    const active = instances.find(instance =>
      instance.status === 'connected' || instance.status === 'created'
    ) || instances[0] || null;

    if (active) {
      console.log('✅ Instância ativa encontrada:', active.instance_name, '- Status:', active.status);
    } else {
      console.warn('⚠️ Nenhuma instância ativa encontrada');
    }

    return active;
  };

  const checkRemoteJid = async (instance: WhatsAppInstance, phone: string): Promise<string | null> => {
    const { evolution_api_url, evolution_api_key } = instance.instance_data;
    
    if (!evolution_api_url || !evolution_api_key) {
      return null;
    }

    // Limpar o número de telefone e garantir DDI 55
    let cleanPhone = phone.replace(/\D/g, '');
    
    if (!cleanPhone.startsWith('55')) {
      cleanPhone = '55' + cleanPhone;
    }

    // Criar variações do número para testar
    const phoneVariations = [];
    
    if (cleanPhone.length === 13) {
      phoneVariations.push(cleanPhone); // Com 9
      phoneVariations.push(cleanPhone.slice(0, 4) + cleanPhone.slice(5)); // Sem 9
    } else if (cleanPhone.length === 12) {
      phoneVariations.push(cleanPhone); // Sem 9
      phoneVariations.push(cleanPhone.slice(0, 4) + '9' + cleanPhone.slice(4)); // Com 9
    } else {
      phoneVariations.push(cleanPhone);
    }

    // Testar cada variação para ver qual existe no WhatsApp
    for (const phoneNumber of phoneVariations) {
      try {
        const response = await fetch(`${evolution_api_url}/chat/whatsappNumbers/${instance.instance_name}`, {
          method: 'POST',
          headers: {
            'apikey': evolution_api_key,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            numbers: [phoneNumber]
          })
        });

        if (response.ok) {
          const result = await response.json();
          // Se o número existe no WhatsApp, retornar ele
          if (result && result.length > 0 && result[0].exists) {
            return phoneNumber;
          }
        }
      } catch (error) {
        console.log(`Erro ao verificar número ${phoneNumber}:`, error);
      }
    }

    // Se nenhuma variação foi encontrada, retornar a primeira (padrão)
    return phoneVariations[0];
  };
  const sendMessage = async (phone: string, message: string): Promise<boolean> => {
    const activeInstance = getActiveInstance();

    if (!activeInstance) {
      console.warn('⚠️ Nenhuma instância WhatsApp ativa encontrada');
      return false;
    }

    const { evolution_api_url, evolution_api_key } = activeInstance.instance_data;

    if (!evolution_api_url || !evolution_api_key) {
      console.error('❌ Credenciais da Evolution API não encontradas na instância');
      return false;
    }

    try {
      setLoading(true);
      
      // Verificar qual número existe no WhatsApp
      const validPhone = await checkRemoteJid(activeInstance, phone);
      
      if (!validPhone) {
        return false;
      }

      console.log(`Enviando mensagem para: ${validPhone}`);
      
      const response = await fetch(`${evolution_api_url}/message/sendText/${activeInstance.instance_name}`, {
        method: 'POST',
        headers: {
          'apikey': evolution_api_key,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          number: validPhone,
          text: message
        })
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Mensagem enviada com sucesso:', result);
        return true;
      } else {
        const errorData = await response.json();
        console.error('Erro ao enviar mensagem:', errorData);
        return false;
      }
    } catch (error) {
      console.error('Erro ao enviar mensagem WhatsApp:', error);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const sendAppointmentConfirmation = async (clientName: string, clientPhone: string, appointmentDate: string, sessionType: string): Promise<boolean> => {
    const message = `🎉 *Agendamento Confirmado!*\n\n` +
                   `Olá ${clientName}!\n\n` +
                   `Seu agendamento foi confirmado com sucesso:\n\n` +
                   `📅 *Data:* ${new Date(appointmentDate).toLocaleDateString('pt-BR')}\n` +
                   `🕐 *Horário:* ${new Date(appointmentDate).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}\n` +
                   `📸 *Tipo:* ${sessionType}\n\n` +
                   `Estamos ansiosos para sua sessão fotográfica!\n\n` +
                   `Em caso de dúvidas, entre em contato conosco.\n\n` +
                   `_Mensagem automática do sistema_`;

    return await sendMessage(clientPhone, message);
  };

  const sendGalleryLink = async (clientName: string, clientPhone: string, galleryToken: string, expirationDate: string): Promise<boolean> => {
    // Use short URL path /g/ for WhatsApp preview
    // This should be configured in your VPS Nginx to proxy to Edge Function for bots
    const appUrl = 'https://triagem.online';
    const galleryUrl = `${appUrl}/g/${galleryToken}`;

    const message = `📸 *Suas Fotos Estão Prontas!*\n\n` +
                   `Olá ${clientName}!\n\n` +
                   `Suas fotos da sessão fotográfica estão prontas para visualização e seleção! 🎉\n\n` +
                   `🔗 *Link da Galeria:*\n${galleryUrl}\n\n` +
                   `⏰ *Válido até:* ${new Date(expirationDate).toLocaleDateString('pt-BR')}\n\n` +
                   `📋 *Instruções:*\n` +
                   `• Acesse o link acima\n` +
                   `• Visualize todas as fotos\n` +
                   `• Selecione suas favoritas\n` +
                   `• Confirme sua seleção\n\n` +
                   `💡 *Lembre-se:*\n` +
                   `• As fotos mostradas têm marca d'água apenas para visualização\n` +
                   `• As fotos finais serão entregues sem marca d'água e em alta qualidade\n` +
                   `• Você pode selecionar quantas fotos desejar\n\n` +
                   `Em caso de dúvidas, entre em contato conosco.\n\n` +
                   `_Mensagem automática do sistema_`;

    return await sendMessage(clientPhone, message);
  };

  const sendPaymentReminder = async (clientName: string, clientPhone: string, amount: number): Promise<boolean> => {
    const message = `💳 *Lembrete de Pagamento*\n\n` +
                   `Olá ${clientName}!\n\n` +
                   `Identificamos que o pagamento da sua sessão fotográfica ainda está pendente.\n\n` +
                   `💰 *Valor:* ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount)}\n\n` +
                   `Por favor, efetue o pagamento para confirmarmos seu agendamento.\n\n` +
                   `Em caso de dúvidas ou se já efetuou o pagamento, entre em contato conosco.\n\n` +
                   `_Mensagem automática do sistema_`;

    return await sendMessage(clientPhone, message);
  };

  const sendPaymentConfirmation = async (
    clientName: string,
    clientPhone: string,
    amount: number,
    appointmentDate: string,
    sessionType: string,
    studioAddress?: string,
    studioMapsUrl?: string
  ): Promise<boolean> => {
    const formattedAmount = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount);
    const formattedDate = new Date(appointmentDate).toLocaleDateString('pt-BR');
    const formattedTime = new Date(appointmentDate).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    let message = `✅ *Pagamento Confirmado!*\n\n` +
                  `Olá ${clientName}!\n\n` +
                  `Recebemos seu pagamento de ${formattedAmount} com sucesso! 🎉\n\n` +
                  `📋 *Detalhes da sua sessão:*\n` +
                  `📸 *Tipo:* ${sessionType}\n` +
                  `📅 *Data:* ${formattedDate}\n` +
                  `🕐 *Horário:* ${formattedTime}\n\n`;

    if (studioAddress) {
      message += `📍 *Local:*\n${studioAddress}\n\n`;
    }

    if (studioMapsUrl) {
      message += `🗺️ *Ver no mapa:*\n${studioMapsUrl}\n\n`;
    }

    message += `💡 *Dicas importantes:*\n` +
               `• Chegue 10 minutos antes do horário\n` +
               `• Traga roupas extras se desejar\n` +
               `• Suas fotos ficarão prontas em até 7 dias\n\n` +
               `Estamos ansiosos para sua sessão! 📸✨\n\n` +
               `_Mensagem automática do sistema_`;

    return await sendMessage(clientPhone, message);
  };

  const sendSelectionConfirmation = async (
    clientName: string, 
    clientPhone: string, 
    selectedCount: number, 
    minimumPhotos: number,
    pricePerPhoto: number = 30
  ): Promise<boolean> => {
    try {
      const activeInstance = getActiveInstance();
      
      if (!activeInstance) {
        console.log('⚠️ Nenhuma instância WhatsApp ativa');
        return false;
      }

      const { evolution_api_url, evolution_api_key } = activeInstance.instance_data;
      
      if (!evolution_api_url || !evolution_api_key) {
        console.log('⚠️ Credenciais WhatsApp não configuradas');
        return false;
      }

    const extraPhotos = Math.max(0, selectedCount - minimumPhotos);
    const extraCost = extraPhotos * pricePerPhoto;
    
    let message = `✅ *Seleção Confirmada!*\n\n` +
                  `Olá ${clientName}!\n\n` +
                  `Recebemos sua seleção de fotos com sucesso! 🎉\n\n` +
                  `📊 *Resumo da sua seleção:*\n` +
                  `📸 *Fotos selecionadas:* ${selectedCount}\n` +
                  `✅ *Fotos incluídas:* ${minimumPhotos}\n`;
    
    if (extraPhotos > 0) {
      const formattedCost = new Intl.NumberFormat('pt-BR', { 
        style: 'currency', 
        currency: 'BRL' 
      }).format(extraCost);
      
      message += `➕ *Fotos extras:* ${extraPhotos}\n` +
                 `💰 *Valor adicional:* ${formattedCost}\n\n` +
                 `💳 *Pagamento das fotos extras:*\n` +
                 `O valor das fotos extras será cobrado separadamente e você receberá o link de pagamento em breve.\n\n`;
    } else {
      message += `\n`;
    }
    
    message += `⏳ *Próximos passos:*\n` +
               `• Suas fotos serão editadas profissionalmente\n` +
               `• Prazo de entrega: até 7 dias úteis\n` +
               `• Você receberá o link para download das fotos finais\n` +
               `• As fotos finais não terão marca d'água\n\n` +
               `🎨 *Processo de edição:*\n` +
               `• Correção de cores e iluminação\n` +
               `• Ajustes de contraste e nitidez\n` +
               `• Retoques básicos quando necessário\n\n` +
               `Obrigado por escolher nossos serviços! 📸✨\n\n` +
               `Em caso de dúvidas, entre em contato conosco.\n\n` +
               `_Mensagem automática do sistema_`;

    return await sendMessage(clientPhone, message);
    } catch (error) {
      console.log('⚠️ Erro ao enviar confirmação de seleção:', error);
      return false;
    }
  };

  const getQRCode = async (): Promise<{ success: boolean; qrCode?: string; message: string }> => {
    const activeInstance = getActiveInstance();

    if (!activeInstance) {
      return {
        success: false,
        message: 'Nenhuma instância WhatsApp configurada'
      };
    }

    const { evolution_api_url, evolution_api_key } = activeInstance.instance_data;

    if (!evolution_api_url || !evolution_api_key) {
      return {
        success: false,
        message: 'Credenciais da Evolution API não configuradas'
      };
    }

    try {
      setLoading(true);

      const response = await fetch(`${evolution_api_url}/instance/connect/${activeInstance.instance_name}`, {
        method: 'GET',
        headers: {
          'apikey': evolution_api_key,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const result = await response.json();

        if (result.base64) {
          return {
            success: true,
            qrCode: result.base64,
            message: 'QR Code gerado com sucesso'
          };
        } else if (result.instance?.state === 'open') {
          return {
            success: true,
            message: 'WhatsApp já está conectado'
          };
        } else {
          return {
            success: false,
            message: 'QR Code não disponível'
          };
        }
      } else {
        const errorText = await response.text();
        return {
          success: false,
          message: `Erro: ${errorText}`
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `Erro de conexão: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
      };
    } finally {
      setLoading(false);
    }
  };

  const testConnection = async (): Promise<{ success: boolean; message: string }> => {
    const activeInstance = getActiveInstance();

    if (!activeInstance) {
      return {
        success: false,
        message: 'Nenhuma instância WhatsApp configurada'
      };
    }

    const { evolution_api_url, evolution_api_key } = activeInstance.instance_data;

    if (!evolution_api_url || !evolution_api_key) {
      return {
        success: false,
        message: 'Credenciais da Evolution API não configuradas'
      };
    }

    try {
      setLoading(true);

      console.log('🧪 Testando conexão WhatsApp...');
      console.log('📡 URL:', evolution_api_url);
      console.log('🏷️ Instance:', activeInstance.instance_name);

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-selection-confirmation`;

      console.log('🔗 Chamando Edge Function:', apiUrl);

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          action: 'test-connection',
          evolution_api_url,
          evolution_api_key,
          instance_name: activeInstance.instance_name
        })
      });

      console.log('📊 Response status:', response.status);

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Resultado:', result);
        return {
          success: result.success,
          message: result.message
        };
      } else {
        const errorText = await response.text();
        console.error('❌ Erro:', errorText);
        return {
          success: false,
          message: `Erro HTTP ${response.status}: ${errorText}`
        };
      }
    } catch (error) {
      console.error('❌ Erro de conexão:', error);
      return {
        success: false,
        message: `Erro de conexão: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
      };
    } finally {
      setLoading(false);
    }
  };

  const sendTestMessage = async (phone: string): Promise<{ success: boolean; message: string }> => {
    const activeInstance = getActiveInstance();

    if (!activeInstance) {
      return {
        success: false,
        message: 'Nenhuma instância WhatsApp configurada'
      };
    }

    const { evolution_api_url, evolution_api_key } = activeInstance.instance_data;

    if (!evolution_api_url || !evolution_api_key) {
      return {
        success: false,
        message: 'Credenciais da Evolution API não configuradas'
      };
    }

    try {
      setLoading(true);

      console.log('🧪 Enviando mensagem de teste...');
      console.log('📱 Para:', phone);

      // Clean phone number
      let cleanPhone = phone.replace(/\D/g, '');
      if (!cleanPhone.startsWith('55')) {
        cleanPhone = '55' + cleanPhone;
      }

      console.log('📱 Telefone limpo:', cleanPhone);

      const testMessage = `🧪 *Teste de Conexão WhatsApp*\n\nSua integração com a Evolution API está funcionando perfeitamente!\n\n✅ Instância: ${activeInstance.instance_name}\n⏰ ${new Date().toLocaleString('pt-BR')}`;

      const response = await fetch(`${evolution_api_url}/message/sendText/${activeInstance.instance_name}`, {
        method: 'POST',
        headers: {
          'apikey': evolution_api_key,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          number: cleanPhone,
          text: testMessage
        })
      });

      console.log('📊 Response status:', response.status);

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Resultado:', result);
        return {
          success: true,
          message: '✅ Mensagem de teste enviada com sucesso!'
        };
      } else {
        const errorText = await response.text();
        console.error('❌ Erro:', errorText);
        return {
          success: false,
          message: `❌ Erro HTTP ${response.status}: ${errorText}`
        };
      }
    } catch (error) {
      console.error('❌ Erro ao enviar:', error);
      return {
        success: false,
        message: `❌ Erro: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
      };
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tenantLoading) return;

    if (tenant) {
      fetchInstances();
    }
  }, [tenant, tenantLoading]);

  return {
    instances,
    loading,
    sendMessage,
    sendAppointmentConfirmation,
    sendPaymentConfirmation,
    sendGalleryLink,
    sendPaymentReminder,
    sendSelectionConfirmation,
    getActiveInstance,
    getQRCode,
    testConnection,
    sendTestMessage,
    refetch: fetchInstances
  };
}