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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Não autenticado' }),
        { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Usuário não encontrado' }),
        { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const { subscriptionId } = await req.json();

    if (!subscriptionId) {
      return new Response(
        JSON.stringify({ success: false, error: 'subscriptionId é obrigatório' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const { data: payment, error: paymentError } = await supabaseClient
      .from('triagem_subscription_payments')
      .select('*, triagem_subscriptions!inner(tenant_id)')
      .eq('subscription_id', subscriptionId)
      .maybeSingle();

    if (paymentError || !payment) {
      return new Response(
        JSON.stringify({ success: false, error: 'Pagamento não encontrado' }),
        { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const tenantId = payment.triagem_subscriptions.tenant_id;
    const { data: tenant } = await supabaseClient
      .from('triagem_tenants')
      .select('id')
      .eq('id', tenantId)
      .eq('owner_user_id', user.id)
      .maybeSingle();

    if (!tenant) {
      return new Response(
        JSON.stringify({ success: false, error: 'Você não tem permissão para verificar este pagamento' }),
        { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const { data: mpSettings } = await supabaseClient
      .from('triagem_mercadopago_settings')
      .select('*')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    if (!mpSettings || !mpSettings.access_token) {
      return new Response(
        JSON.stringify({ success: false, error: 'Configurações do MercadoPago não encontradas' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${payment.external_payment_id}`, {
      headers: {
        'Authorization': `Bearer ${mpSettings.access_token}`
      }
    });

    if (!mpResponse.ok) {
      return new Response(
        JSON.stringify({ success: false, error: 'Erro ao verificar pagamento no MercadoPago' }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const mpPayment = await mpResponse.json();
    const status = mpPayment.status;

    console.log(`Payment ${payment.external_payment_id} status: ${status}`);

    const paymentStatus = status === 'approved' ? 'approved' : status === 'rejected' ? 'rejected' : 'pending';

    await supabaseClient
      .from('triagem_subscription_payments')
      .update({
        status: paymentStatus,
        paid_at: status === 'approved' ? new Date().toISOString() : null
      })
      .eq('id', payment.id);

    if (status === 'approved' && payment.status !== 'approved') {
      console.log(`Activating subscription ${subscriptionId}`);

      await supabaseClient
        .from('triagem_subscriptions')
        .update({
          status: 'active',
          starts_at: new Date().toISOString()
        })
        .eq('id', subscriptionId);

      await supabaseClient
        .from('triagem_tenants')
        .update({
          status: 'active'
        })
        .eq('id', tenantId);

      return new Response(
        JSON.stringify({
          success: true,
          status: paymentStatus,
          message: 'Pagamento aprovado! Sua assinatura foi ativada.'
        }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        status: paymentStatus,
        message: status === 'pending'
          ? 'Aguardando pagamento...'
          : status === 'rejected'
            ? 'Pagamento rejeitado'
            : 'Status: ' + status
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );

  } catch (error) {
    console.error('Error in check-subscription-payment-status:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    );
  }
});