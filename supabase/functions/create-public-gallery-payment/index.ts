import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { createClient } = await import('npm:@supabase/supabase-js@2');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const {
      parentGalleryId,
      clientName,
      clientPhone,
      clientEmail,
      selectedPhotos,
      totalAmount,
      eventName
    } = await req.json();

    if (!parentGalleryId || !clientName || !clientPhone || !selectedPhotos || !totalAmount) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Dados obrigatórios não fornecidos'
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      );
    }

    // Get parent gallery to find tenant_id
    const { data: parentGallery, error: parentGalleryError } = await supabase
      .from('triagem_galleries')
      .select('tenant_id')
      .eq('id', parentGalleryId)
      .maybeSingle();

    if (parentGalleryError || !parentGallery) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Galeria não encontrada'
        }),
        {
          status: 404,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      );
    }

    // Get MercadoPago settings for THIS tenant
    const { data: mpSettings, error: mpError } = await supabase
      .from('triagem_mercadopago_settings')
      .select('*')
      .eq('tenant_id', parentGallery.tenant_id)
      .eq('is_active', true)
      .maybeSingle();

    if (mpError || !mpSettings || !mpSettings.access_token) {
      // Buscar chave PIX manual do tenant
      const { data: settings } = await supabase
        .from('triagem_settings')
        .select('pix_key, studio_name')
        .eq('tenant_id', parentGallery.tenant_id)
        .maybeSingle();

      const pixKey = settings?.pix_key;
      const studioName = settings?.studio_name || 'Estúdio';

      // Se há chave PIX, enviar via WhatsApp
      if (pixKey && clientPhone) {
        // Buscar configurações globais da Evolution API
        const { data: globalSettings } = await supabase
          .from('global_settings')
          .select('evolution_server_url, evolution_auth_api_key')
          .maybeSingle();

        // Buscar instância do tenant
        const { data: whatsappInstance } = await supabase
          .from('triagem_whatsapp_instances')
          .select('instance_name')
          .eq('tenant_id', parentGallery.tenant_id)
          .maybeSingle();

        if (globalSettings && whatsappInstance) {
          const message = `🎉 *Galeria Pública - Seleção Confirmada!*\n\n` +
            `Olá *${clientName}*!\n\n` +
            `📸 *Evento:* ${eventName}\n` +
            `🖼️ *Fotos selecionadas:* ${selectedPhotos.length}\n` +
            `💰 *Valor total: R$ ${(totalAmount / 100).toFixed(2)}*\n\n` +
            `*Dados para Pagamento PIX:*\n` +
            `🔑 Chave: \`${pixKey}\`\n` +
            `🏢 Favorecido: ${studioName}\n\n` +
            `Após o pagamento, envie o comprovante para este número.\n\n` +
            `✨ Obrigado por escolher nosso estúdio!`;

          try {
            await fetch(
              `${globalSettings.evolution_server_url}/message/sendText/${whatsappInstance.instance_name}`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'apikey': globalSettings.evolution_auth_api_key
                },
                body: JSON.stringify({
                  number: clientPhone.replace(/\D/g, ''),
                  text: message
                })
              }
            );
          } catch (error) {
            console.error('Error sending WhatsApp message:', error);
          }
        }
      }

      return new Response(
        JSON.stringify({
          success: false,
          error: 'MercadoPago não configurado para este estúdio',
          no_payment_configured: true,
          pix_key: pixKey
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      );
    }

    const nameParts = clientName.trim().split(' ');
    const firstName = nameParts[0] || 'Cliente';
    const lastName = nameParts.slice(1).join(' ') || 'Sobrenome';

    const pixPaymentData = {
      transaction_amount: totalAmount,
      date_of_expiration: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      payment_method_id: "pix",
      external_reference: `public-${parentGalleryId}-${Date.now()}`,
      notification_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/mercadopago-webhook`,
      description: `${selectedPhotos.length} fotos - ${eventName}`,
      metadata: {
        parent_gallery_id: parentGalleryId,
        client_name: clientName,
        client_phone: clientPhone,
        client_email: clientEmail || '',
        selected_photos: JSON.stringify(selectedPhotos),
        photos_count: selectedPhotos.length,
        event_name: eventName
      },
      payer: {
        first_name: firstName,
        last_name: lastName,
        email: clientEmail || 'cliente@exemplo.com',
        identification: {
          type: "CPF",
          number: "11111111111"
        }
      }
    };

    console.log('Creating PIX payment for public gallery:', JSON.stringify(pixPaymentData, null, 2));

    const pixResponse = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${mpSettings.access_token}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': `public-${parentGalleryId}-${Date.now()}`
      },
      body: JSON.stringify(pixPaymentData)
    });

    if (!pixResponse.ok) {
      const errorData = await pixResponse.json();
      console.error('MercadoPago PIX Error:', errorData);
      return new Response(
        JSON.stringify({
          success: false,
          error: `Erro do MercadoPago: ${errorData.message || 'Erro desconhecido'}`
        }),
        {
          status: pixResponse.status,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      );
    }

    const pixData = await pixResponse.json();
    console.log('PIX payment created for public gallery:', JSON.stringify(pixData, null, 2));

    const qrCode = pixData.point_of_interaction?.transaction_data?.qr_code;
    const qrCodeBase64 = pixData.point_of_interaction?.transaction_data?.qr_code_base64;

    return new Response(
      JSON.stringify({
        success: true,
        payment_id: pixData.id.toString(),
        status: pixData.status,
        qr_code: qrCode,
        qr_code_base64: qrCodeBase64,
        expires_at: pixPaymentData.date_of_expiration
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );

  } catch (error) {
    console.error('Error creating public gallery payment:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: `Erro interno: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  }
});