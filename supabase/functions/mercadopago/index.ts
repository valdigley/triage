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
    const action = url.searchParams.get('action');

    if (action === 'test-connection') {
      const { access_token, environment } = await req.json();

      if (!access_token) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Access token é obrigatório' 
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

      // Determine the correct API URL based on environment
      const apiUrl = environment === 'sandbox' 
        ? 'https://api.mercadopago.com/v1/account/settings'
        : 'https://api.mercadopago.com/v1/account/settings';

      // Test MercadoPago API connection
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${access_token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        
        // Also get payment methods to provide more info
        let paymentMethodsCount = 0;
        try {
          const pmResponse = await fetch('https://api.mercadopago.com/v1/payment_methods', {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${access_token}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (pmResponse.ok) {
            const pmData = await pmResponse.json();
            paymentMethodsCount = pmData.length || 0;
          }
        } catch (pmError) {
          console.log('Could not fetch payment methods:', pmError);
        }

        return new Response(
          JSON.stringify({
            success: true,
            message: `Conexão bem-sucedida! Conta: ${data.site_id || 'MercadoPago'}`,
            payment_methods_count: paymentMethodsCount,
            environment: environment,
            data: data
          }),
          {
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders,
            },
          }
        );
      } else {
        const errorData = await response.json();
        return new Response(
          JSON.stringify({
            success: false,
            error: `Erro ${response.status}: ${errorData.message || 'Token inválido ou expirado'}`
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
    }

    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Ação não reconhecida' 
      }),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );

  } catch (error) {
    console.error('Error in MercadoPago function:', error);
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