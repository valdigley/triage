import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function generateToken(length: number = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  const randomValues = new Uint8Array(length);
  crypto.getRandomValues(randomValues);
  for (let i = 0; i < length; i++) {
    token += chars[randomValues[i] % chars.length];
  }
  return token;
}

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

    const tenantId = parentGallery.tenant_id;

    // Criar ou atualizar cliente
    const { data: existingClient } = await supabase
      .from('triagem_clients')
      .select('*')
      .eq('phone', clientPhone)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    let clientId: string;

    if (existingClient) {
      clientId = existingClient.id;
      await supabase
        .from('triagem_clients')
        .update({
          name: clientName,
          email: clientEmail,
          updated_at: new Date().toISOString()
        })
        .eq('id', clientId);
    } else {
      const { data: newClient, error: clientError } = await supabase
        .from('triagem_clients')
        .insert([{
          name: clientName,
          email: clientEmail,
          phone: clientPhone,
          tenant_id: tenantId
        }])
        .select()
        .single();

      if (clientError) throw clientError;
      clientId = newClient.id;
    }

    // Criar galeria individual para o cliente com suas fotos selecionadas
    const galleryToken = generateToken(32);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 dias de validade

    const { data: newGallery, error: galleryError } = await supabase
      .from('triagem_galleries')
      .insert([{
        client_id: clientId,
        tenant_id: tenantId,
        name: `${eventName || 'Evento'} - ${clientName}`,
        gallery_token: galleryToken,
        link_expires_at: expiresAt.toISOString(),
        is_public: false,
        status: 'pending',
        event_name: eventName
      }])
      .select()
      .single();

    if (galleryError) {
      console.error('Erro ao criar galeria:', galleryError);
      throw new Error('Erro ao criar galeria');
    }

    console.log('✅ Galeria individual criada:', newGallery.id);

    // Criar registro de pagamento pendente
    const { data: paymentRecord, error: paymentError } = await supabase
      .from('triagem_payments')
      .insert([{
        client_id: clientId,
        gallery_id: newGallery.id,
        tenant_id: tenantId,
        amount: totalAmount,
        status: 'pending',
        payment_type: 'public_gallery',
        metadata: {
          parent_gallery_id: parentGalleryId,
          selected_photos: selectedPhotos,
          photos_count: selectedPhotos.length,
          event_name: eventName
        }
      }])
      .select()
      .single();

    if (paymentError) {
      console.error('Erro ao criar pagamento:', paymentError);
      throw new Error('Erro ao criar registro de pagamento');
    }

    console.log('✅ Pagamento pendente criado:', paymentRecord.id);

    // Buscar configurações do tenant
    const { data: settings } = await supabase
      .from('triagem_settings')
      .select('pix_key, studio_name')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    // Verificar se tem MercadoPago configurado
    const { data: mpSettings, error: mpError } = await supabase
      .from('triagem_mercadopago_settings')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .maybeSingle();

    if (mpError || !mpSettings || !mpSettings.access_token) {
      console.log('⚠️ MercadoPago não configurado - fluxo PIX manual');

      const pixKey = settings?.pix_key;
      const studioName = settings?.studio_name || 'Estúdio';

      // Agendar notificação via fila
      if (pixKey && clientPhone) {
        console.log('📲 Agendando notificação via fila...');

        try {
          const { error: notifError } = await supabase
            .from('triagem_notification_queue')
            .insert({
              appointment_id: newGallery.id, // Usar gallery_id como referência
              tenant_id: tenantId,
              template_type: 'pix_public_gallery',
              recipient_phone: clientPhone,
              recipient_name: clientName,
              scheduled_for: new Date().toISOString(),
              template_data: {
                client_name: clientName,
                studio_name: studioName,
                pix_key: pixKey,
                amount: `R$ ${(totalAmount / 100).toFixed(2)}`,
                event_name: eventName || 'Evento',
                photos_count: selectedPhotos.length.toString()
              },
              status: 'pending'
            });

          if (notifError) {
            console.error('❌ Erro ao agendar notificação:', notifError);
          } else {
            console.log('✅ Notificação agendada na fila');
          }
        } catch (error) {
          console.error('❌ Erro ao agendar notificação:', error);
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          gallery_id: newGallery.id,
          gallery_token: galleryToken,
          payment_id: paymentRecord.id,
          no_payment_configured: true,
          pix_key: pixKey,
          message: 'Seleção registrada. Pagamento pendente para baixa manual.'
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      );
    }

    // Tem MercadoPago - gerar QR Code PIX
    console.log('💳 Gerando QR Code PIX...');

    const nameParts = clientName.trim().split(' ');
    const firstName = nameParts[0] || 'Cliente';
    const lastName = nameParts.slice(1).join(' ') || 'Sobrenome';

    const pixPaymentData = {
      transaction_amount: totalAmount,
      date_of_expiration: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      payment_method_id: "pix",
      external_reference: paymentRecord.id,
      notification_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/mercadopago-webhook`,
      description: `${selectedPhotos.length} fotos - ${eventName}`,
      metadata: {
        parent_gallery_id: parentGalleryId,
        gallery_id: newGallery.id,
        client_name: clientName,
        client_phone: clientPhone,
        client_email: clientEmail || '',
        selected_photos: JSON.stringify(selectedPhotos),
        photos_count: selectedPhotos.length,
        event_name: eventName,
        payment_type: 'public_gallery'
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

    // Atualizar pagamento com ID do MercadoPago
    await supabase
      .from('triagem_payments')
      .update({
        mercadopago_id: pixData.id.toString(),
        status: pixData.status
      })
      .eq('id', paymentRecord.id);

    const qrCode = pixData.point_of_interaction?.transaction_data?.qr_code;
    const qrCodeBase64 = pixData.point_of_interaction?.transaction_data?.qr_code_base64;

    return new Response(
      JSON.stringify({
        success: true,
        gallery_id: newGallery.id,
        gallery_token: galleryToken,
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
