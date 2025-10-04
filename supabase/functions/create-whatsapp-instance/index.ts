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
        JSON.stringify({ success: false, error: 'tenantId é obrigatório' }),
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
        JSON.stringify({ success: false, error: 'Tenant não encontrado' }),
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
          message: 'Instância já existe',
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
        JSON.stringify({ success: false, error: 'Servidor Evolution não configurado' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const normalizeStudioName = (name: string): string => {
      return name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '')
        .substring(0, 20);
    };

    const studioNamePrefix = normalizeStudioName(tenant.name);
    const tenantIdSuffix = tenantId.substring(0, 8);
    const instanceName = `${studioNamePrefix}_${tenantIdSuffix}`;

    const createInstanceUrl = `${globalSettings.evolution_server_url}/instance/create`;

    console.log(`Creating instance ${instanceName} for studio "${tenant.name}" on Evolution API`);
    console.log('Evolution API URL:', createInstanceUrl);
    console.log('Instance name to create:', instanceName);

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

    console.log('Evolution API response status:', createResponse.status);

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.error('Evolution API error response:', errorText);
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { message: errorText };
      }
      console.error('Evolution API error data:', errorData);

      return new Response(
        JSON.stringify({
          success: false,
          error: `Erro Evolution API: ${errorData.message || errorText}`,
          details: errorData
        }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const instanceData = await createResponse.json();
    console.log('Instance created successfully:', instanceData);

    const instanceApiKey = instanceData.hash?.apikey || instanceData.instance?.apikey || globalSettings.evolution_auth_api_key;

    const { error: updateError } = await supabaseClient
      .from('triagem_settings')
      .update({
        evolution_instance_name: instanceName,
        evolution_instance_apikey: instanceApiKey,
        whatsapp_connected: false,
        whatsapp_qrcode: instanceData.qrcode?.base64 || null,
        updated_at: new Date().toISOString()
      })
      .eq('tenant_id', tenantId);

    if (updateError) {
      console.error('Error updating tenant settings:', updateError);
      throw new Error('Erro ao salvar configurações da instância');
    }

    // Sincronizar com triagem_whatsapp_instances
    const { error: instanceError } = await supabaseClient
      .from('triagem_whatsapp_instances')
      .upsert({
        tenant_id: tenantId,
        instance_name: instanceName,
        instance_data: {
          evolution_api_url: globalSettings.evolution_server_url.replace(/\/$/, ''),
          evolution_api_key: instanceApiKey,
          saved_at: new Date().toISOString()
        },
        status: 'created',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'id'
      });

    if (instanceError) {
      console.error('Error syncing whatsapp_instances:', instanceError);
      // Não falhar se apenas a sincronização falhar
    }

    console.log(`Instance ${instanceName} created and configured for tenant ${tenantId}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Instância criada com sucesso',
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