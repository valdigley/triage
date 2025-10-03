const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
}

async function schedulePaymentConfirmationNotification(supabase, appointmentId) {
  try {
    console.log('📅 Agendando notificação de confirmação para:', appointmentId);
    
    // Get appointment details
    const { data: appointment, error: appointmentError } = await supabase
      .from('triagem_appointments')
      .select(`
        *,
        client_id (
          name,
          phone
        )
      `)
      .eq('id', appointmentId)
      .single();

    if (appointmentError || !appointment) {
      console.error('❌ Erro ao buscar appointment:', appointmentError);
      return;
    }

    // Get notification template
    const { data: template, error: templateError } = await supabase
      .from('triagem_notification_templates')
      .select('*')
      .eq('type', 'payment_confirmation')
      .eq('is_active', true)
      .single();

    if (templateError || !template) {
      console.log('⚠️ Template de confirmação de pagamento não encontrado');
      return;
    }

    // Format message
    const scheduledDate = new Date(appointment.scheduled_date);
    const formattedDate = scheduledDate.toLocaleDateString('pt-BR');
    const formattedTime = scheduledDate.toLocaleTimeString('pt-BR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    const formattedAmount = formatCurrency(appointment.total_amount);

    let message = template.message_template
      .replace('{cliente_nome}', appointment.client_id?.name || 'Cliente')
      .replace('{data_sessao}', formattedDate)
      .replace('{horario_sessao}', formattedTime)
      .replace('{tipo_sessao}', appointment.session_type)
      .replace('{valor_total}', formattedAmount);

    // Schedule notification for immediate sending
    const { error: notificationError } = await supabase
      .from('triagem_notification_queue')
      .insert({
        appointment_id: appointmentId,
        template_type: 'payment_confirmation',
        recipient_phone: appointment.client_id?.phone,
        recipient_name: appointment.client_id?.name || 'Cliente',
        message: message,
        scheduled_for: new Date().toISOString()
      });

    if (notificationError) {
      console.error('❌ Erro ao agendar notificação:', notificationError);
    } else {
      console.log('✅ Notificação de confirmação agendada com sucesso');
    }
  } catch (error) {
    console.error('❌ Erro ao processar notificação de confirmação:', error);
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
    const url = new URL(req.url);
    const paymentId = url.searchParams.get('payment_id');

    if (!paymentId) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'payment_id é obrigatório' 
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

    console.log('🔍 Verificando status do pagamento:', paymentId);

    // Get Supabase client
    const { createClient } = await import('npm:@supabase/supabase-js@2');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get MercadoPago settings
    const { data: mpSettings, error: mpError } = await supabase
      .from('triagem_mercadopago_settings')
      .select('*')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    if (mpError || !mpSettings || !mpSettings.access_token) {
      console.error('❌ Configurações MercadoPago não encontradas');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Configurações do MercadoPago não encontradas' 
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

    // Check payment status with MercadoPago
    console.log('📡 Consultando MercadoPago API...');
    const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${mpSettings.access_token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!mpResponse.ok) {
      const errorData = await mpResponse.json();
      console.error('❌ Erro da API MercadoPago:', errorData);
      return new Response(
        JSON.stringify({
          success: false,
          error: `Erro do MercadoPago: ${errorData.message || 'Erro desconhecido'}`
        }),
        {
          status: mpResponse.status,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      );
    }

    const paymentData = await mpResponse.json();
    console.log('💰 Status atual no MercadoPago:', paymentData.status);
    console.log('🔗 External reference:', paymentData.external_reference);
    
    // Update payment status in database if changed
    if (paymentData.external_reference) {
      const appointmentId = paymentData.external_reference;
      
      // Check if this is an extra photos payment
      if (appointmentId.includes('-extra-')) {
        console.log('📸 Atualizando pagamento de fotos extras...');
        
        // Update payment status for extra photos
        const { error: paymentUpdateError } = await supabase
          .from('triagem_payments')
          .update({
            status: paymentData.status,
            webhook_data: paymentData,
            updated_at: new Date().toISOString()
          })
          .eq('mercadopago_id', paymentId.toString());
          
        if (paymentUpdateError) {
          console.error('❌ Erro ao atualizar pagamento de fotos extras:', paymentUpdateError);
        } else {
          console.log('✅ Pagamento de fotos extras atualizado');
        }

        // If payment is approved, update gallery
        if (paymentData.status === 'approved') {
          const originalAppointmentId = appointmentId.split('-extra-')[0];
          
          const { error: galleryUpdateError } = await supabase
            .from('triagem_galleries')
            .update({
              updated_at: new Date().toISOString()
            })
            .eq('appointment_id', originalAppointmentId);
          
          if (galleryUpdateError) {
            console.error('❌ Erro ao atualizar galeria:', galleryUpdateError);
          } else {
            console.log('✅ Galeria atualizada para fotos extras aprovadas');
          }
        }
      } else {
        console.log('📅 Atualizando pagamento de agendamento regular...');
        
        // Update payment status in database
        const { error: paymentUpdateError } = await supabase
          .from('triagem_payments')
          .update({
            status: paymentData.status,
            webhook_data: paymentData,
            updated_at: new Date().toISOString()
          })
          .or(`appointment_id.eq.${appointmentId},mercadopago_id.eq.${paymentId}`);
          
        if (paymentUpdateError) {
          console.error('❌ Erro ao atualizar pagamento:', paymentUpdateError);
        } else {
          console.log('✅ Pagamento atualizado no banco');
        }

        // Update appointment payment status
        const { error: appointmentPaymentError } = await supabase
          .from('triagem_appointments')
          .update({
            payment_status: paymentData.status,
            updated_at: new Date().toISOString()
          })
          .eq('id', appointmentId);
        
        if (appointmentPaymentError) {
          console.error('❌ Erro ao atualizar status de pagamento do appointment:', appointmentPaymentError);
        } else {
          console.log('✅ Status de pagamento do appointment atualizado');
        }

        // If payment is approved, confirm appointment
        if (paymentData.status === 'approved') {
          console.log('✅ Pagamento aprovado - confirmando appointment...');
          
          const { error: appointmentStatusError } = await supabase
            .from('triagem_appointments')
            .update({
              status: 'confirmed',
              updated_at: new Date().toISOString()
            })
            .eq('id', appointmentId);
          
          if (appointmentStatusError) {
            console.error('❌ Erro ao confirmar appointment:', appointmentStatusError);
          } else {
            console.log('✅ Appointment confirmado automaticamente');
          }
          
          // Schedule payment confirmation notification
          try {
            await schedulePaymentConfirmationNotification(supabase, appointmentId);
          } catch (error) {
            console.error('❌ Erro ao agendar notificação de confirmação:', error);
          }
        }
      }
    } else {
      console.log('ℹ️ Tipo de webhook não processado:', paymentData.type || paymentData.action);
    }

    return new Response(
      JSON.stringify({
        success: true,
        status: paymentData.status,
        payment_id: paymentId
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );

  } catch (error) {
    console.error('❌ Erro crítico no webhook:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: `Webhook processing error: ${error instanceof Error ? error.message : 'Unknown error'}`
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