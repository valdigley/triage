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
    const format = url.searchParams.get('format'); // 'json' or 'html'

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

    // Get Supabase client
    const { createClient } = await import('npm:@supabase/supabase-js@2');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get gallery info
    const { data: gallery, error } = await supabase
      .from('galleries_triage')
      .select(`
        id,
        name,
        gallery_token,
        preview_image_url,
        og_title,
        og_description,
        appointment:appointments(
          client:clients(
            name
          )
        )
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

    // Get first photo if no preview image set
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

    const clientName = gallery.appointment?.client?.name || 'Cliente';
    const title = gallery.og_title || `Galeria de Fotos - ${clientName}`;
    const description = gallery.og_description || `Confira as fotos da sua sessão e selecione suas favoritas!`;
    const appUrl = Deno.env.get('APP_URL') || 'https://triagem.valdigleysantos.com.br';
    const galleryUrl = `${appUrl}/gallery/${token}`;

    // If format is 'json' or Accept header is application/json, return JSON
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

    // Otherwise return HTML with meta tags for social media crawlers
    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>

  <!-- Open Graph / Facebook / WhatsApp -->
  <meta property="og:type" content="website">
  <meta property="og:url" content="${galleryUrl}">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  ${imageUrl ? `<meta property="og:image" content="${imageUrl}">` : ''}
  ${imageUrl ? `<meta property="og:image:secure_url" content="${imageUrl}">` : ''}
  <meta property="og:image:type" content="image/jpeg">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">

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
  <a href="${galleryUrl}">Clique aqui se não for redirecionado automaticamente</a>
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
