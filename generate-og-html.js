// Script para gerar páginas HTML estáticas para Open Graph
// Executar após deploy para cada galeria criada

const fs = require('fs');
const path = require('path');

function generateOGHtml(galleryToken, title, description, imageUrl, appUrl = 'https://triagem.online') {
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>

  <!-- Open Graph / Facebook / WhatsApp -->
  <meta property="og:type" content="website">
  <meta property="og:url" content="${appUrl}/g/${galleryToken}">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  ${imageUrl ? `<meta property="og:image" content="${imageUrl}">` : ''}
  ${imageUrl ? `<meta property="og:image:secure_url" content="${imageUrl}">` : ''}
  <meta property="og:image:type" content="image/jpeg">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">

  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:url" content="${appUrl}/g/${galleryToken}">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${description}">
  ${imageUrl ? `<meta name="twitter:image" content="${imageUrl}">` : ''}

  <!-- Redirect to actual gallery page -->
  <meta http-equiv="refresh" content="0;url=${appUrl}/gallery/${galleryToken}">
  <script>window.location.href = "${appUrl}/gallery/${galleryToken}";</script>
</head>
<body>
  <p>Redirecionando para a galeria...</p>
  <a href="${appUrl}/gallery/${galleryToken}">Clique aqui se não for redirecionado automaticamente</a>
</body>
</html>`;

  return html;
}

// Exemplo de uso
const token = process.argv[2] || 'example-token';
const title = process.argv[3] || 'Galeria de Fotos';
const description = process.argv[4] || 'Confira as fotos da sua sessão!';
const imageUrl = process.argv[5] || '';

const html = generateOGHtml(token, title, description, imageUrl);
console.log(html);

module.exports = { generateOGHtml };
