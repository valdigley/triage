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
    
    if (req.method === 'POST') {
      const body = await req.json();
      const { access_token, environment, ...requestData } = body;

      if (!access_token) {
        return new Response(
          JSON.stringify({ error: 'Access token é obrigatório' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      const baseUrl = 'https://api.mercadopago.com';

      switch (action) {
        case 'test-connection':
          try {
            // Test with a simple GET request to validate credentials
            const response = await fetch(`${baseUrl}/v1/payment_methods`, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${access_token}`,
                'Content-Type': 'application/json',
              },
            });

            if (response.ok) {
              const paymentMethods = await response.json();
              
              // Additional validation: try to get account info
              const accountResponse = await fetch(`${baseUrl}/users/me`, {
                method: 'GET',
                headers: {
                  'Authorization': `Bearer ${access_token}`,
                  'Content-Type': 'application/json',
                },
              });
              
              let accountInfo = null;
              if (accountResponse.ok) {
                accountInfo = await accountResponse.json();
              }
              
              return new Response(
                JSON.stringify({
                  success: true,
                  message: `Conexão estabelecida com sucesso! ${accountInfo ? `Conta: ${accountInfo.email || accountInfo.nickname || 'Verificada'}` : ''}`,
                  payment_methods_count: paymentMethods.length,
                  environment: environment,
                  account_info: accountInfo ? {
                    id: accountInfo.id,
                    email: accountInfo.email,
                    nickname: accountInfo.nickname,
                    country_id: accountInfo.country_id
                  } : null
                }),
                {
                  headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                }
              );
            } else {
              const errorData = await response.json();
              return new Response(
                JSON.stringify({
                  success: false,
                  error: `${errorData.message || 'Erro de autenticação'} (Status: ${response.status})`,
                  details: errorData
                }),
                {
                  status: response.status,
                  headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                }
              );
            }
          } catch (error) {
            return new Response(
              JSON.stringify({
                success: false,
                error: `Erro de rede: ${error.message}. Verifique se a URL da API está correta.`,
              }),
              {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              }
            );
          }

        case 'create-preference':
          try {
            // Generate unique idempotency key for this request
            const idempotencyKey = `pref-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            
            const preferenceData = {
              items: [{
                title: requestData.title || 'Pacote Fotográfico',
                quantity: 1,
                unit_price: requestData.amount || 10.00,
                currency_id: 'BRL'
              }],
              payer: {
                name: requestData.payer?.name || 'João Silva',
                email: requestData.payer?.email || 'test@example.com',
                phone: {
                  area_code: requestData.payer?.phone?.area_code || '11',
                  number: requestData.payer?.phone?.number || '999999999'
                },
                identification: {
                  type: 'CPF',
                  number: requestData.payer?.cpf || '12345678909'
                }
              },
              back_urls: {
                success: requestData.back_urls?.success || 'https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=',
                failure: requestData.back_urls?.failure || 'https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=',
                pending: requestData.back_urls?.pending || 'https://www.mercadopago.com.br/checkout/v1/redirect?pref_id='
              },
              notification_url: requestData.notification_url || `${url.origin}/api/webhooks/mercadopago`,
              external_reference: requestData.external_reference || `payment-${Date.now()}`,
              expires: true,
              expiration_date_from: new Date().toISOString(),
              expiration_date_to: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
            };

            const response = await fetch(`${baseUrl}/checkout/preferences`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${access_token}`,
                'Content-Type': 'application/json',
                'X-Idempotency-Key': idempotencyKey,
              },
              body: JSON.stringify(preferenceData),
            });

            const responseData = await response.json();

            if (response.ok) {
              return new Response(
                JSON.stringify({
                  success: true,
                  preference: responseData,
                  payment_link: responseData.init_point || responseData.sandbox_init_point
                }),
                {
                  headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                }
              );
            } else {
              return new Response(
                JSON.stringify({
                  success: false,
                  error: responseData.message || `Erro HTTP: ${response.status}`,
                  details: responseData
                }),
                {
                  status: response.status,
                  headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                }
              );
            }
          } catch (error) {
            return new Response(
              JSON.stringify({
                success: false,
                error: `Erro ao criar preferência: ${error.message}`,
              }),
              {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              }
            );
          }

        default:
          return new Response(
            JSON.stringify({ error: 'Ação não suportada' }),
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
          );
      }
    }

    return new Response(
      JSON.stringify({ error: 'Método não permitido' }),
      {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: 'Erro interno do servidor',
        details: error.message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});