import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
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

    const { data: existingClient } = await supabase.from('clients').select('*').eq('phone', formData.clientPhone).maybeSingle();
    let clientId: string;

    if (existingClient) {
      clientId = existingClient.id;
      await supabase.from('clients').update({ name: formData.clientName, email: formData.clientEmail, updated_at: new Date().toISOString() }).eq('id', clientId);
    } else {
      const { data: newClient, error: clientError } = await supabase.from('clients').insert([{ name: formData.clientName, email: formData.clientEmail, phone: formData.clientPhone }]).select().single();
      if (clientError) throw clientError;
      clientId = newClient.id;
    }

    const { data: appointment, error: appointmentError } = await supabase.from('appointments').insert([{ client_id: clientId, session_type: formData.sessionType, session_details: formData.sessionDetails, scheduled_date: formData.scheduledDate, total_amount: amount, minimum_photos: 5, terms_accepted: formData.termsAccepted, status: 'pending', payment_status: 'pending' }]).select().single();
    if (appointmentError) throw appointmentError;

    const { data: mpSettings, error: mpError } = await supabase.from('mercadopago_settings').select('*').eq('is_active', true).limit(1).maybeSingle();
    if (mpError || !mpSettings || !mpSettings.access_token) {
      return new Response(JSON.stringify({ success: false, error: 'Configurações do MercadoPago não encontradas' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
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
      headers: { 'Authorization': `Bearer ${mpSettings.access_token}`, 'Content-Type': 'application/json', 'X-Idempotency-Key': `${appointment.id}-${Date.now()}` },
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

    await supabase.from('payments').insert({ appointment_id: appointment.id, mercadopago_id: pixData.id.toString(), amount: amount, status: pixData.status, payment_type: 'initial' });

    try {
      const { scheduleNotifications } = await import('./notifications.ts');
      await scheduleNotifications(appointment.id, supabase);
    } catch (error) {
      console.error('Error scheduling notifications:', error);
    }

    try {
      console.log('📅 Creating Google Calendar event...');
      console.log('Appointment ID:', appointment.id);
      console.log('Scheduled date:', formData.scheduledDate);
      const startDate = new Date(formData.scheduledDate);
      const endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000);
      const calendarPayload = {
        appointmentId: appointment.id,
        summary: `Sessão de Fotos - ${formData.clientName}`,
        description: `Tipo: ${sessionLabel}\nCliente: ${formData.clientName}\nTelefone: ${formData.clientPhone}\nEmail: ${formData.clientEmail || 'Não informado'}`,
        startDateTime: startDate.toISOString(),
        endDateTime: endDate.toISOString(),
        attendees: formData.clientEmail ? [formData.clientEmail] : []
      };
      console.log('Calendar payload:', JSON.stringify(calendarPayload, null, 2));
      const calendarResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/create-calendar-event`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(calendarPayload)
      });
      console.log('Calendar response status:', calendarResponse.status);
      if (calendarResponse.ok) {
        const calendarResult = await calendarResponse.json();
        console.log('✅ Google Calendar event created:', JSON.stringify(calendarResult, null, 2));
      } else {
        const errorText = await calendarResponse.text();
        console.error('❌ Failed to create calendar event. Status:', calendarResponse.status);
        console.error('❌ Error response:', errorText);
      }
    } catch (error) {
      console.error('❌ Error creating calendar event:', error);
      console.error('Error stack:', error instanceof Error ? error.stack : 'No stack');
    }

    return new Response(JSON.stringify({ success: true, payment_id: pixData.id, status: pixData.status, qr_code: qrCode, qr_code_base64: qrCodeBase64, expires_at: pixPaymentData.date_of_expiration }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ success: false, error: `Erro interno: ${error instanceof Error ? error.message : 'Erro desconhecido'}` }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }
});