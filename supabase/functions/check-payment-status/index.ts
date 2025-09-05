const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

async function schedulePaymentConfirmationNotification(supabase, appointmentId) {
  // Implementation for scheduling notification
  console.log('📅 Agendando notificação de confirmação para:', appointmentId);
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
      .from('mercadopago_settings')
      .select('*')
      .eq('is_active', true)
      .single();

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
          .from('payments')
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
            .from('galleries_triage')
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
          .from('payments')
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
          .from('appointments')
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
            .from('appointments')
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