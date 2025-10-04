import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface CreateInstanceRequest {
  tenantId: string;
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

    const { tenantId }: CreateInstanceRequest = await req.json();

    console.log(`[create-whatsapp-instance] Creating instance for tenant ${tenantId}`);

    if (!tenantId) {
      return new Response(
        JSON.stringify({ success: false, error: 'tenantId \u00e9 obrigat\u00f3rio' }),
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

    const { data: existingSettings } = await supabaseClient
      .from('triagem_settings')
      .select('evolution_instance_name, evolution_instance_apikey')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (existingSettings && existingSettings.evolution_instance_name) {
      console.log(`Instance already exists for tenant ${tenantId}`);
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Inst\u00e2ncia j\u00e1 existe',
          instanceName: existingSettings.evolution_instance_name
        }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const { data: globalSettings } = await supabaseClient
      .from('global_settings')
      .select('evolution_server_url, evolution_auth_api_key')
      .maybeSingle();

    if (!globalSettings || !globalSettings.evolution_server_url || !globalSettings.evolution_auth_api_key) {
      console.error('Evolution server not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Servidor Evolution n\u00e3o configurado' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const instanceName = `tenant_${tenantId.substring(0, 8)}`;

    const createInstanceUrl = `${globalSettings.evolution_server_url}/instance/create`;

    console.log(`Creating instance ${instanceName} on Evolution API`);

    const createResponse = await fetch(createInstanceUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': globalSettings.evolution_auth_api_key
      },
      body: JSON.stringify({
        instanceName: instanceName,
        qrcode: true,
        integration: 'WHATSAPP-BAILEYS'
      })
    });

    if (!createResponse.ok) {
      const errorData = await createResponse.json();
      console.error('Evolution API error:', errorData);
      throw new Error('Erro ao criar inst\u00e2ncia no Evolution API');
    }

    const instanceData = await createResponse.json();
    console.log('Instance created successfully:', instanceData);

    const { error: updateError } = await supabaseClient
      .from('triagem_settings')
      .update({
        evolution_instance_name: instanceName,
        evolution_instance_apikey: instanceData.hash?.apikey || instanceData.instance?.apikey,
        whatsapp_connected: false,
        whatsapp_qrcode: instanceData.qrcode?.base64 || null,
        updated_at: new Date().toISOString()
      })
      .eq('tenant_id', tenantId);

    if (updateError) {
      console.error('Error updating tenant settings:', updateError);
      throw new Error('Erro ao salvar configura\u00e7\u00f5es da inst\u00e2ncia');
    }

    console.log(`Instance ${instanceName} created and configured for tenant ${tenantId}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Inst\u00e2ncia criada com sucesso',
        instanceName: instanceName,
        qrcode: instanceData.qrcode?.base64
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );

  } catch (error) {
    console.error('Error in create-whatsapp-instance:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
});