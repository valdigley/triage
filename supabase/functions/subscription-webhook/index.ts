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

    const body = await req.json();
    console.log('Webhook received:', JSON.stringify(body, null, 2));

    // MercadoPago sends notifications in this format
    if (body.type === 'payment' || body.action === 'payment.updated') {
      const paymentId = body.data?.id;
      
      if (!paymentId) {
        console.error('No payment ID in webhook');
        return new Response(
          JSON.stringify({ success: false, error: 'No payment ID' }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      // Get MercadoPago settings
      const { data: mpSettings } = await supabaseClient
        .from('triagem_mercadopago_settings')
        .select('*')
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      if (!mpSettings || !mpSettings.access_token) {
        console.error('MercadoPago settings not found');
        return new Response(
          JSON.stringify({ success: false, error: 'Settings not found' }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      // Fetch payment details from MercadoPago
      const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: {
          'Authorization': `Bearer ${mpSettings.access_token}`
        }
      });

      if (!mpResponse.ok) {
        console.error('Failed to fetch payment from MercadoPago');
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to fetch payment' }),
          { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      const mpPayment = await mpResponse.json();
      console.log('Payment details:', JSON.stringify(mpPayment, null, 2));

      const status = mpPayment.status;
      const tenantId = mpPayment.metadata?.tenant_id;
      const subscriptionId = mpPayment.metadata?.subscription_id;

      if (!tenantId || !subscriptionId) {
        console.error('Missing tenant_id or subscription_id in metadata');
        return new Response(
          JSON.stringify({ success: true, message: 'Not a subscription payment' }),
          { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      // Update subscription payment status
      const paymentStatus = status === 'approved' ? 'approved' : status === 'rejected' ? 'rejected' : 'pending';
      
      await supabaseClient
        .from('triagem_subscription_payments')
        .update({
          status: paymentStatus,
          paid_at: status === 'approved' ? new Date().toISOString() : null
        })
        .eq('external_payment_id', paymentId);

      // If payment is approved, activate subscription
      if (status === 'approved') {
        const { data: subscription } = await supabaseClient
          .from('subscriptions')
          .select('*')
          .eq('id', subscriptionId)
          .single();

        if (subscription) {
          // Update subscription to active
          await supabaseClient
            .from('subscriptions')
            .update({
              status: 'active',
              starts_at: new Date().toISOString()
            })
            .eq('id', subscriptionId);

          // Update tenant status to active
          await supabaseClient
            .from('triagem_tenants')
            .update({
              status: 'active'
            })
            .eq('id', tenantId);

          console.log(`Subscription ${subscriptionId} activated for tenant ${tenantId}`);
        }
      }

      return new Response(
        JSON.stringify({ success: true, status: paymentStatus }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Webhook received' }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  } catch (error) {
    console.error('Error in subscription-webhook:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
});