import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface CheckInstanceRequest {
  instanceName: string;
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

    const { instanceName }: CheckInstanceRequest = await req.json();

    if (!instanceName) {
      return new Response(
        JSON.stringify({ success: false, error: 'instanceName é obrigatório' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const { data: globalSettings } = await supabaseClient
      .from('global_settings')
      .select('evolution_server_url, evolution_auth_api_key')
      .maybeSingle();

    if (!globalSettings || !globalSettings.evolution_server_url || !globalSettings.evolution_auth_api_key) {
      return new Response(
        JSON.stringify({ success: false, error: 'Servidor Evolution não configurado' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const fetchUrl = `${globalSettings.evolution_server_url}/instance/fetchInstances`;

    console.log('Fetching instances from Evolution API:', fetchUrl);

    const response = await fetch(fetchUrl, {
      method: 'GET',
      headers: {
        'apikey': globalSettings.evolution_auth_api_key
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Evolution API error:', errorText);
      return new Response(
        JSON.stringify({ success: false, error: 'Erro ao buscar instâncias', details: errorText }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const instances = await response.json();
    console.log('Instances found:', instances);

    const instanceExists = Array.isArray(instances) && instances.some(
      (inst: any) => inst.instance?.instanceName === instanceName || inst.instanceName === instanceName
    );

    const matchingInstance = Array.isArray(instances) ? instances.find(
      (inst: any) => inst.instance?.instanceName === instanceName || inst.instanceName === instanceName
    ) : null;

    return new Response(
      JSON.stringify({
        success: true,
        exists: instanceExists,
        instance: matchingInstance,
        allInstances: instances
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );

  } catch (error) {
    console.error('Error checking instance:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
});