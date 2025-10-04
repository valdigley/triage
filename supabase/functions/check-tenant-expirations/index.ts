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

    console.log('[check-tenant-expirations] Starting expiration check...');

    const now = new Date();
    const twoDaysFromNow = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    const { data: trialsExpiringSoon } = await supabaseClient
      .from('triagem_tenants')
      .select('*')
      .eq('status', 'trial')
      .gte('trial_ends_at', now.toISOString())
      .lte('trial_ends_at', twoDaysFromNow.toISOString());

    console.log(`Found ${trialsExpiringSoon?.length || 0} trials expiring in 2 days`);

    for (const tenant of trialsExpiringSoon || []) {
      const today = new Date().toISOString().split('T')[0];

      const { data: alreadySent } = await supabaseClient
        .from('triagem_tenant_notification_log')
        .select('id')
        .eq('tenant_id', tenant.id)
        .eq('event_type', 'trial_expiring_soon')
        .gte('created_at', `${today}T00:00:00`)
        .maybeSingle();

      if (!alreadySent) {
        const trialEndsAt = new Date(tenant.trial_ends_at);
        const daysRemaining = Math.ceil((trialEndsAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));

        await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-tenant-notification`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tenantId: tenant.id,
            eventType: 'trial_expiring_soon',
            customData: {
              trial_expires_at: trialEndsAt.toLocaleDateString('pt-BR'),
              days_remaining: daysRemaining.toString()
            }
          })
        });
      }
    }

    const { data: expiredTrials } = await supabaseClient
      .from('triagem_tenants')
      .select('*')
      .eq('status', 'trial')
      .lt('trial_ends_at', now.toISOString());

    console.log(`Found ${expiredTrials?.length || 0} expired trials`);

    for (const tenant of expiredTrials || []) {
      await supabaseClient
        .from('triagem_tenants')
        .update({ status: 'blocked' })
        .eq('id', tenant.id);

      const { data: alreadySent } = await supabaseClient
        .from('triagem_tenant_notification_log')
        .select('id')
        .eq('tenant_id', tenant.id)
        .eq('event_type', 'trial_expired')
        .maybeSingle();

      if (!alreadySent) {
        const expiredAt = new Date(tenant.trial_ends_at);

        await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-tenant-notification`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tenantId: tenant.id,
            eventType: 'trial_expired',
            customData: {
              expired_at: expiredAt.toLocaleDateString('pt-BR')
            }
          })
        });
      }
    }

    const { data: subscriptionsExpiringSoon } = await supabaseClient
      .from('triagem_subscriptions')
      .select('*, triagem_tenants(*)')
      .eq('status', 'active')
      .gte('expires_at', now.toISOString())
      .lte('expires_at', threeDaysFromNow.toISOString());

    console.log(`Found ${subscriptionsExpiringSoon?.length || 0} subscriptions expiring in 3 days`);

    for (const subscription of subscriptionsExpiringSoon || []) {
      const today = new Date().toISOString().split('T')[0];

      const { data: alreadySent } = await supabaseClient
        .from('triagem_tenant_notification_log')
        .select('id')
        .eq('tenant_id', subscription.tenant_id)
        .eq('event_type', 'subscription_expiring_soon')
        .gte('created_at', `${today}T00:00:00`)
        .maybeSingle();

      if (!alreadySent) {
        const expiresAt = new Date(subscription.expires_at);
        const daysRemaining = Math.ceil((expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));

        await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-tenant-notification`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tenantId: subscription.tenant_id,
            eventType: 'subscription_expiring_soon',
            customData: {
              expires_at: expiresAt.toLocaleDateString('pt-BR'),
              days_remaining: daysRemaining.toString()
            }
          })
        });
      }
    }

    const { data: expiredSubscriptions } = await supabaseClient
      .from('triagem_subscriptions')
      .select('*, triagem_tenants(*)')
      .eq('status', 'active')
      .lt('expires_at', now.toISOString());

    console.log(`Found ${expiredSubscriptions?.length || 0} expired subscriptions`);

    for (const subscription of expiredSubscriptions || []) {
      await supabaseClient
        .from('triagem_subscriptions')
        .update({ status: 'expired' })
        .eq('id', subscription.id);

      await supabaseClient
        .from('triagem_tenants')
        .update({ status: 'blocked' })
        .eq('id', subscription.tenant_id);

      const { data: alreadySent } = await supabaseClient
        .from('triagem_tenant_notification_log')
        .select('id')
        .eq('tenant_id', subscription.tenant_id)
        .eq('event_type', 'subscription_expired')
        .maybeSingle();

      if (!alreadySent) {
        const expiredAt = new Date(subscription.expires_at);

        await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-tenant-notification`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tenantId: subscription.tenant_id,
            eventType: 'subscription_expired',
            customData: {
              expired_at: expiredAt.toLocaleDateString('pt-BR')
            }
          })
        });
      }
    }

    console.log('[check-tenant-expirations] Check completed successfully');

    return new Response(
      JSON.stringify({
        success: true,
        summary: {
          trials_expiring_soon: trialsExpiringSoon?.length || 0,
          expired_trials: expiredTrials?.length || 0,
          subscriptions_expiring_soon: subscriptionsExpiringSoon?.length || 0,
          expired_subscriptions: expiredSubscriptions?.length || 0
        }
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );

  } catch (error) {
    console.error('Error in check-tenant-expirations:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
});