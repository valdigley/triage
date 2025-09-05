const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

async function schedulePaymentConfirmationNotification(supabase: any, appointmentId: string): Promise<boolean> {
  try {
    console.log('📧 Agendando notificação de confirmação de pagamento para appointment:', appointmentId);
    
    // Get appointment details
    const { data: appointment, error: appointmentError } = await supabase
      .from('appointments')
      .select(`
        *,
        client:clients(*)
      `)
      .eq('id', appointmentId)
      .single();

    if (appointmentError || !appointment) {
      console.error('❌ Appointment não encontrado:', appointmentError);
      return false;
    }

    // Get settings
    const { data: settings } = await supabase
      .from('settings')
      .select('delivery_days, studio_address, studio_maps_url, price_commercial_hour, studio_name, studio_phone')
      .single();

    if (!settings) {
      console.error('❌ Settings não encontradas');
      return false;
    }

    // Get session type details
    const { data: sessionType } = await supabase
      .from('session_types')
      .select('*')
      .eq('name', appointment.session_type)
      .single();

    const appointmentDate = new Date(appointment.scheduled_date);
    const clientName = appointment.client?.name || 'Cliente';
    const clientPhone = appointment.client?.phone || '';
    
    // Format currency
    const formatCurrency = (amount: number): string => {
      return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
      }).format(amount);
    };
    
    // Variables for template processing
    const variables = {
      client_name: clientName,
      amount: formatCurrency(appointment.total_amount),
      session_type: sessionType?.label || appointment.session_type,
      appointment_date: appointmentDate.toLocaleDateString('pt-BR', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }),
      appointment_time: appointmentDate.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit'
      }),
      studio_address: settings.studio_address || '',
      studio_maps_url: settings.studio_maps_url || '',
      delivery_days: (settings.delivery_days || 7).toString(),
      price_per_photo: formatCurrency(settings.price_commercial_hour || 30),
      minimum_photos: (appointment.minimum_photos || 5).toString(),
      studio_name: settings.studio_name || '',
      studio_phone: settings.studio_phone || ''
    };

    // Get payment confirmation template
    const { data: template, error: templateError } = await supabase
      .from('notification_templates')
      .select('message_template')
      .eq('type', 'payment_confirmation')
      .eq('is_active', true)
      .single();

    if (templateError || !template) {
      console.error('❌ Template payment_confirmation não encontrado:', templateError);
      return false;
    }

    // Process template with variables
    let message = template.message_template;
    Object.entries(variables).forEach(([key, value]) => {
      message = message.replace(new RegExp(`{{${key}}}`, 'g'), value);
    });

    // Schedule immediate notification
    const { error: queueError } = await supabase
      .from('notification_queue')
      .insert({
        appointment_id: appointmentId,
        template_type: 'payment_confirmation',
        recipient_phone: clientPhone,
        recipient_name: clientName,
        message,
        scheduled_for: new Date().toISOString()
      });

    if (queueError) {
      console.error('❌ Erro ao agendar notificação:', queueError);
      return false;
    }

    console.log('✅ Notificação de confirmação de pagamento agendada');
    return true;
  } catch (error) {
    console.error('❌ Erro em schedulePaymentConfirmationNotification:', error);
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
    const webhookData = await req.json();
    console.log('🔔 MercadoPago Webhook recebido:', JSON.stringify(webhookData, null, 2));

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
      console.error('❌ Configurações MercadoPago não encontradas:', mpError);
      return new Response('MercadoPago settings not found', { 
        status: 400,
        headers: corsHeaders 
      });
    }

    console.log('✅ Configurações MercadoPago carregadas');

    // Process payment notification
    if (webhookData.type === 'payment' || webhookData.action === 'payment.updated') {
      const paymentId = webhookData.data?.id;
      
      if (!paymentId) {
        console.error('❌ Payment ID não encontrado no webhook');
        return new Response('Payment ID not found', { 
          status: 400,
          headers: corsHeaders 
        });
      }
      
      console.log('💳 Processando webhook de pagamento para ID:', paymentId);
      
      // Get payment details from MercadoPago
      console.log('🔍 Buscando detalhes do pagamento no MercadoPago...');
      const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: {
          'Authorization': `Bearer ${mpSettings.access_token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!mpResponse.ok) {
        const errorText = await mpResponse.text();
        console.error('❌ Erro ao buscar pagamento do MercadoPago:', mpResponse.status, errorText);
        return new Response(`MercadoPago API error: ${mpResponse.status}`, { 
          status: mpResponse.status,
          headers: corsHeaders 
        });
      }

      const paymentData = await mpResponse.json();
      console.log('💰 Dados do pagamento obtidos:', {
        id: paymentData.id,
        status: paymentData.status,
        external_reference: paymentData.external_reference,
        payment_method_id: paymentData.payment_method_id,
        transaction_amount: paymentData.transaction_amount
      });
      
      const appointmentId = paymentData.external_reference;
      console.log('🔗 External reference (appointment ID):', appointmentId);
      
      if (!appointmentId) {
        console.error('❌ External reference não encontrado no pagamento');
        return new Response('External reference not found', { 
          status: 400,
          headers: corsHeaders 
        });
      }
      
      // Check if this is an extra photos payment
      if (appointmentId.includes('-extra-')) {
        console.log('📸 Processando pagamento de fotos extras');
        
        const originalAppointmentId = appointmentId.split('-extra-')[0];
        console.log('🆔 Appointment ID original:', originalAppointmentId);
        
        // Update payment status in database
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
          console.log('✅ Status do pagamento de fotos extras atualizado para:', paymentData.status);
        }

        // If payment is approved, update gallery
        if (paymentData.status === 'approved') {
          const { error: galleryUpdateError } = await supabase
            .from('galleries_triage')
            .update({
              updated_at: new Date().toISOString()
            })
            .eq('appointment_id', originalAppointmentId);
          
          if (galleryUpdateError) {
            console.error('❌ Erro ao atualizar galeria para fotos extras:', galleryUpdateError);
          } else {
            console.log('✅ Galeria atualizada para pagamento aprovado de fotos extras');
          }
        }
      } else {
        // Regular appointment payment
        console.log('📅 Processando pagamento de agendamento regular');
        
        // Update payment status in database using both appointment_id and mercadopago_id
        console.log('💾 Atualizando status do pagamento no banco...');
        const { data: updatedPayments, error: paymentUpdateError } = await supabase
          .from('payments')
          .update({
            status: paymentData.status,
            webhook_data: paymentData,
            updated_at: new Date().toISOString()
          })
          .or(`appointment_id.eq.${appointmentId},mercadopago_id.eq.${paymentId}`)
          .select();
        
        if (paymentUpdateError) {
          console.error('❌ Erro ao atualizar pagamento no banco:', paymentUpdateError);
        } else {
          console.log('✅ Pagamentos atualizados:', updatedPayments?.length || 0);
          console.log('📊 Status atualizado para:', paymentData.status);
        }

        // Update appointment payment status
        console.log('📋 Atualizando status do pagamento no appointment...');
        const { data: updatedAppointment, error: appointmentPaymentError } = await supabase
          .from('appointments')
          .update({
            payment_status: paymentData.status,
            updated_at: new Date().toISOString()
          })
          .eq('id', appointmentId)
          .select()
          .single();
        
        if (appointmentPaymentError) {
          console.error('❌ Erro ao atualizar status de pagamento do appointment:', appointmentPaymentError);
        } else {
          console.log('✅ Status de pagamento do appointment atualizado para:', paymentData.status);
        }

        // If payment is approved, confirm appointment
        if (paymentData.status === 'approved') {
          console.log('✅ Pagamento aprovado - confirmando appointment...');
          
          const { data: confirmedAppointment, error: appointmentStatusError } = await supabase
            .from('appointments')
            .update({
              status: 'confirmed',
              updated_at: new Date().toISOString()
            })
            .eq('id', appointmentId)
            .select()
            .single();
          
          if (appointmentStatusError) {
            console.error('❌ Erro ao confirmar appointment:', appointmentStatusError);
          } else {
            console.log('✅ Appointment confirmado com sucesso');
          }
          
          // Schedule payment confirmation notification
          try {
            console.log('📧 Agendando notificação de confirmação...');
            await schedulePaymentConfirmationNotification(supabase, appointmentId);
            console.log('✅ Notificação de confirmação agendada');
          } catch (notificationError) {
            console.error('❌ Erro ao agendar notificação:', notificationError);
          }
          
          // Note: The database trigger will automatically create a gallery
          // when the appointment status changes to 'confirmed'
          console.log('🎨 Galeria será criada automaticamente pelo trigger do banco');
        } else {
          console.log(`ℹ️ Pagamento com status: ${paymentData.status} - não confirmando appointment ainda`);
        }
      }
    } else {
      console.log('ℹ️ Tipo de webhook não processado:', webhookData.type || webhookData.action);
    }

    console.log('✅ Webhook processado com sucesso');
    return new Response('OK', { 
      status: 200,
      headers: corsHeaders 
    });

  } catch (error) {
    console.error('❌ Erro crítico no webhook:', error);
    return new Response(`Webhook error: ${error instanceof Error ? error.message : 'Unknown error'}`, { 
      status: 500,
      headers: corsHeaders 
    });
  }
});