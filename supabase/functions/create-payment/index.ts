import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function generateToken(length: number = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  const randomValues = new Uint8Array(length);
  crypto.getRandomValues(randomValues);
  for (let i = 0; i < length; i++) {
    token += chars[randomValues[i] % chars.length];
  }
  return token;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { createClient } = await import('npm:@supabase/supabase-js@2');
    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const { formData, amount, clientName, clientEmail, sessionType, deviceId, tenant_id } = await req.json();

    if (!formData || !amount) {
      return new Response(JSON.stringify({ success: false, error: 'formData e amount são obrigatórios' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    if (!tenant_id) {
      return new Response(JSON.stringify({ success: false, error: 'tenant_id é obrigatório' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    const tenantId = tenant_id;
    console.log('✅ Tenant ID recebido:', tenantId);

    // Criar ou atualizar cliente
    const { data: existingClient } = await supabase.from('triagem_clients').select('*').eq('phone', formData.clientPhone).eq('tenant_id', tenantId).maybeSingle();
    let clientId: string;

    if (existingClient) {
      clientId = existingClient.id;
      await supabase.from('triagem_clients').update({ name: formData.clientName, email: formData.clientEmail, updated_at: new Date().toISOString() }).eq('id', clientId);
    } else {
      const { data: newClient, error: clientError } = await supabase.from('triagem_clients').insert([{ name: formData.clientName, email: formData.clientEmail, phone: formData.clientPhone, tenant_id: tenantId }]).select().single();
      if (clientError) throw clientError;
      clientId = newClient.id;
    }

    const { data: settings } = await supabase
      .from('triagem_settings')
      .select('pix_key, studio_name, link_validity_days, minimum_photos')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    // VERIFICAR MERCADOPAGO **PRIMEIRO**
    console.log('🔍 Verificando configurações do MercadoPago...');
    const { data: mpSettingsFull, error: mpFullError } = await supabase
      .from('triagem_mercadopago_settings')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    // ==============================================
    // FLUXO SEM MERCADOPAGO (PIX MANUAL)
    // ==============================================
    if (mpFullError || !mpSettingsFull || !mpSettingsFull.access_token) {
      console.log('⚠️ MercadoPago não configurado - fluxo PIX manual');
      console.log('📝 Criando agendamento com status pending...');

      // Criar agendamento APENAS quando NÃO tem MercadoPago
      const { data: appointment, error: appointmentError } = await supabase
        .from('triagem_appointments')
        .insert([{
          client_id: clientId,
          tenant_id: tenantId,
          session_type: formData.sessionType,
          session_details: formData.sessionDetails,
          scheduled_date: formData.scheduledDate,
          total_amount: amount,
          minimum_photos: 5,
          terms_accepted: formData.termsAccepted,
          status: 'pending',
          payment_status: 'pending'
        }])
        .select()
        .single();

      if (appointmentError) throw appointmentError;
      console.log('✅ Agendamento criado:', appointment.id);

      // Criar galeria
      const galleryToken = generateToken(32);
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + (settings?.link_validity_days || 30));

      const { data: gallery, error: galleryError } = await supabase
        .from('triagem_galleries')
        .insert([{
          appointment_id: appointment.id,
          client_id: clientId,
          tenant_id: tenantId,
          name: `Galeria - ${formData.clientName}`,
          gallery_token: galleryToken,
          link_expires_at: expiresAt.toISOString(),
          is_public: false,
          status: 'pending'
        }])
        .select()
        .single();

      if (galleryError) {
        console.error('❌ Erro ao criar galeria:', galleryError);
      } else {
        console.log('✅ Galeria criada:', gallery?.id);
      }

      // Criar pagamento pendente
      const { error: paymentPendingError } = await supabase
        .from('triagem_payments')
        .insert([{
          appointment_id: appointment.id,
          client_id: clientId,
          tenant_id: tenantId,
          amount: amount,
          status: 'pending',
          payment_type: 'initial'
        }]);

      if (paymentPendingError) {
        console.error('❌ Erro ao criar pagamento pendente:', paymentPendingError);
      }

      // Enviar notificação com PIX manual
      const pixKey = settings?.pix_key;
      const studioName = settings?.studio_name || 'Estúdio';

      if (pixKey && formData.clientPhone) {
        console.log('📲 Agendando notificação com chave PIX...');

        const sessionTypeLabels = {
          'aniversario': 'Sessão de Aniversário',
          'gestante': 'Ensaio Gestante',
          'formatura': 'Sessão de Formatura',
          'comercial': 'Sessão Comercial',
          'pre_wedding': 'Ensaio Pré-Wedding',
          'tematico': 'Sessão Temática'
        };
        const sessionLabel = sessionTypeLabels[formData.sessionType] || formData.sessionType;

        const appointmentDate = new Date(formData.scheduledDate);
        const formattedDate = appointmentDate.toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          timeZone: 'America/Sao_Paulo'
        });
        const formattedTime = appointmentDate.toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'America/Sao_Paulo'
        });

        try {
          const { error: notifError } = await supabase
            .from('triagem_notification_queue')
            .insert({
              appointment_id: appointment.id,
              tenant_id: tenantId,
              template_type: 'pix_appointment',
              recipient_phone: formData.clientPhone,
              recipient_name: clientName,
              scheduled_for: new Date().toISOString(),
              template_data: {
                client_name: clientName,
                studio_name: studioName,
                pix_key: pixKey,
                amount: `R$ ${(amount / 100).toFixed(2)}`,
                session_type: sessionLabel,
                appointment_date: formattedDate,
                appointment_time: formattedTime
              },
              status: 'pending'
            });

          if (notifError) {
            console.error('❌ Erro ao agendar notificação:', notifError);
          } else {
            console.log('✅ Notificação agendada');
          }
        } catch (error) {
          console.error('❌ Erro ao agendar notificação:', error);
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          appointment_id: appointment.id,
          gallery_id: gallery?.id,
          gallery_token: galleryToken,
          no_payment_configured: true,
          pix_key: pixKey,
          message: 'Agendamento criado. Aguardando confirmação de pagamento.'
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        }
      );
    }

    // ==============================================
    // FLUXO COM MERCADOPAGO
    // ==============================================
    console.log('💳 MercadoPago configurado - criando pagamento PIX...');
    console.log('⚠️ Agendamento será criado APENAS após confirmação do pagamento');

    // Gerar ID temporário para o pagamento (será usado como external_reference)
    const tempPaymentId = `temp-${crypto.randomUUID()}`;

    const nameParts = clientName.trim().split(' ');
    const firstName = nameParts[0] || 'Cliente';
    const lastName = nameParts.slice(1).join(' ') || 'Sobrenome';
    const sessionTypeLabels = {
      'aniversario': 'Sessão de Aniversário',
      'gestante': 'Ensaio Gestante',
      'formatura': 'Sessão de Formatura',
      'comercial': 'Sessão Comercial',
      'pre_wedding': 'Ensaio Pré-Wedding',
      'tematico': 'Sessão Temática'
    };
    const sessionLabel = sessionTypeLabels[formData.sessionType] || sessionType;

    const pixPaymentData = {
      transaction_amount: amount,
      date_of_expiration: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      payment_method_id: "pix",
      external_reference: tempPaymentId,
      notification_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/mercadopago-webhook`,
      description: `Sessão Fotográfica - ${sessionLabel}`,
      ...(deviceId && { device_id: deviceId }),
      metadata: {
        tenant_id: tenantId,
        client_id: clientId,
        client_name: formData.clientName,
        client_email: formData.clientEmail,
        client_phone: formData.clientPhone,
        session_type: formData.sessionType,
        session_details: formData.sessionDetails,
        scheduled_date: formData.scheduledDate,
        total_amount: amount,
        terms_accepted: formData.termsAccepted,
        link_validity_days: settings?.link_validity_days || 30,
        minimum_photos: settings?.minimum_photos || 5
      },
      payer: {
        first_name: firstName,
        last_name: lastName,
        email: clientEmail || 'cliente@exemplo.com',
        identification: { type: "CPF", number: "11111111111" },
        address: {
          zip_code: "01310-100",
          street_name: "Av. Paulista",
          street_number: "1000"
        },
        phone: {
          area_code: "11",
          number: "999999999"
        }
      }
    };

    const pixResponse = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${mpSettingsFull.access_token}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': `${tempPaymentId}-${Date.now()}`
      },
      body: JSON.stringify(pixPaymentData)
    });

    if (!pixResponse.ok) {
      const errorData = await pixResponse.json();
      console.error('❌ Erro MercadoPago:', errorData);
      return new Response(
        JSON.stringify({
          success: false,
          error: `Erro do MercadoPago: ${errorData.message || 'Erro desconhecido'}`
        }),
        {
          status: pixResponse.status,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        }
      );
    }

    const pixData = await pixResponse.json();
    const qrCode = pixData.point_of_interaction?.transaction_data?.qr_code;
    const qrCodeBase64 = pixData.point_of_interaction?.transaction_data?.qr_code_base64;

    console.log('✅ PIX MercadoPago criado:', pixData.id);
    console.log('⏳ Aguardando pagamento para criar agendamento...');

    return new Response(
      JSON.stringify({
        success: true,
        payment_id: pixData.id,
        temp_payment_id: tempPaymentId,
        status: pixData.status,
        qr_code: qrCode,
        qr_code_base64: qrCodeBase64,
        expires_at: pixPaymentData.date_of_expiration,
        message: 'Pagamento criado. Agendamento será confirmado após pagamento.'
      }),
      {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    );

  } catch (error) {
    console.error('❌ Erro:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: `Erro interno: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    );
  }
});
