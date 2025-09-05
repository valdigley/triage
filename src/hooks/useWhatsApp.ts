import { supabase } from '../lib/supabase';

async function sendWhatsAppMessage(
  instanceName: string,
  apiUrl: string,
  apiKey: string,
  phone: string,
  message: string
): Promise<boolean> {
  try {
    console.log('📞 Preparando envio WhatsApp...');
    console.log('🏷️ Instância:', instanceName);
    console.log('🌐 API URL:', apiUrl);
    
    // Clean phone number
    let cleanPhone = phone.replace(/\D/g, '');
    if (!cleanPhone.startsWith('55')) {
      cleanPhone = '55' + cleanPhone;
    }

    console.log('📱 Telefone limpo:', cleanPhone);
    console.log('📝 Tamanho da mensagem:', message.length, 'caracteres');

    const requestBody = {
      number: cleanPhone,
      text: message
    };

    const fullUrl = `${apiUrl}/message/sendText/${instanceName}`;
    console.log('🚀 URL completa da requisição:', fullUrl);
    console.log('🚀 Fazendo requisição para Evolution API...');

    const response = await fetch(fullUrl, {
      method: 'POST',
      headers: {
        'apikey': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    console.log('📡 Status da resposta:', response.status);
    
    if (response.ok) {
      let responseData;
      try {
        responseData = await response.json();
      } catch (jsonError) {
        console.error('❌ Erro ao fazer parse do JSON da resposta:', jsonError);
        const responseText = await response.text();
        console.log('📄 Resposta como texto:', responseText);
        return true; // Consider it successful if we got a 200 status
      }
      console.log('✅ Resposta da API:', responseData);
      return true;
    } else {
      let errorData;
      try {
        errorData = await response.json();
      } catch (jsonError) {
        console.error('❌ Erro ao fazer parse do JSON do erro:', jsonError);
        const errorText = await response.text();
        console.error('📄 Erro como texto:', errorText);
        return false;
      }
      console.error('❌ Erro da Evolution API:', errorData);
      return false;
    }

  } catch (error) {
    console.error('❌ Erro ao enviar mensagem WhatsApp:', error);
    console.error('❌ Detalhes do erro:', error.message);
    console.error('❌ Stack trace:', error.stack);
    return false;
  }
}

export const useWhatsApp = () => {
  const testConnection = async (apiUrl: string, apiKey: string, instanceName: string) => {
    try {
      console.log('🧪 Testando conexão com Evolution API...');
      
      if (!apiUrl || !apiKey || !instanceName) {
        throw new Error('Parâmetros de conexão incompletos');
      }

      // Test with a simple status check
      const testUrl = `${apiUrl}/instance/fetchInstances`;
      console.log('🚀 URL de teste:', testUrl);

      const response = await fetch(testUrl, {
        method: 'GET',
        headers: {
          'apikey': apiKey,
          'Content-Type': 'application/json'
        }
      });

      console.log('📡 Status da resposta:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Resposta da API:', data);
        
        // Check if our instance exists
        const instances = Array.isArray(data) ? data : [];
        const instanceExists = instances.some(inst => inst.instance?.instanceName === instanceName);
        
        if (instanceExists) {
          console.log('✅ Instância encontrada!');
          return { success: true, message: 'Conexão estabelecida com sucesso!' };
        } else {
          console.log('⚠️ Instância não encontrada');
          return { success: false, message: 'Instância não encontrada na Evolution API' };
        }
      } else {
        const errorText = await response.text();
        console.error('❌ Erro na resposta:', errorText);
        return { success: false, message: `Erro na conexão: ${response.status}` };
      }

    } catch (error) {
      console.error('❌ Erro no teste de conexão:', error);
      return { 
        success: false, 
        message: `Erro na conexão: ${error instanceof Error ? error.message : 'Erro desconhecido'}` 
      };
    }
  };

  const sendMessage = async (phone: string, message: string) => {
    try {
      // Get WhatsApp settings from database
      const { data: instances, error } = await supabase
        .from('whatsapp_instances')
        .select('*')
        .eq('status', 'connected')
        .limit(1);

      if (error) {
        console.error('❌ Erro ao buscar instâncias WhatsApp:', error);
        return false;
      }

      if (!instances || instances.length === 0) {
        console.error('❌ Nenhuma instância WhatsApp ativa encontrada');
        return false;
      }

      const activeInstance = instances[0];
      const { instance_data } = activeInstance;
      
      if (!instance_data?.evolution_api_url || !instance_data?.evolution_api_key) {
        console.error('❌ Configurações da Evolution API não encontradas');
        return false;
      }

      return await sendWhatsAppMessage(
        activeInstance.instance_name,
        instance_data.evolution_api_url,
        instance_data.evolution_api_key,
        phone,
        message
      );

    } catch (error) {
      console.error('❌ Erro ao enviar mensagem:', error);
      return false;
    }
  };

  return {
    testConnection,
    sendMessage
  };
};