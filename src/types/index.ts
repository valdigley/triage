const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    console.log('🚀 Edge Function: send-selection-confirmation iniciada');
    
    const requestBody = await req.json();
    const { action, clientName, clientPhone, selectedCount, minimumPhotos, extraPhotos, totalAmount, paymentLink, formattedAmount, hasExtras, evolution_api_url, evolution_api_key, instance_name } = requestBody;
    
    // Handle connection test
    if (action === 'test-connection') {
      console.log('🧪 Testando conexão com Evolution API...');
      
      if (!evolution_api_url || !evolution_api_key || !instance_name) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Credenciais obrigatórias não fornecidas' 
          }),
          {
            status: 400,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders,
            },
          }
        );
      }
      
      try {
        console.log('📡 Testando URL:', evolution_api_url);
        console.log('🏷️ Instância:', instance_name);
        
        const testResponse = await fetch(`${evolution_api_url}/instance/fetchInstances`, {
          method: 'GET',
          headers: {
            'apikey': evolution_api_key,
            'Content-Type': 'application/json'
          }
        });
        
        console.log('📊 Status da resposta:', testResponse.status);
        
        if (testResponse.ok) {
          const instances = await testResponse.json();
          console.log('✅ Instâncias encontradas:', instances);
          
          const targetInstance = instances.find((inst: any) => inst.instance.instanceName === instance_name);
          
          if (targetInstance) {
            return new Response(
              JSON.stringify({
                success: true,
                message: `Conexão OK! Instância "${instance_name}" encontrada com status: ${targetInstance.instance.status}`,
                instance_status: targetInstance.instance.status
              }),
              {
                headers: {
                  'Content-Type': 'application/json',
                  ...corsHeaders,
                },
              }
            );
          } else {
            return new Response(
              JSON.stringify({
                success: false,
                message: `Instância "${instance_name}" não encontrada. Instâncias disponíveis: ${instances.map((i: any) => i.instance.instanceName).join(', ')}`
              }),
              {
                headers: {
                  'Content-Type': 'application/json',
                  ...corsHeaders,
                },
              }
            );
          }
        } else {
          const errorText = await testResponse.text();
          console.error('❌ Erro na resposta:', errorText);
          
          return new Response(
            JSON.stringify({
              success: false,
              message: `Erro HTTP ${testResponse.status}: ${errorText}`
            }),
            {
              headers: {
                'Content-Type': 'application/json',
                ...corsHeaders,
              },
            }
          );
        }
      } catch (testError) {
        console.error('❌ Erro ao testar conexão:', testError);
        
        return new Response(
          JSON.stringify({
            success: false,
            message: `Erro de conexão: ${testError instanceof Error ? testError.message : 'Erro desconhecido'}`
          }),
          {
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders,
            },
          }
        );
      }
    }
    
    console.log('📋 Dados recebidos:', {
      clientName,
      clientPhone,
      selectedCount,
      minimumPhotos,
      extraPhotos,
      totalAmount,
      paymentLink
    });

    if (!clientName || !clientPhone || selectedCount === undefined || minimumPhotos === undefined) {
      console.error('❌ Dados obrigatórios não fornecidos');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Dados obrigatórios não fornecidos' 
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      );
    }

    // Get Supabase client
    const { createClient } = await import('npm:@supabase/supabase-js@2');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get settings
    const { data: settings } = await supabase
      .from('settings')
      .select('delivery_days, price_commercial_hour')
      .single();

    const deliveryDays = settings?.delivery_days || 7;
    const pricePerPhoto = settings?.price_commercial_hour || 30;
    
    console.log('🔍 Buscando instâncias WhatsApp...');
    
    // Get active WhatsApp instance
    const { data: instances } = await supabase
      .from('whatsapp_instances')
      .select('*')
      .order('created_at', { ascending: false });

    console.log('📱 Instâncias encontradas:', instances?.length || 0);
    const activeInstance = instances?.find(instance => 
      instance.status === 'connected' || instance.status === 'created'
    ) || instances?.[0];

    if (!activeInstance) {
      console.error('❌ Nenhuma instância WhatsApp ativa encontrada');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Nenhuma instância WhatsApp ativa encontrada' 
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      );
    }

    console.log('✅ Instância ativa encontrada:', activeInstance.instance_name);
    const { evolution_api_url: apiUrl, evolution_api_key: apiKey } = activeInstance.instance_data;
    
    if (!apiUrl || !apiKey) {
      console.error('❌ Credenciais WhatsApp não configuradas');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Credenciais WhatsApp não configuradas' 
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      );
    }

    // Criar mensagem personalizada baseada se há fotos extras ou não
    let message = '';
    
    if (hasExtras && extraPhotos && extraPhotos > 0 && paymentLink) {
      // Mensagem para fotos extras com pagamento
      console.log('📝 Montando mensagem para fotos extras...');
      
      message = `✅ *Seleção Confirmada!*\n\n` +
                `Olá ${clientName}!\n\n` +
                `Recebemos sua seleção de fotos com sucesso! 🎉\n\n` +
                `📊 *Resumo da sua seleção:*\n` +
                `📸 *Fotos selecionadas:* ${selectedCount}\n` +
                `✅ *Fotos incluídas:* ${minimumPhotos}\n` +
                `➕ *Fotos extras:* ${extraPhotos}\n` +
                `💰 *Valor adicional:* ${formattedAmount || new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalAmount || 0)}\n\n` +
                `💳 *Pagamento das fotos extras:*\n` +
                `Para finalizar o processo, efetue o pagamento das fotos extras através do link abaixo:\n\n` +
                `🔗 *Link de Pagamento:*\n${paymentLink}\n\n` +
                `⏰ *Próximos passos:*\n` +
                `• Efetue o pagamento das fotos extras\n` +
                `• Suas fotos serão editadas profissionalmente\n` +
                `• Prazo de entrega: até ${deliveryDays} dias úteis\n` +
                `• Você receberá o link para download das fotos finais\n` +
                `• As fotos finais não terão marca d'água\n\n` +
                `🎨 *Processo de edição:*\n` +
                `• Correção de cores e iluminação\n` +
                `• Ajustes de contraste e nitidez\n` +
                `• Retoques básicos quando necessário\n\n` +
                `Obrigado por escolher nossos serviços! 📸✨\n\n` +
                `Em caso de dúvidas, entre em contato conosco.\n\n` +
                `_Mensagem automática do sistema_`;
    } else {
      // Mensagem padrão para seleção sem fotos extras
      console.log('📝 Montando mensagem padrão de seleção...');
      
      message = `✅ *Seleção Confirmada!*\n\n` +
                `Olá ${clientName}!\n\n` +
                `Recebemos sua seleção de fotos com sucesso! 🎉\n\n` +
                `📊 *Resumo da sua seleção:*\n` +
                `📸 *Fotos selecionadas:* ${selectedCount}\n` +
                `✅ *Fotos incluídas:* ${minimumPhotos}\n\n` +
                `⏰ *Próximos passos:*\n` +
                `• Suas fotos serão editadas profissionalmente\n` +
                `• Prazo de entrega: até ${deliveryDays} dias úteis\n` +
                `• Você receberá o link para download das fotos finais\n` +
                `• As fotos finais não terão marca d'água\n\n` +
                `🎨 *Processo de edição:*\n` +
                `• Correção de cores e iluminação\n` +
                `• Ajustes de contraste e nitidez\n` +
                `• Retoques básicos quando necessário\n\n` +
                `Obrigado por escolher nossos serviços! 📸✨\n\n` +
                `Em caso de dúvidas, entre em contato conosco.\n\n` +
                `_Mensagem automática do sistema_`;
    }
    
    console.log('✅ Mensagem preparada');

    console.log('📱 Enviando mensagem WhatsApp...');
    console.log('📞 Para:', clientPhone);
    // Send WhatsApp message
    let whatsappSuccess = false;
    try {
      whatsappSuccess = await sendWhatsAppMessage(
        activeInstance.instance_name,
        apiUrl,
        apiKey,
        clientPhone,
        message
      );
    } catch (whatsappError) {
      console.error('❌ Erro ao enviar WhatsApp:', whatsappError);
      // WhatsApp failure doesn't affect the main process
      whatsappSuccess = false;
    }

    console.log(whatsappSuccess ? '✅ Mensagem enviada com sucesso!' : '❌ Falha ao enviar mensagem (processo continua)');
    return new Response(
      JSON.stringify({
        success: true, // Main process always succeeds
        whatsapp_sent: whatsappSuccess,
        message: whatsappSuccess ? 'Seleção confirmada e WhatsApp enviado' : 'Seleção confirmada (WhatsApp indisponível)',
        has_extra_photos: extraPhotos && extraPhotos > 0,
        payment_link: paymentLink
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );

  } catch (error) {
    console.error('Error in send-selection-confirmation:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: `Erro interno: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  }
});