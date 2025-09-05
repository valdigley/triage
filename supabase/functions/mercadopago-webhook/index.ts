const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

async function schedulePaymentConfirmationNotification(supabase: any, appointmentId: string): Promise<boolean> {
  try {
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
      console.error('Appointment not found for payment confirmation');
      return false;
    }

    // Get settings
    const { data: settings } = await supabase
      .from('settings')
      .select('delivery_days, studio_address, studio_maps_url, price_commercial_hour')
      .single();

    if (!settings) {
      console.error('Settings not found');
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
      console.error('Payment confirmation template not found or inactive');
      return false;
    }

    // Process template with variables
    let message = template.message_template;
    Object.entries(variables).forEach(([key, value]) => {
      message = message.replace(new RegExp(`{{${key}}}`, 'g'), value);
    });

    // Schedule immediate notification
    await supabase
      .from('notification_queue')
      .insert({
        appointment_id: appointmentId,
        template_type: 'payment_confirmation',
        recipient_phone: clientPhone,
        recipient_name: clientName,
        message,
        scheduled_for: new Date().toISOString()
      });

    console.log('Payment confirmation notification scheduled successfully');
    return true;
  } catch (error) {
    console.error('Error in schedulePaymentConfirmationNotification:', error);
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
    console.log('MercadoPago Webhook received:', JSON.stringify(webhookData, null, 2));

    // Get MercadoPago settings
    const { createClient } = await import('npm:@supabase/supabase-js@2');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: mpSettings } = await supabase
      .from('mercadopago_settings')
      .select('*')
      .eq('is_active', true)
      .single();

    if (!mpSettings || !mpSettings.access_token) {
      return new Response('MercadoPago settings not found', { status: 400 });
    }

    // Process payment notification
    if (webhookData.type === 'payment' || webhookData.action === 'payment.updated') {
      const paymentId = webhookData.data.id;
      
      console.log('Processing payment webhook for ID:', paymentId);
      
      // Get payment details from MercadoPago
      const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: {
          'Authorization': `Bearer ${mpSettings.access_token}`
        }
      });

      if (mpResponse.ok) {
        const paymentData = await mpResponse.json();
        console.log('Payment data from MercadoPago:', JSON.stringify(paymentData, null, 2));
        
        const appointmentId = paymentData.external_reference;
        console.log('External reference (appointment ID):', appointmentId);
        
        // Check if this is an extra photos payment (external_reference contains "-extra-")
        if (appointmentId && appointmentId.includes('-extra-')) {
          console.log('Processing extra photos payment webhook');
          
          // Extract the original appointment ID (before "-extra-")
          const originalAppointmentId = appointmentId.split('-extra-')[0];
          
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
            console.error('Error updating extra photos payment:', paymentUpdateError);
          } else {
            console.log('Extra photos payment status updated to:', paymentData.status);
          }

          // If payment is approved, update gallery with extra photos payment status
          if (paymentData.status === 'approved') {
            const { error: galleryUpdateError } = await supabase
              .from('galleries_triage')
              .update({
                extra_photos_payment_status: 'approved',
                updated_at: new Date().toISOString()
              })
              .eq('extra_photos_payment_id', paymentId.toString());
            
            if (galleryUpdateError) {
              console.error('Error updating gallery for extra photos:', galleryUpdateError);
            } else {
              console.log('Gallery updated for approved extra photos payment');
            }
            
            console.log('Extra photos payment approved and gallery updated');
          }
        } else {
          // Regular appointment payment
          console.log('Processing regular appointment payment webhook');
          
          // Update payment status in database
          const { error: paymentUpdateError } = await supabase
            .from('payments')
            .update({
              status: paymentData.status,
              webhook_data: paymentData,
              updated_at: new Date().toISOString()
            })
            .eq('appointment_id', appointmentId);
          
          if (paymentUpdateError) {
            console.error('Error updating payment in database:', paymentUpdateError);
          } else {
            console.log('Payment status updated in database to:', paymentData.status);
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
            console.error('Error updating appointment payment status:', appointmentPaymentError);
          } else {
            console.log('Appointment payment status updated to:', paymentData.status);
          }

          // If payment is approved, confirm appointment
          if (paymentData.status === 'approved') {
            const { error: appointmentStatusError } = await supabase
              .from('appointments')
              .update({
                status: 'confirmed',
                updated_at: new Date().toISOString()
              })
              .eq('id', appointmentId);
            
            if (appointmentStatusError) {
              console.error('Error confirming appointment:', appointmentStatusError);
            } else {
              console.log('Appointment confirmed successfully');
            }
            
            // Schedule payment confirmation notification
            try {
              await schedulePaymentConfirmationNotification(supabase, appointmentId);
              console.log('Payment confirmation notification scheduled');
            } catch (error) {
              console.error('Error sending payment confirmation:', error);
            }
            
            // Note: The database trigger will automatically create a gallery
            // when the appointment status changes to 'confirmed'
          }
        }
      } else {
        const errorText = await mpResponse.text();
        console.error('Error fetching payment from MercadoPago:', mpResponse.status, errorText);
      }
    } else {
      console.log('Webhook type not handled:', webhookData.type);
    }

    return new Response('OK', { 
      status: 200,
      headers: corsHeaders 
    });

  } catch (error) {
    console.error('Webhook error:', error);
    return new Response('Error processing webhook', { 
      status: 500,
      headers: corsHeaders 
    });
  }
});