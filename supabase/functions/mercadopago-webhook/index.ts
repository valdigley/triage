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
      .limit(1)
      .maybeSingle();

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
    console.log('🔔 =================================');
    console.log('🔔 WEBHOOK MERCADOPAGO RECEBIDO');
    console.log('🔔 =================================');
    console.log('⏰ Timestamp:', new Date().toISOString());
    console.log('🌐 URL:', req.url);
    console.log('📡 Method:', req.method);
    
    const webhookData = await req.json();
    console.log('📦 Webhook Data Completo:', JSON.stringify(webhookData, null, 2));

    // Get Supabase client
    const { createClient } = await import('npm:@supabase/supabase-js@2');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('🔗 Supabase client criado');

    // Get MercadoPago settings
    const { data: mpSettings, error: mpError } = await supabase
      .from('mercadopago_settings')
      .select('*')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    if (mpError || !mpSettings || !mpSettings.access_token) {
      console.error('❌ Configurações MercadoPago não encontradas:', mpError);
      return new Response('MercadoPago settings not found', { 
        status: 400,
        headers: corsHeaders 
      });
    }

    console.log('✅ Configurações MercadoPago carregadas');
    console.log('🌍 Environment:', mpSettings.environment);

    // Detectar tipo de webhook - MercadoPago pode enviar diferentes formatos
    let paymentId = null;
    let webhookType = null;

    // Formato 1: { type: "payment", data: { id: "123" } }
    if (webhookData.type === 'payment' && webhookData.data?.id) {
      paymentId = webhookData.data.id;
      webhookType = 'payment';
    }
    // Formato 2: { action: "payment.updated", data: { id: "123" } }
    else if (webhookData.action === 'payment.updated' && webhookData.data?.id) {
      paymentId = webhookData.data.id;
      webhookType = 'payment.updated';
    }
    // Formato 3: { id: "123", topic: "payment" }
    else if (webhookData.id && webhookData.topic === 'payment') {
      paymentId = webhookData.id;
      webhookType = 'payment.topic';
    }
    // Formato 4: Direto o ID como string
    else if (typeof webhookData === 'string') {
      paymentId = webhookData;
      webhookType = 'direct.id';
    }

    console.log('🔍 Webhook detectado:');
    console.log('📝 Tipo:', webhookType);
    console.log('🆔 Payment ID:', paymentId);

    if (!paymentId) {
      console.error('❌ Payment ID não encontrado no webhook');
      console.log('📦 Estrutura recebida:', Object.keys(webhookData));
      return new Response('Payment ID not found', { 
        status: 400,
        headers: corsHeaders 
      });
    }
    
    console.log('💳 ===== PROCESSANDO PAGAMENTO =====');
    console.log('🆔 Payment ID:', paymentId);
    console.log('📝 Webhook Type:', webhookType);
    
    // Get payment details from MercadoPago API
    console.log('🔍 Consultando MercadoPago API...');
    const mpApiUrl = `https://api.mercadopago.com/v1/payments/${paymentId}`;
    console.log('🌐 URL da API:', mpApiUrl);
    
    const mpResponse = await fetch(mpApiUrl, {
      headers: {
        'Authorization': `Bearer ${mpSettings.access_token}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('📡 Status da resposta MP:', mpResponse.status);

    if (!mpResponse.ok) {
      const errorText = await mpResponse.text();
      console.error('❌ Erro ao buscar pagamento do MercadoPago:', mpResponse.status, errorText);
      return new Response(`MercadoPago API error: ${mpResponse.status}`, { 
        status: mpResponse.status,
        headers: corsHeaders 
      });
    }

    const paymentData = await mpResponse.json();
    console.log('💰 ===== DADOS DO PAGAMENTO =====');
    console.log('🆔 ID:', paymentData.id);
    console.log('📊 Status:', paymentData.status);
    console.log('💵 Valor:', paymentData.transaction_amount);
    console.log('💳 Método:', paymentData.payment_method_id);
    console.log('🔗 External Reference:', paymentData.external_reference);
    console.log('📅 Data Criação:', paymentData.date_created);
    console.log('✅ Data Aprovação:', paymentData.date_approved);
    console.log('📋 Status Detail:', paymentData.status_detail);
    
    const appointmentId = paymentData.external_reference;
    console.log('🎯 Appointment ID extraído:', appointmentId);

    if (!appointmentId) {
      console.error('❌ External reference não encontrado no pagamento');
      return new Response('External reference not found', {
        status: 400,
        headers: corsHeaders
      });
    }

    // Check if this is a public gallery payment
    if (appointmentId.startsWith('public-')) {
      console.log('🎉 ===== PAGAMENTO DE GALERIA PÚBLICA =====');

      // Only process approved payments
      if (paymentData.status === 'approved' && paymentData.metadata) {
        console.log('✅ Pagamento aprovado - criando galeria individual...');

        const metadata = paymentData.metadata;
        const parentGalleryId = metadata.parent_gallery_id;
        const clientName = metadata.client_name;
        const clientPhone = metadata.client_phone;
        const clientEmail = metadata.client_email;
        const selectedPhotos = JSON.parse(metadata.selected_photos || '[]');
        const eventName = metadata.event_name;

        try {
          // 1. Create or get client
          let clientId: string;
          const { data: existingClient } = await supabase
            .from('clients')
            .select('id')
            .eq('phone', clientPhone)
            .maybeSingle();

          if (existingClient) {
            clientId = existingClient.id;
            console.log('✅ Cliente existente encontrado:', clientId);
          } else {
            const { data: newClient, error: clientError } = await supabase
              .from('clients')
              .insert([{
                name: clientName,
                phone: clientPhone,
                email: clientEmail || null,
                total_spent: 0
              }])
              .select()
              .single();

            if (clientError) throw clientError;
            clientId = newClient.id;
            console.log('✅ Novo cliente criado:', clientId);
          }

          // 2. Get parent gallery expiration
          const { data: parentGallery } = await supabase
            .from('galleries_triage')
            .select('link_expires_at')
            .eq('id', parentGalleryId)
            .single();

          // 3. Create individual gallery (without appointment)
          const { data: individualGallery, error: galleryError } = await supabase
            .from('galleries_triage')
            .insert([{
              client_id: clientId,
              parent_gallery_id: parentGalleryId,
              name: `${eventName} - ${clientName}`,
              password: null,
              link_expires_at: parentGallery?.link_expires_at || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
              status: 'completed',
              photos_selected: selectedPhotos,
              payment_status: 'paid'
            }])
            .select()
            .single();

          if (galleryError) throw galleryError;
          console.log('✅ Galeria individual criada:', individualGallery.id);

          // 4. Create payment record (without appointment)
          const { error: paymentError } = await supabase
            .from('payments')
            .insert({
              client_id: clientId,
              gallery_id: individualGallery.id,
              mercadopago_id: paymentId.toString(),
              amount: paymentData.transaction_amount,
              status: paymentData.status,
              payment_type: 'public_gallery',
              webhook_data: paymentData
            });

          if (paymentError) {
            console.error('❌ Erro ao criar registro de pagamento:', paymentError);
          } else {
            console.log('✅ Registro de pagamento criado');
          }

          console.log('🎉 ===== GALERIA PÚBLICA PROCESSADA COM SUCESSO =====');

        } catch (error) {
          console.error('❌ Erro ao processar galeria pública:', error);
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Check if this is an extra photos payment
    if (appointmentId.includes('-extra-')) {
      console.log('📸 ===== PAGAMENTO DE FOTOS EXTRAS =====');
      
      const originalAppointmentId = appointmentId.split('-extra-')[0];
      console.log('🆔 Appointment ID original:', originalAppointmentId);
      
      // Update payment status in database
      console.log('💾 Atualizando pagamento de fotos extras no banco...');
      const { data: updatedPayment, error: paymentUpdateError } = await supabase
        .from('payments')
        .update({
          status: paymentData.status,
          webhook_data: paymentData,
          updated_at: new Date().toISOString()
        })
        .eq('mercadopago_id', paymentId.toString())
        .select();
      
      if (paymentUpdateError) {
        console.error('❌ Erro ao atualizar pagamento de fotos extras:', paymentUpdateError);
      } else {
        console.log('✅ Pagamento de fotos extras atualizado:', updatedPayment?.length || 0, 'registros');
        console.log('📊 Novo status:', paymentData.status);
      }

      // If payment is approved, update gallery
      if (paymentData.status === 'approved') {
        console.log('✅ Pagamento de fotos extras aprovado - atualizando galeria...');
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
      console.log('📅 ===== PAGAMENTO DE AGENDAMENTO REGULAR =====');
      
      // Update payment status in database using multiple criteria for robustness
      console.log('💾 Atualizando pagamento no banco de dados...');
      console.log('🔍 Critérios de busca:');
      console.log('   - appointment_id:', appointmentId);
      console.log('   - mercadopago_id:', paymentId);
      
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
        console.log('✅ Pagamentos atualizados no banco:', updatedPayments?.length || 0, 'registros');
        updatedPayments?.forEach((payment, index) => {
          console.log(`   ${index + 1}. ID: ${payment.id}, Status: ${payment.status}`);
        });
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
        console.log('✅ Appointment payment status atualizado:');
        console.log('   - ID:', updatedAppointment.id);
        console.log('   - Payment Status:', updatedAppointment.payment_status);
        console.log('   - Appointment Status:', updatedAppointment.status);
      }

      // If payment is approved, confirm appointment
      if (paymentData.status === 'approved') {
        console.log('✅ ===== PAGAMENTO APROVADO =====');
        console.log('🎯 Confirmando appointment automaticamente...');
        
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
          console.log('✅ Appointment confirmado automaticamente:');
          console.log('   - ID:', confirmedAppointment.id);
          console.log('   - Status:', confirmedAppointment.status);
          console.log('   - Payment Status:', confirmedAppointment.payment_status);
        }
        
        // Schedule payment confirmation notification
        try {
          console.log('📧 Agendando notificação de confirmação...');
          const notificationSuccess = await schedulePaymentConfirmationNotification(supabase, appointmentId);
          if (notificationSuccess) {
            console.log('✅ Notificação de confirmação agendada com sucesso');
          } else {
            console.error('❌ Falha ao agendar notificação de confirmação');
          }
        } catch (notificationError) {
          console.error('❌ Erro ao agendar notificação:', notificationError);
        }
        
        // Note: The database trigger will automatically create a gallery
        // when the appointment status changes to 'confirmed'
        console.log('🎨 Galeria será criada automaticamente pelo trigger do banco');
        
      } else if (paymentData.status === 'rejected') {
        console.log('❌ Pagamento rejeitado - mantendo status pendente');
      } else if (paymentData.status === 'cancelled') {
        console.log('🚫 Pagamento cancelado');
      } else if (paymentData.status === 'in_process' || paymentData.status === 'pending') {
        console.log('⏳ Pagamento em processamento - aguardando confirmação');
      } else {
        console.log(`ℹ️ Status não processado: ${paymentData.status}`);
      }
    }

    console.log('✅ ===== WEBHOOK PROCESSADO COM SUCESSO =====');
    return new Response('OK', { 
      status: 200,
      headers: corsHeaders 
    });

  } catch (error) {
    console.error('❌ ===== ERRO CRÍTICO NO WEBHOOK =====');
    console.error('❌ Erro:', error);
    console.error('❌ Stack:', error instanceof Error ? error.stack : 'No stack trace');
    
    return new Response(`Webhook error: ${error instanceof Error ? error.message : 'Unknown error'}`, { 
      status: 500,
      headers: corsHeaders 
    });
  }
});