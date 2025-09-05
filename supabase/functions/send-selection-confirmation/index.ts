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

    console.log('🚀 Fazendo requisição para Evolution API...');

    const response = await fetch(`${apiUrl}/message/sendText/${instanceName}`, {
      method: 'POST',
      headers: {
        'apikey': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    console.log('📡 Status da resposta:', response.status);
    
    if (response.ok) {
      const responseData = await response.json();
      console.log('✅ Resposta da API:', responseData);
      return true;
    } else {
      const errorData = await response.json();
      console.error('❌ Erro da Evolution API:', errorData);
      return false;
    }

  } catch (error) {
    console.error('❌ Erro ao enviar mensagem WhatsApp:', error);
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
    const { action, clientName, clientPhone, selectedCount, minimumPhotos, evolution_api_url, evolution_api_key, instance_name } = requestBody;
    
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
      minimumPhotos
    });

    // Get settings for pricing
    const { data: settings } = await supabase
      .from('settings')
      .select('price_commercial_hour')
      .single();

    const pricePerPhoto = settings?.price_commercial_hour || 30;
    console.log('💰 Preço por foto extra:', pricePerPhoto);

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

    console.log('📝 Buscando template de notificação...');
    
    // Get notification template
    const { data: template, error: templateError } = await supabase
      .from('notification_templates')
      .select('message_template')
      .eq('type', 'selection_received')
      .eq('is_active', true)
      .single();

    if (templateError || !template) {
      console.error('❌ Template selection_received não encontrado ou inativo');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Template de notificação não encontrado' 
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

    console.log('✅ Template encontrado');

    // Get settings for delivery_days
    const { data: settings } = await supabase
      .from('settings')
      .select('delivery_days')
      .single();

    const deliveryDays = settings?.delivery_days || 7;

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
    const { evolution_api_url, evolution_api_key } = activeInstance.instance_data;
    
    if (!evolution_api_url || !evolution_api_key) {
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

    console.log('🔧 Credenciais WhatsApp OK');
    console.log('📝 Montando mensagem...');
    
    // Process template with variables
    const extraPhotos = Math.max(0, selectedCount - minimumPhotos);
    const extraCost = extraPhotos * pricePerPhoto;
    const formattedExtraCost = new Intl.NumberFormat('pt-BR', { 
      style: 'currency', 
      currency: 'BRL' 
    }).format(extraCost);
    
    const formattedPricePerPhoto = new Intl.NumberFormat('pt-BR', { 
      style: 'currency', 
      currency: 'BRL' 
    }).format(pricePerPhoto);
    
    // Variables for template processing
    const variables = {
      client_name: clientName,
      selected_count: selectedCount.toString(),
      minimum_photos: minimumPhotos.toString(),
      extra_photos: extraPhotos.toString(),
      extra_cost: formattedExtraCost,
      price_per_photo: formattedPricePerPhoto,
      delivery_days: deliveryDays.toString()
    };

    // Process template by replacing variables
    let message = template.message_template;
    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      message = message.replace(regex, value);
    });

    console.log('✅ Template processado com variáveis');

    console.log('📱 Enviando mensagem WhatsApp...');
    console.log('📞 Para:', clientPhone);
    // Send WhatsApp message
    let whatsappSuccess = false;
    try {
      whatsappSuccess = await sendWhatsAppMessage(
        activeInstance.instance_name,
        evolution_api_url,
        evolution_api_key,
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
        message: whatsappSuccess ? 'Seleção confirmada e WhatsApp enviado' : 'Seleção confirmada (WhatsApp indisponível)'
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