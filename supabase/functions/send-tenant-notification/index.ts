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
        JSON.stringify({ success: false, error: 'tenantId e eventType são obrigatórios' }),
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

    const phoneNumber = tenant.whatsapp_number || tenant.phone;

    if (!phoneNumber) {
      console.log('Tenant has no phone number, skipping notification');
      return new Response(
        JSON.stringify({ success: true, message: 'Tenant sem número de telefone' }),
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
        JSON.stringify({ success: false, error: 'Template não encontrado' }),
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

    let tenantSettings = await supabaseClient
      .from('triagem_settings')
      .select('evolution_instance_name, evolution_instance_apikey, whatsapp_connected')
      .eq('tenant_id', tenantId)
      .maybeSingle()
      .then(res => res.data);

    // Se não tem instância, tentar criar automaticamente
    if (!tenantSettings || !tenantSettings.evolution_instance_name || !tenantSettings.evolution_instance_apikey) {
      console.log(`Tenant WhatsApp instance not configured. Attempting to create...`);

      try {
        const createInstanceUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/create-whatsapp-instance`;
        const createResponse = await fetch(createInstanceUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
          },
          body: JSON.stringify({ tenantId })
        });

        if (!createResponse.ok) {
          console.error('Failed to create instance automatically');
          return new Response(
            JSON.stringify({ success: false, error: 'Instância WhatsApp do tenant não configurada. Execute a configuração manual.' }),
            { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
          );
        }

        // Buscar novamente as configurações
        tenantSettings = await supabaseClient
          .from('triagem_settings')
          .select('evolution_instance_name, evolution_instance_apikey, whatsapp_connected')
          .eq('tenant_id', tenantId)
          .maybeSingle()
          .then(res => res.data);
      } catch (err) {
        console.error('Error creating instance:', err);
        return new Response(
          JSON.stringify({ success: false, error: 'Erro ao criar instância WhatsApp' }),
          { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }
    }

    if (!tenantSettings || !tenantSettings.whatsapp_connected) {
      console.warn(`Tenant WhatsApp not connected. Notification will be logged but not sent.`);

      // Log como pendente
      await supabaseClient
        .from('triagem_tenant_notification_log')
        .insert([{
          tenant_id: tenantId,
          event_type: eventType,
          phone_number: phoneNumber,
          message: message,
          status: 'pending',
          error_message: 'WhatsApp não conectado'
        }]);

      return new Response(
        JSON.stringify({
          success: true,
          warning: 'WhatsApp do tenant não conectado. Notificação registrada como pendente.',
          qrCodeRequired: true
        }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const { data: globalSettings } = await supabaseClient
      .from('global_settings')
      .select('evolution_server_url')
      .maybeSingle();

    if (!globalSettings || !globalSettings.evolution_server_url) {
      console.error('Evolution server URL not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Servidor Evolution não configurado' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const evolutionUrl = `${globalSettings.evolution_server_url}/message/sendText/${tenantSettings.evolution_instance_name}`;

    console.log(`Sending notification to ${phoneNumber} via instance ${tenantSettings.evolution_instance_name}`);

    const evolutionResponse = await fetch(evolutionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': tenantSettings.evolution_instance_apikey
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
        message: 'Notificação enviada com sucesso',
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
