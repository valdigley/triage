const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Função para limpar número de telefone
function cleanPhoneNumber(phone: string): string {
  let cleanPhone = phone.replace(/\D/g, '');
  if (!cleanPhone.startsWith('55')) {
    cleanPhone = '55' + cleanPhone;
  }
  return cleanPhone;
}

// Função para validar número de telefone
function isValidPhoneNumber(phone: string): boolean {
  const cleanPhone = cleanPhoneNumber(phone);
  return cleanPhone.length >= 12 && cleanPhone.length <= 13;
}

async function processTemplate(
  supabase: any,
  templateType: string,
  appointmentId: string
): Promise<string | null> {
  try {
    // Get template
    const { data: template } = await supabase
      .from('triagem_notification_templates')
      .select('message_template')
      .eq('type', templateType)
      .eq('is_active', true)
      .maybeSingle();

    if (!template) {
      console.error('❌ Template não encontrado:', templateType);
      return null;
    }

    // Get appointment details
    const { data: appointment } = await supabase
      .from('triagem_appointments')
      .select(`
        *,
        client:clients(*)
      `)
      .eq('id', appointmentId)
      .maybeSingle();

    if (!appointment) {
      console.error('❌ Appointment não encontrado:', appointmentId);
      return null;
    }

    // Get settings
    const { data: settings } = await supabase
      .from('triagem_settings')
      .select('*')
      .limit(1)
      .maybeSingle();

    // Get session type
    const { data: sessionType } = await supabase
      .from('triagem_session_types')
      .select('*')
      .eq('name', appointment.session_type)
      .maybeSingle();

    const appointmentDate = new Date(appointment.scheduled_date);
    const clientName = appointment.client?.name || 'Cliente';

    const formatCurrency = (amount: number): string => {
      return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
      }).format(amount);
    };

    // Variables for template
    const variables: Record<string, string> = {
      client_name: clientName,
      amount: formatCurrency(appointment.total_amount),
      session_type: sessionType?.label || appointment.session_type,
      appointment_date: appointmentDate.toLocaleDateString('pt-BR', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'America/Sao_Paulo'
      }),
      appointment_time: appointmentDate.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'America/Sao_Paulo'
      }),
      studio_address: settings?.studio_address || '',
      studio_maps_url: settings?.studio_maps_url || '',
      delivery_days: (settings?.delivery_days || 7).toString(),
      price_per_photo: formatCurrency(settings?.price_commercial_hour || 30),
      minimum_photos: (appointment.minimum_photos || 5).toString(),
      gallery_link: ''
    };

    // Replace variables in template
    let message = template.message_template;
    Object.entries(variables).forEach(([key, value]) => {
      message = message.replace(new RegExp(`{{${key}}}`, 'g'), value);
    });

    return message;
  } catch (error) {
    console.error('❌ Erro ao processar template:', error);
    return null;
  }
}

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

    // Validar entrada
    if (!instanceName || !apiUrl || !apiKey || !phone || !message) {
      console.error('❌ Parâmetros obrigatórios faltando');
      return false;
    }

    // Limpar e validar telefone
    const cleanPhone = cleanPhoneNumber(phone);
    if (!isValidPhoneNumber(phone)) {
      console.error('❌ Número de telefone inválido:', phone, '→', cleanPhone);
      return false;
    }

    console.log('📱 Telefone limpo:', cleanPhone);
    console.log('📝 Tamanho da mensagem:', message.length, 'caracteres');

    const requestBody = {
      number: cleanPhone,
      text: message
    };

    console.log('🚀 Fazendo requisição para Evolution API...');

    const response = await fetch(`${apiUrl.replace(/\/$/, '')}/message/sendText/${instanceName}`, {
      method: 'POST',
      headers: {
        'apikey': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    console.log('📡 Status da resposta:', response.status);

    if (response.ok) {
      const responseData = await response.json();
      console.log('✅ Resposta da API:', responseData);
      return true;
    } else {
      let errorData;
      try {
        errorData = await response.json();
      } catch {
        errorData = { message: await response.text() };
      }
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
    console.log('🚀 Processando fila de notificações...');
    console.log('⏰ Timestamp:', new Date().toISOString());
    
    // Get Supabase client
    const { createClient } = await import('npm:@supabase/supabase-js@2');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get pending notifications that should be sent now
    const now = new Date();
    const nowISO = now.toISOString();
    console.log('⏰ Buscando notificações até:', nowISO);

    // Buscar apenas notificações pendentes agendadas para o passado
    const { data: notifications, error: notificationsError } = await supabase
      .from('triagem_notification_queue')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_for', nowISO)
      .order('scheduled_for', { ascending: true })
      .limit(10);

    if (notificationsError) {
      console.error('❌ Erro ao buscar notificações:', notificationsError);
      throw notificationsError;
    }

    console.log('📋 Notificações encontradas:', notifications?.length || 0);
    
    if (!notifications || notifications.length === 0) {
      console.log('ℹ️ Nenhuma notificação pendente encontrada');
      return new Response(
        JSON.stringify({ 
          success: true, 
          processed: 0,
          message: 'Nenhuma notificação pendente'
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      );
    }

    // Get active WhatsApp instance
    console.log('🔍 Buscando instâncias WhatsApp...');
    const { data: instances } = await supabase
      .from('triagem_whatsapp_instances')
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
          error: 'Nenhuma instância WhatsApp ativa encontrada',
          processed: 0,
          sent: 0,
          failed: notifications.length
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

    console.log('✅ Instância ativa:', activeInstance.instance_name);
    
    const { evolution_api_url, evolution_api_key } = activeInstance.instance_data;
    
    if (!evolution_api_url || !evolution_api_key) {
      console.error('❌ Credenciais WhatsApp não configuradas');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Credenciais WhatsApp não configuradas',
          processed: 0,
          sent: 0,
          failed: notifications.length
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
    
    let processed = 0;
    let sent = 0;
    let failed = 0;
    const results = [];

    // Process each notification
    for (const notification of notifications) {
      const startTime = Date.now();
      try {
        processed++;
        console.log(`📤 Processando notificação ${processed}/${notifications.length}:`);
        console.log('🆔 ID:', notification.id);
        console.log('👤 Para:', notification.recipient_name);
        console.log('📞 Telefone:', notification.recipient_phone);
        console.log('📝 Tipo:', notification.template_type);
        console.log('⏰ Agendada para:', notification.scheduled_for);
        
        // Marcar como processando para evitar duplicatas
        await supabase
          .from('triagem_notification_queue')
          .update({
            status: 'processing'
          })
          .eq('id', notification.id);

        // Processar template dinamicamente (busca template atualizado do banco)
        let messageToSend = notification.message;
        if (notification.template_type && notification.appointment_id) {
          console.log('🔄 Processando template dinâmico:', notification.template_type);
          const dynamicMessage = await processTemplate(
            supabase,
            notification.template_type,
            notification.appointment_id
          );

          if (dynamicMessage) {
            messageToSend = dynamicMessage;
            console.log('✅ Template atualizado aplicado');
          } else {
            console.log('⚠️ Usando mensagem original (fallback)');
          }
        }

        // Validar dados da notificação
        if (!notification.recipient_phone || !messageToSend) {
          console.error('❌ Dados da notificação inválidos');
          failed++;
          await supabase
            .from('triagem_notification_queue')
            .update({
              status: 'failed',
              error_message: 'Dados da notificação inválidos'
            })
            .eq('id', notification.id);
          continue;
        }

        const success = await sendWhatsAppMessage(
          activeInstance.instance_name,
          evolution_api_url,
          evolution_api_key,
          notification.recipient_phone,
          messageToSend
        );

        const processingTime = Date.now() - startTime;
        
        if (success) {
          sent++;
          console.log(`✅ Notificação enviada com sucesso (${processingTime}ms)`);
          await supabase
            .from('triagem_notification_queue')
            .update({
              status: 'sent',
              sent_at: new Date().toISOString()
            })
            .eq('id', notification.id);
            
          results.push({
            id: notification.id,
            status: 'sent',
            processing_time: processingTime
          });
        } else {
          failed++;
          console.log(`❌ Falha ao enviar notificação (${processingTime}ms)`);
          await supabase
            .from('triagem_notification_queue')
            .update({
              status: 'failed',
              error_message: 'Falha ao enviar via WhatsApp API'
            })
            .eq('id', notification.id);
            
          results.push({
            id: notification.id,
            status: 'failed',
            processing_time: processingTime,
            error: 'Falha no envio'
          });
        }
        
        // Pausa maior entre envios para evitar rate limiting e duplicatas
        if (processed < notifications.length) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
      } catch (error) {
        const processingTime = Date.now() - startTime;
        failed++;
        console.error(`❌ Erro ao processar notificação (${processingTime}ms):`, error);
        await supabase
          .from('triagem_notification_queue')
          .update({
            status: 'failed',
            error_message: error instanceof Error ? error.message : 'Unknown error'
          })
          .eq('id', notification.id);
          
        results.push({
          id: notification.id,
          status: 'failed',
          processing_time: processingTime,
          error: error instanceof Error ? error.message : 'Erro desconhecido'
        });
      }
    }

    console.log('📊 Resumo do processamento:');
    console.log('📤 Processadas:', processed);
    console.log('✅ Enviadas:', sent);
    console.log('❌ Falharam:', failed);
    console.log('⏱️ Tempo total:', Date.now() - Date.now(), 'ms');
    
    return new Response(
      JSON.stringify({
        success: true,
        processed,
        sent,
        failed,
        results,
        timestamp: new Date().toISOString()
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );

  } catch (error) {
    console.error('❌ Erro crítico no processamento de notificações:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: `Erro interno: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
        processed: 0,
        sent: 0,
        failed: 0,
        timestamp: new Date().toISOString()
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