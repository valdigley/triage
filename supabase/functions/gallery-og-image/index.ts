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
        .select('photo_url')
        .eq('gallery_id', gallery.id)
        .limit(1)
        .maybeSingle();
      
      imageUrl = photos?.photo_url || '';
    }

    const clientName = gallery.appointment?.client?.name || 'Cliente';
    const title = gallery.og_title || `Galeria de Fotos - ${clientName}`;
    const description = gallery.og_description || `Confira as fotos da sua sess\u00e3o e selecione suas favoritas!`;

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