const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
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
      .from('mercadopago_settings')
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

    // Create payment preference for checkout
    const preferenceData = {
      items: [
        {
          title: description,
          quantity: 1,
          unit_price: amount,
          currency_id: "BRL"
        }
      ],
      payer: {
        name: firstName,
        surname: lastName,
        email: clientEmail || 'cliente@exemplo.com',
        phone: {
          area_code: "11",
          number: clientPhone.replace(/\D/g, '').slice(-9) || "999999999"
        },
        identification: {
          type: "CPF",
          number: "11111111111"
        },
        address: {
          zip_code: "01310-100",
          street_name: "Av. Paulista",
          street_number: "1000"
        }
      },
      back_urls: {
        success: `${Deno.env.get('SUPABASE_URL')}/functions/v1/payment-success`,
        failure: `${Deno.env.get('SUPABASE_URL')}/functions/v1/payment-failure`,
        pending: `${Deno.env.get('SUPABASE_URL')}/functions/v1/payment-pending`
      },
      auto_return: "approved",
      external_reference: paymentType === 'extra_photos' ? `${appointmentId}-extra-${Date.now()}` : appointmentId,
      notification_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/mercadopago-webhook`,
      expires: true,
      expiration_date_from: new Date().toISOString(),
      expiration_date_to: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 horas
      payment_methods: {
        excluded_payment_methods: [],
        excluded_payment_types: [],
        installments: 12
      },
      statement_descriptor: "ESTUDIO FOTO",
      metadata: {
        appointment_id: appointmentId,
        payment_type: paymentType,
        client_name: clientName
      }
    };

    console.log('Creating payment preference:', JSON.stringify(preferenceData, null, 2));

    const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${mpSettings.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(preferenceData)
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('MercadoPago Error:', errorData);
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

    const preferenceResult = await response.json();
    console.log('Payment preference created:', JSON.stringify(preferenceResult, null, 2));

    // Update payment with new MercadoPago ID
    await supabase
      .from('payments')
      .update({
        mercadopago_id: preferenceResult.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', paymentId);

    // Return the payment URL
    const paymentUrl = mpSettings.environment === 'sandbox' 
      ? preferenceResult.sandbox_init_point 
      : preferenceResult.init_point;

    return new Response(
      JSON.stringify({
        success: true,
        payment_url: paymentUrl,
        preference_id: preferenceResult.id,
        expires_at: preferenceData.expiration_date_to
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