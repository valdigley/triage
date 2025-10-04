import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { createClient } = await import('npm:@supabase/supabase-js@2');
    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const { formData, amount, clientName, clientEmail, sessionType, deviceId } = await req.json();

    if (!formData || !amount) {
      return new Response(JSON.stringify({ success: false, error: 'formData e amount são obrigatórios' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    console.log('🔍 Buscando tenant_id baseado nas configurações de MercadoPago...');
    const { data: mpSettings, error: mpError } = await supabase.from('triagem_mercadopago_settings').select('tenant_id').eq('is_active', true).limit(1).maybeSingle();
    if (mpError || !mpSettings || !mpSettings.tenant_id) {
      console.error('❌ Erro ao buscar tenant_id:', mpError);
      return new Response(JSON.stringify({ success: false, error: 'Configuração de tenant não encontrada' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }
    const tenantId = mpSettings.tenant_id;
    console.log('✅ Tenant ID encontrado:', tenantId);

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

    const { data: appointment, error: appointmentError } = await supabase.from('triagem_appointments').insert([{ client_id: clientId, tenant_id: tenantId, session_type: formData.sessionType, session_details: formData.sessionDetails, scheduled_date: formData.scheduledDate, total_amount: amount, minimum_photos: 5, terms_accepted: formData.termsAccepted, status: 'pending', payment_status: 'pending' }]).select().single();
    if (appointmentError) throw appointmentError;

    console.log('🔍 Buscando configurações completas do MercadoPago...');
    const { data: mpSettingsFull, error: mpFullError } = await supabase.from('triagem_mercadopago_settings').select('*').eq('tenant_id', tenantId).eq('is_active', true).limit(1).maybeSingle();

    if (mpFullError || !mpSettingsFull || !mpSettingsFull.access_token) {
      console.log('⚠️ MercadoPago não configurado - tentando PIX manual...');

      // Buscar chave PIX manual do tenant
      const { data: settings } = await supabase
        .from('triagem_settings')
        .select('pix_key, studio_name')
        .eq('tenant_id', tenantId)
        .maybeSingle();

      const pixKey = settings?.pix_key;
      const studioName = settings?.studio_name || 'Estúdio';

      // Se há chave PIX, enviar via WhatsApp
      if (pixKey && formData.clientPhone) {
        // Buscar template de notificação
        const { data: template } = await supabase
          .from('triagem_notification_templates')
          .select('message_template')
          .eq('type', 'pix_appointment')
          .eq('is_active', true)
          .maybeSingle();

        // Buscar configurações globais da Evolution API
        const { data: globalSettings } = await supabase
          .from('global_settings')
          .select('evolution_server_url, evolution_auth_api_key')
          .maybeSingle();

        // Buscar instância do tenant
        const { data: whatsappInstance } = await supabase
          .from('triagem_whatsapp_instances')
          .select('instance_name')
          .eq('tenant_id', tenantId)
          .maybeSingle();

        if (globalSettings && whatsappInstance && template) {
          const sessionTypeLabels = {
            'aniversario': 'Sessão de Aniversário',
            'gestante': 'Ensaio Gestante',
            'formatura': 'Sessão de Formatura',
            'comercial': 'Sessão Comercial',
            'pre_wedding': 'Ensaio Pré-Wedding',
            'tematico': 'Sessão Temática'
          };
          const sessionLabel = sessionTypeLabels[formData.sessionType] || formData.sessionType;

          // Formatar data e hora
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

          // Processar template com variáveis
          let message = template.message_template
            .replace(/\{\{client_name\}\}/g, clientName)
            .replace(/\{\{studio_name\}\}/g, studioName)
            .replace(/\{\{pix_key\}\}/g, pixKey)
            .replace(/\{\{amount\}\}/g, `R$ ${(amount / 100).toFixed(2)}`)
            .replace(/\{\{session_type\}\}/g, sessionLabel)
            .replace(/\{\{appointment_date\}\}/g, formattedDate)
            .replace(/\{\{appointment_time\}\}/g, formattedTime);

          try {
            await fetch(
              `${globalSettings.evolution_server_url}/message/sendText/${whatsappInstance.instance_name}`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'apikey': globalSettings.evolution_auth_api_key
                },
                body: JSON.stringify({
                  number: formData.clientPhone.replace(/\D/g, ''),
                  text: message
                })
              }
            );

            console.log('✅ WhatsApp enviado com sucesso com chave PIX');
          } catch (error) {
            console.error('Error sending WhatsApp message:', error);
          }
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          appointment_id: appointment.id,
          no_payment_configured: true,
          pix_key: pixKey,
          message: 'Agendamento criado. Pagamento pendente via PIX manual.'
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        }
      );
    }

    const nameParts = clientName.trim().split(' ');
    const firstName = nameParts[0] || 'Cliente';
    const lastName = nameParts.slice(1).join(' ') || 'Sobrenome';
    const sessionTypeLabels = { 'aniversario': 'Sessão de Aniversário', 'gestante': 'Ensaio Gestante', 'formatura': 'Sessão de Formatura', 'comercial': 'Sessão Comercial', 'pre_wedding': 'Ensaio Pré-Wedding', 'tematico': 'Sessão Temática' };
    const sessionLabel = sessionTypeLabels[formData.sessionType] || sessionType;

    const pixPaymentData = {
      transaction_amount: amount,
      date_of_expiration: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      payment_method_id: "pix",
      external_reference: appointment.id,
      notification_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/mercadopago-webhook`,
      description: `Sessão Fotográfica - ${sessionType}`,
      ...(deviceId && { device_id: deviceId }),
      payer: { first_name: firstName, last_name: lastName, email: clientEmail || 'cliente@exemplo.com', identification: { type: "CPF", number: "11111111111" }, address: { zip_code: "01310-100", street_name: "Av. Paulista", street_number: "1000" }, phone: { area_code: "11", number: "999999999" } }
    };

    console.log('Creating PIX payment:', JSON.stringify(pixPaymentData, null, 2));
    const pixResponse = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${mpSettingsFull.access_token}`, 'Content-Type': 'application/json', 'X-Idempotency-Key': `${appointment.id}-${Date.now()}` },
      body: JSON.stringify(pixPaymentData)
    });

    if (!pixResponse.ok) {
      const errorData = await pixResponse.json();
      console.error('MercadoPago Error:', errorData);
      return new Response(JSON.stringify({ success: false, error: `Erro do MercadoPago: ${errorData.message || 'Erro desconhecido'}` }), { status: pixResponse.status, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    const pixData = await pixResponse.json();
    console.log('PIX created:', JSON.stringify(pixData, null, 2));
    const qrCode = pixData.point_of_interaction?.transaction_data?.qr_code;
    const qrCodeBase64 = pixData.point_of_interaction?.transaction_data?.qr_code_base64;

    await supabase.from('triagem_payments').insert({ appointment_id: appointment.id, tenant_id: tenantId, mercadopago_id: pixData.id.toString(), amount: amount, status: pixData.status, payment_type: 'initial' });

    console.log('✅ Payment criado. Aguardando confirmação do PIX para confirmar agendamento e criar evento no Google Calendar.');

    return new Response(JSON.stringify({ success: true, appointment_id: appointment.id, payment_id: pixData.id, status: pixData.status, qr_code: qrCode, qr_code_base64: qrCodeBase64, expires_at: pixPaymentData.date_of_expiration }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ success: false, error: `Erro interno: ${error instanceof Error ? error.message : 'Erro desconhecido'}` }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }
});