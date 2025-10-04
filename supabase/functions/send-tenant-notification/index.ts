import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface NotificationData {
  tenantId: string;
  eventType: string;
  customData?: Record<string, string>;
}

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

    const { tenantId, eventType, customData }: NotificationData = await req.json();

    console.log(`[send-tenant-notification] Processing: ${eventType} for tenant ${tenantId}`);

    if (!tenantId || !eventType) {
      return new Response(
        JSON.stringify({ success: false, error: 'tenantId e eventType s\u00e3o obrigat\u00f3rios' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const { data: tenant, error: tenantError } = await supabaseClient
      .from('triagem_tenants')
      .select('*')
      .eq('id', tenantId)
      .maybeSingle();

    if (tenantError || !tenant) {
      console.error('Tenant not found:', tenantError);
      return new Response(
        JSON.stringify({ success: false, error: 'Tenant n\u00e3o encontrado' }),
        { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const phoneNumber = tenant.whatsapp_number || tenant.phone;

    if (!phoneNumber) {
      console.log('Tenant has no phone number, skipping notification');
      return new Response(
        JSON.stringify({ success: true, message: 'Tenant sem n\u00famero de telefone' }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const { data: template, error: templateError } = await supabaseClient
      .from('triagem_tenant_notification_templates')
      .select('*')
      .eq('event_type', eventType)
      .eq('is_active', true)
      .maybeSingle();

    if (templateError || !template) {
      console.error('Template not found:', templateError);
      return new Response(
        JSON.stringify({ success: false, error: 'Template n\u00e3o encontrado' }),
        { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    let message = template.message_template;

    const variables: Record<string, string> = {
      tenant_name: tenant.name,
      tenant_email: tenant.email,
      trial_days: '7',
      ...customData
    };

    Object.keys(variables).forEach(key => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      message = message.replace(regex, variables[key]);
    });

    const { data: globalSettings } = await supabaseClient
      .from('global_settings')
      .select('*')
      .maybeSingle();

    if (!globalSettings || !globalSettings.evolution_api_url || !globalSettings.evolution_api_key) {
      console.error('Global Evolution settings not found or incomplete');
      return new Response(
        JSON.stringify({ success: false, error: 'Configura\u00e7\u00f5es globais do Evolution n\u00e3o encontradas' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const instanceName = globalSettings.instance_name || 'triagem';
    const evolutionUrl = `${globalSettings.evolution_api_url}/message/sendText/${instanceName}`;

    console.log(`Sending notification to ${phoneNumber}`);

    const evolutionResponse = await fetch(evolutionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': globalSettings.evolution_api_key
      },
      body: JSON.stringify({
        number: phoneNumber,
        text: message
      })
    });

    const evolutionData = await evolutionResponse.json();

    if (!evolutionResponse.ok) {
      console.error('Evolution API error:', evolutionData);

      await supabaseClient
        .from('triagem_tenant_notification_log')
        .insert([{
          tenant_id: tenantId,
          event_type: eventType,
          phone_number: phoneNumber,
          message: message,
          status: 'failed',
          error_message: JSON.stringify(evolutionData)
        }]);

      throw new Error('Erro ao enviar mensagem via Evolution API');
    }

    await supabaseClient
      .from('triagem_tenant_notification_log')
      .insert([{
        tenant_id: tenantId,
        event_type: eventType,
        phone_number: phoneNumber,
        message: message,
        status: 'sent',
        sent_at: new Date().toISOString()
      }]);

    console.log(`Notification sent successfully to tenant ${tenantId}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Notifica\u00e7\u00e3o enviada com sucesso',
        messageId: evolutionData.key?.id
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );

  } catch (error) {
    console.error('Error in send-tenant-notification:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
});