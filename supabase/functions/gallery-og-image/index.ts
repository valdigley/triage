import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
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
    const url = new URL(req.url);
    const token = url.searchParams.get('token');
    const format = url.searchParams.get('format');

    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Token is required' }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      );
    }

    const { createClient } = await import('npm:@supabase/supabase-js@2');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: gallery, error } = await supabase
      .from('triagem_galleries')
      .select(`
        id,
        name,
        gallery_token,
        preview_image_url,
        og_title,
        og_description,
        tenant_id,
        client_id
      `)
      .eq('gallery_token', token)
      .maybeSingle();

    if (error || !gallery) {
      return new Response(
        JSON.stringify({ error: 'Gallery not found' }),
        {
          status: 404,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      );
    }

    let imageUrl = gallery.preview_image_url;

    if (!imageUrl) {
      const { data: photos } = await supabase
        .from('photos_triage')
        .select('url')
        .eq('gallery_id', gallery.id)
        .limit(1)
        .maybeSingle();

      imageUrl = photos?.url || '';
    }

    let clientName = 'Cliente';
    if (gallery.client_id) {
      const { data: client } = await supabase
        .from('triagem_clients')
        .select('name')
        .eq('id', gallery.client_id)
        .maybeSingle();

      clientName = client?.name || 'Cliente';
    }

    const title = gallery.og_title || `Galeria de Fotos - ${clientName}`;
    const description = gallery.og_description || `Confira as fotos da sua sess\u00e3o e selecione suas favoritas!`;

    const { data: settings } = await supabase
      .from('triagem_settings')
      .select('app_url')
      .eq('tenant_id', gallery.tenant_id)
      .maybeSingle();

    const appUrl = settings?.app_url || Deno.env.get('APP_URL') || 'https://triagem.online';
    const galleryUrl = `${appUrl}/g/${token}`;

    const acceptHeader = req.headers.get('Accept') || '';
    if (format === 'json' || acceptHeader.includes('application/json')) {
      return new Response(
        JSON.stringify({
          title,
          description,
          image: imageUrl,
          clientName,
          galleryName: gallery.name
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=3600',
            ...corsHeaders,
          },
        }
      );
    }

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <meta name="description" content="${description}">

  <!-- Open Graph / Facebook / WhatsApp -->
  <meta property="og:type" content="website">
  <meta property="og:url" content="${galleryUrl}">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:site_name" content="Triagem Online">
  <meta property="og:locale" content="pt_BR">
  ${imageUrl ? `<meta property="og:image" content="${imageUrl}">
  <meta property="og:image:secure_url" content="${imageUrl}">
  <meta property="og:image:type" content="image/jpeg">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">` : ''}

  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:url" content="${galleryUrl}">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${description}">
  ${imageUrl ? `<meta name="twitter:image" content="${imageUrl}">` : ''}

  <!-- Redirect to actual gallery page -->
  <meta http-equiv="refresh" content="0;url=${galleryUrl}">
  <script>window.location.href = "${galleryUrl}";</script>
</head>
<body>
  <p>Redirecionando para a galeria...</p>
  <a href="${galleryUrl}">Clique aqui se n\u00e3o for redirecionado automaticamente</a>
</body>
</html>`;

    return new Response(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
        ...corsHeaders,
      },
    });

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({
        error: `Internal error: ${error instanceof Error ? error.message : 'Unknown error'}`
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