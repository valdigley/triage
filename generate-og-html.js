#!/usr/bin/env node
// Script to generate static HTML pages with Open Graph tags for WhatsApp preview
// This ensures WhatsApp shows thumbnails when sharing gallery links

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env file
config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.log('ℹ️  Skipping OG page generation (no Supabase credentials).');
  console.log('   OG pages will be generated at runtime by the edge function.');
  process.exit(0);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function generateOGPages() {
  console.log('🔍 Fetching galleries from database...');

  const { data: galleries, error } = await supabase
    .from('triagem_galleries')
    .select(`
      id,
      gallery_token,
      name,
      preview_image_url,
      og_title,
      og_description,
      appointment:triagem_appointments(
        client:triagem_clients(name)
      )
    `);

  if (error) {
    console.log('⚠️  Could not fetch galleries. This is OK during build.');
    console.log('   The OG pages will be generated at runtime by the edge function.');
    return;
  }

  if (!galleries || galleries.length === 0) {
    console.log('ℹ️  No galleries found. Create some galleries first!');
    return;
  }

  console.log(`📸 Found ${galleries.length} galleries`);

  const distGDir = path.join(__dirname, 'dist', 'g');
  if (!fs.existsSync(distGDir)) {
    fs.mkdirSync(distGDir, { recursive: true });
  }

  let generated = 0;
  for (const gallery of galleries) {
    const token = gallery.gallery_token;
    let imageUrl = gallery.preview_image_url;

    if (!imageUrl) {
      const { data: photos } = await supabase
        .from('photos_triage')
        .select('url')
        .eq('gallery_id', gallery.id)
        .limit(1)
        .maybeSingle();

      imageUrl = photos?.url || 'https://triagem.online/triagem.png';
    }

    const clientName = gallery.appointment?.client?.name || 'Cliente';
    const title = gallery.og_title || `📸 Galeria de Fotos - ${clientName}`;
    const description = gallery.og_description || 'Visualize e selecione suas fotos favoritas!';

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>

  <!-- Open Graph / WhatsApp -->
  <meta property="og:type" content="website">
  <meta property="og:url" content="https://triagem.online/g/${token}">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:image" content="${imageUrl}">
  <meta property="og:image:secure_url" content="${imageUrl}">
  <meta property="og:image:type" content="image/jpeg">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:site_name" content="Triagem Online">

  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${description}">
  <meta name="twitter:image" content="${imageUrl}">

  <!-- Redirect -->
  <meta http-equiv="refresh" content="0;url=/gallery/${token}">
  <script>window.location.href='/gallery/${token}';</script>

  <style>
    body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;margin:0}
    .loader{text-align:center}.spinner{border:4px solid rgba(255,255,255,.3);border-radius:50%;border-top:4px solid #fff;width:40px;height:40px;animation:spin 1s linear infinite;margin:20px auto}
    @keyframes spin{to{transform:rotate(360deg)}}
  </style>
</head>
<body>
  <div class="loader">
    <h2>📸 ${clientName}</h2>
    <div class="spinner"></div>
    <p>Carregando galeria...</p>
  </div>
</body>
</html>`;

    const filePath = path.join(distGDir, `${token}.html`);
    fs.writeFileSync(filePath, html);
    generated++;
    console.log(`  ✅ /g/${token}.html`);
  }

  console.log(`\n🎉 Generated ${generated} Open Graph pages in dist/g/`);
  console.log('💡 These pages will show previews when shared on WhatsApp!');
}

generateOGPages().catch(console.error);
