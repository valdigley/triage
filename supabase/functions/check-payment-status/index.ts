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

    // Check payment status with MercadoPago
    const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${mpSettings.access_token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!mpResponse.ok) {
      const errorData = await mpResponse.json();
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
    
    // Update payment status in database if changed
    if (paymentData.external_reference) {
      await supabase
        .from('payments')
        .update({
          status: paymentData.status,
          updated_at: new Date().toISOString()
        })
        .eq('appointment_id', paymentData.external_reference);

      // Update appointment status if payment approved
      if (paymentData.status === 'approved') {
        await supabase
          .from('appointments')
          .update({
            status: 'confirmed',
            payment_status: 'approved',
            updated_at: new Date().toISOString()
          })
          .eq('id', paymentData.external_reference);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        payment_id: paymentData.id,
        status: paymentData.status,
        status_detail: paymentData.status_detail
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );

  } catch (error) {
    console.error('Error checking payment status:', error);
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