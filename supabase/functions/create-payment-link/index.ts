const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { paymentId, appointmentId, amount, clientName, clientEmail, clientPhone, paymentType } = await req.json();

    if (!paymentId || !appointmentId || !amount || !clientName) {
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

    // Get MercadoPago settings
    const { data: mpSettings, error: mpError } = await supabase
      .from('triagem_mercadopago_settings')
      .select('*')
      .eq('is_active', true)
      .single();

    if (mpError || !mpSettings || !mpSettings.access_token) {
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

    // Split client name
    const nameParts = clientName.trim().split(' ');
    const firstName = nameParts[0] || 'Cliente';
    const lastName = nameParts.slice(1).join(' ') || 'Sobrenome';

    // Determine description based on payment type
    const description = paymentType === 'extra_photos' 
      ? 'Fotos Extras - Sessão Fotográfica'
      : 'Sessão Fotográfica';

    // Create PIX payment directly (more reliable for status updates)
    const pixPaymentData = {
      transaction_amount: amount,
      date_of_expiration: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 minutos
      payment_method_id: "pix",
      external_reference: paymentType === 'extra_photos' ? `${appointmentId}-extra-${Date.now()}` : appointmentId,
      notification_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/mercadopago-webhook`,
      description: description,
      payer: {
        first_name: firstName,
        last_name: lastName,
        email: clientEmail || 'cliente@exemplo.com',
        identification: {
          type: "CPF",
          number: "11111111111"
        },
        address: {
          zip_code: "01310-100",
          street_name: "Av. Paulista",
          street_number: "1000"
        },
        phone: {
          area_code: "11",
          number: clientPhone.replace(/\D/g, '').slice(-9) || "999999999"
        }
      },
      metadata: {
        appointment_id: appointmentId,
        payment_type: paymentType,
        client_name: clientName
      }
    };

    console.log('Creating PIX payment:', JSON.stringify(pixPaymentData, null, 2));

    const response = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${mpSettings.access_token}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': `${paymentType}-${appointmentId}-${Date.now()}`
      },
      body: JSON.stringify(pixPaymentData)
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('MercadoPago PIX Error:', errorData);
      return new Response(
        JSON.stringify({
          success: false,
          error: `Erro do MercadoPago: ${errorData.message || 'Erro desconhecido'}`
        }),
        {
          status: response.status,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      );
    }

    const pixResult = await response.json();
    console.log('PIX payment created:', JSON.stringify(pixResult, null, 2));

    // Update payment with new MercadoPago ID
    await supabase
      .from('triagem_payments')
      .update({
        mercadopago_id: pixResult.id.toString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', paymentId);

    // Extract QR code data
    const qrCode = pixResult.point_of_interaction?.transaction_data?.qr_code;
    const qrCodeBase64 = pixResult.point_of_interaction?.transaction_data?.qr_code_base64;

    return new Response(
      JSON.stringify({
        success: true,
        payment_id: pixResult.id,
        status: pixResult.status,
        qr_code: qrCode,
        qr_code_base64: qrCodeBase64,
        expires_at: pixPaymentData.date_of_expiration,
        payment_type: 'pix'
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );

  } catch (error) {
    console.error('Error creating payment link:', error);
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