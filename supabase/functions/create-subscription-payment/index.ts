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

    const { tenantId, planName, couponCode, finalPrice } = await req.json();

    console.log('[create-subscription-payment] Received:', { tenantId, planName, couponCode, finalPrice, finalPriceType: typeof finalPrice });

    if (!tenantId || !planName) {
      return new Response(
        JSON.stringify({ success: false, error: 'tenantId e planName são obrigatórios' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const { data: tenant, error: tenantError } = await supabaseClient
      .from('triagem_tenants')
      .select('*')
      .eq('id', tenantId)
      .eq('owner_user_id', user.id)
      .maybeSingle();

    if (tenantError || !tenant) {
      return new Response(
        JSON.stringify({ success: false, error: 'Tenant não encontrado ou você não tem permissão' }),
        { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    let amount: number;

    if (finalPrice && finalPrice > 0) {
      amount = typeof finalPrice === 'string' ? parseFloat(finalPrice) : finalPrice;
      console.log('[create-subscription-payment] Using finalPrice:', amount);
    } else {
      const { data: pricingData, error: pricingError } = await supabaseClient
        .from('triagem_pricing')
        .select('price')
        .eq('plan_name', planName)
        .eq('is_active', true)
        .maybeSingle();

      if (pricingError || !pricingData) {
        const defaultPrices: Record<string, number> = { 'monthly': 79.90, 'yearly': 799.00 };
        amount = defaultPrices[planName] || 0;
        console.log('[create-subscription-payment] Using default price:', amount);
      } else {
        amount = typeof pricingData.price === 'string' ? parseFloat(pricingData.price) : pricingData.price;
        console.log('[create-subscription-payment] Using DB price:', amount);
      }
    }

    amount = Math.round(amount * 100) / 100;

    console.log('[create-subscription-payment] Final amount:', amount, 'Type:', typeof amount);

    if (!amount || amount <= 0 || isNaN(amount)) {
      return new Response(
        JSON.stringify({ success: false, error: `Plano inválido ou preço inválido. Amount: ${amount}` }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const { data: mpSettings, error: mpError } = await supabaseClient
      .from('triagem_mercadopago_settings')
      .select('*')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    if (mpError || !mpSettings || !mpSettings.access_token) {
      return new Response(
        JSON.stringify({ success: false, error: 'Configurações do MercadoPago não encontradas' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const expiresAt = planName === 'monthly' 
      ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

    const { data: subscription, error: subscriptionError } = await supabaseClient
      .from('triagem_subscriptions')
      .insert([{
        tenant_id: tenantId,
        plan_name: planName,
        amount: amount,
        status: 'pending',
        expires_at: expiresAt.toISOString()
      }])
      .select()
      .single();

    if (subscriptionError) {
      console.error('Error creating subscription:', subscriptionError);
      throw subscriptionError;
    }

    const pixPaymentData = {
      transaction_amount: parseFloat(amount.toFixed(2)),
      description: `Assinatura ${planName === 'monthly' ? 'Mensal' : 'Anual'} - Sistema de Fotografia`,
      payment_method_id: 'pix',
      payer: {
        email: tenant.email,
        first_name: tenant.name.split(' ')[0] || 'Cliente',
        last_name: tenant.name.split(' ').slice(1).join(' ') || 'Sobrenome',
        identification: {
          type: tenant.cpf_cnpj && tenant.cpf_cnpj.length > 11 ? 'CNPJ' : 'CPF',
          number: tenant.cpf_cnpj || '00000000000'
        }
      },
      notification_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/subscription-webhook`,
      metadata: {
        tenant_id: tenantId,
        subscription_id: subscription.id,
        plan_name: planName,
        coupon_code: couponCode || null
      }
    };

    console.log('[create-subscription-payment] Sending to MercadoPago:', { transaction_amount: pixPaymentData.transaction_amount });

    const mpResponse = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${mpSettings.access_token}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': `${tenantId}-${subscription.id}-${Date.now()}`
      },
      body: JSON.stringify(pixPaymentData)
    });

    if (!mpResponse.ok) {
      const errorText = await mpResponse.text();
      console.error('MercadoPago API error:', errorText);
      throw new Error(`Erro ao criar pagamento no MercadoPago: ${errorText}`);
    }

    const mpData = await mpResponse.json();
    console.log('MercadoPago payment created:', mpData.id);

    const { error: paymentError } = await supabaseClient
      .from('triagem_subscription_payments')
      .insert([{
        subscription_id: subscription.id,
        tenant_id: tenantId,
        amount: amount,
        status: 'pending',
        payment_method: 'pix',
        external_payment_id: mpData.id,
        qr_code: mpData.point_of_interaction?.transaction_data?.qr_code,
        qr_code_base64: mpData.point_of_interaction?.transaction_data?.qr_code_base64
      }]);

    if (paymentError) {
      console.error('Error saving payment:', paymentError);
      throw paymentError;
    }

    await supabaseClient
      .from('triagem_subscriptions')
      .update({ payment_id: mpData.id })
      .eq('id', subscription.id);

    return new Response(
      JSON.stringify({
        success: true,
        subscriptionId: subscription.id,
        paymentId: mpData.id,
        qrCode: mpData.point_of_interaction?.transaction_data?.qr_code,
        qrCodeBase64: mpData.point_of_interaction?.transaction_data?.qr_code_base64,
        expiresAt: expiresAt.toISOString()
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    );
  } catch (error) {
    console.error('Error in create-subscription-payment:', error);
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