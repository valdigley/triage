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
    // Get Supabase client
    const { createClient } = await import('npm:@supabase/supabase-js@2');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { galleryId, appointmentId, extraPhotos, totalAmount, clientName, clientEmail, selectedPhotos } = await req.json();

    if (!galleryId || !appointmentId || !extraPhotos || !totalAmount) {
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

    // Get MercadoPago settings
    const { data: mpSettings, error: mpError } = await supabase
      .from('triagem_mercadopago_settings')
      .select('*')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

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
    const nameParts = (clientName || 'Cliente').trim().split(' ');
    const firstName = nameParts[0] || 'Cliente';
    const lastName = nameParts.slice(1).join(' ') || 'Sobrenome';

    // Create PIX payment for extra photos
    const pixPaymentData = {
      transaction_amount: totalAmount,
      date_of_expiration: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 minutos
      payment_method_id: "pix",
      external_reference: `${appointmentId}-extra-${Date.now()}`,
      notification_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/mercadopago-webhook`,
      description: `Fotos Extras - ${extraPhotos} fotos adicionais`,
      payer: {
        first_name: firstName,
        last_name: lastName,
        email: clientEmail || 'cliente@exemplo.com',
        identification: {
          type: "CPF",
          number: "11111111111" // CPF padrão para testes
        },
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

    console.log('Creating PIX payment for extra photos:', JSON.stringify(pixPaymentData, null, 2));

    const pixResponse = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${mpSettings.access_token}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': `extra-${appointmentId}-${Date.now()}`
      },
      body: JSON.stringify(pixPaymentData)
    });

    if (!pixResponse.ok) {
      const errorData = await pixResponse.json();
      console.error('MercadoPago PIX Error:', errorData);
      return new Response(
        JSON.stringify({
          success: false,
          error: `Erro do MercadoPago: ${errorData.message || 'Erro desconhecido'}`
        }),
        {
          status: pixResponse.status,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      );
    }

    const pixData = await pixResponse.json();
    console.log('PIX payment created for extra photos:', JSON.stringify(pixData, null, 2));

    // Extract QR code data
    const qrCode = pixData.point_of_interaction?.transaction_data?.qr_code;
    const qrCodeBase64 = pixData.point_of_interaction?.transaction_data?.qr_code_base64;

    // Create payment record in database
    const { error: paymentError } = await supabase
      .from('triagem_payments')
      .insert({
        appointment_id: appointmentId,
        mercadopago_id: pixData.id.toString(),
        amount: totalAmount,
        status: pixData.status,
        payment_type: 'extra_photos'
      });

    if (paymentError) {
      console.error('Database error:', paymentError);
    }

    // Update gallery with extra photos info
    const { error: galleryError } = await supabase
      .from('galleries_triage')
      .update({
        extra_photos_payment_id: pixData.id.toString(),
        extra_photos_selected: selectedPhotos,
        updated_at: new Date().toISOString()
      })
      .eq('id', galleryId);

    if (galleryError) {
      console.error('Gallery update error:', galleryError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        payment_id: pixData.id,
        status: pixData.status,
        qr_code: qrCode,
        qr_code_base64: qrCodeBase64,
        expires_at: pixPaymentData.date_of_expiration,
        extra_photos: extraPhotos,
        total_amount: totalAmount
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );

  } catch (error) {
    console.error('Error creating extra photos payment:', error);
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