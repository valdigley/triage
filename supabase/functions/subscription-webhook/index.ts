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

    if (body.type === 'payment' || body.action === 'payment.updated') {
      const paymentId = body.data?.id;
      
      if (!paymentId) {
        console.error('No payment ID in webhook');
        return new Response(
          JSON.stringify({ success: false, error: 'No payment ID' }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

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

      const paymentStatus = status === 'approved' ? 'approved' : status === 'rejected' ? 'rejected' : 'pending';

      console.log(`Updating payment ${paymentId} to status: ${paymentStatus}`);

      const { error: updatePaymentError } = await supabaseClient
        .from('triagem_subscription_payments')
        .update({
          status: paymentStatus,
          paid_at: status === 'approved' ? new Date().toISOString() : null
        })
        .eq('external_payment_id', paymentId);

      if (updatePaymentError) {
        console.error('Error updating payment:', updatePaymentError);
      }

      if (status === 'approved') {
        console.log(`Payment approved, activating subscription ${subscriptionId}`);

        const { data: subscription } = await supabaseClient
          .from('triagem_subscriptions')
          .select('*')
          .eq('id', subscriptionId)
          .maybeSingle();

        if (subscription) {
          const { error: updateSubError } = await supabaseClient
            .from('triagem_subscriptions')
            .update({
              status: 'active',
              starts_at: new Date().toISOString()
            })
            .eq('id', subscriptionId);

          if (updateSubError) {
            console.error('Error updating subscription:', updateSubError);
          } else {
            console.log(`Subscription ${subscriptionId} activated`);
          }

          const { error: updateTenantError } = await supabaseClient
            .from('triagem_tenants')
            .update({
              status: 'active'
            })
            .eq('id', tenantId);

          if (updateTenantError) {
            console.error('Error updating tenant:', updateTenantError);
          } else {
            console.log(`Tenant ${tenantId} activated`);
          }

          try {
            const expiresAt = new Date(subscription.expires_at);
            const planName = subscription.plan_name === 'monthly' ? 'Mensal' : 'Anual';

            const { data: tenantData } = await supabaseClient
              .from('triagem_tenants')
              .select('email')
              .eq('id', tenantId)
              .maybeSingle();

            const { data: settings } = await supabaseClient
              .from('triagem_global_settings')
              .select('app_url')
              .maybeSingle();

            const appUrl = settings?.app_url || 'https://triagem.app';

            await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-tenant-notification`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                tenantId,
                eventType: 'subscription_payment_approved',
                customData: {
                  amount: subscription.amount.toFixed(2),
                  plan_name: planName,
                  expires_at: expiresAt.toLocaleDateString('pt-BR'),
                  app_url: appUrl,
                  email: tenantData?.email || ''
                }
              })
            });
          } catch (notifError) {
            console.error('Error sending notification:', notifError);
          }
        } else {
          console.error(`Subscription ${subscriptionId} not found`);
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