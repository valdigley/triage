# WhatsApp Preview - Configuração Completa 📱

Este projeto está configurado para mostrar miniaturas quando você compartilha links de galerias no WhatsApp, **igual ao Google Drive**!

## ✅ O que já está funcionando

### 1. Edge Function `gallery-og-image`
- Gera HTML com meta tags Open Graph dinamicamente
- Busca dados da galeria no banco
- Usa a primeira foto como miniatura se não houver preview definido
- **Configurada como pública** (não precisa autenticação)

### 2. Redirects Automáticos
Arquivo `netlify.toml` configurado para:
- Detectar bots do WhatsApp/Facebook/Twitter
- Redirecionar para a edge function
- Usuários normais veem a aplicação React

### 3. Script de Geração de OG Pages
- `generate-og-html.js` cria páginas HTML estáticas
- Roda automaticamente após `npm run build`
- Cada galeria tem seu próprio arquivo `/g/{token}.html`

### 4. Arquivo de Fallback
- `public/gallery-preview.html` como backup
- Usado se os redirects falharem

## 🚀 Como fazer deploy

### Opção 1: Deploy simples (funciona 90% dos casos)

```bash
npm run build
```

Depois copie a pasta `dist/` para seu servidor VPS.

### Opção 2: Com geração de OG pages (recomendado)

Se você quiser gerar páginas HTML estáticas para cada galeria:

```bash
# 1. Certifique-se que o .env está configurado
cat .env

# 2. Gere as páginas OG
npm run generate:og

# 3. Faça o build
npm run build:only
```

Isso criará arquivos `/g/{token}.html` para cada galeria.

## 📸 Como o WhatsApp vê os links

Quando você cola um link `https://triagem.online/g/TOKEN` no WhatsApp:

1. **Bot do WhatsApp acessa o link**
2. **Netlify detecta que é um bot** (via User-Agent)
3. **Redireciona para a edge function**
4. **Edge function retorna HTML com meta tags:**
   ```html
   <meta property="og:title" content="📸 Galeria - Cliente">
   <meta property="og:description" content="Veja suas fotos!">
   <meta property="og:image" content="https://url-da-foto.jpg">
   ```
5. **WhatsApp lê as meta tags e mostra a miniatura** 🎉
6. **Usuário clica e é redirecionado para a galeria React**

## 🔧 Testando localmente

### Testar se a edge function está funcionando:

```bash
curl "https://0ec90b57d6e95fcbda19832f.supabase.co/functions/v1/gallery-og-image?token=SEU_TOKEN"
```

Deve retornar HTML com meta tags.

### Testar no WhatsApp:

1. Pegue um link de galeria: `https://triagem.online/g/TOKEN`
2. Cole no WhatsApp
3. Aguarde 3-5 segundos
4. A miniatura deve aparecer!

### Se não aparecer miniatura:

Use o **Facebook Debugger** para forçar o WhatsApp a buscar novamente:

1. Acesse: https://developers.facebook.com/tools/debug/
2. Cole o link da galeria
3. Clique em "Scrape Again"
4. Veja se as meta tags estão corretas
5. Tente compartilhar no WhatsApp novamente

## 📝 Personalizando as meta tags

### Opção 1: Definir no banco de dados

Ao criar uma galeria, defina:
- `og_title`: Título que aparece no preview
- `og_description`: Descrição que aparece no preview
- `preview_image_url`: URL da imagem de preview

```sql
UPDATE galleries_triage
SET
  og_title = '📸 Sessão de Fotos - Maria Silva',
  og_description = 'Confira as 50 fotos da sua sessão!',
  preview_image_url = 'https://exemplo.com/capa.jpg'
WHERE gallery_token = 'TOKEN';
```

### Opção 2: Editar o HTML estático

Se você gerou páginas estáticas, edite diretamente:

```bash
nano dist/g/TOKEN.html
```

Altere as meta tags manualmente.

## 🎨 Usando imagens diferentes para cada galeria

A edge function automaticamente:
1. Verifica se tem `preview_image_url` definido
2. Se não, pega a primeira foto da galeria
3. Se não tiver fotos, usa a imagem padrão `/triagem.png`

Para definir uma imagem específica:

```javascript
// No código, ao criar galeria:
const { data } = await supabase
  .from('galleries_triage')
  .update({
    preview_image_url: 'https://exemplo.com/foto-capa.jpg'
  })
  .eq('id', galleryId);
```

## 🐛 Troubleshooting

### Preview não aparece no WhatsApp

**Causa 1**: WhatsApp ainda tem o link em cache
- **Solução**: Use o Facebook Debugger para limpar cache

**Causa 2**: A imagem não está acessível publicamente
- **Solução**: Certifique-se que a URL da imagem não requer autenticação

**Causa 3**: As meta tags não estão sendo geradas
- **Solução**: Teste a edge function diretamente com curl

### Redirect não funciona

**Causa**: Netlify não detecta o bot
- **Solução**: Verifique se `netlify.toml` está na raiz do projeto

### Build falha ao gerar OG pages

**Causa**: Sem conexão com Supabase durante build
- **Solução**: Isso é normal! O script é opcional e silencioso

## 📚 Arquivos importantes

```
projeto/
├── supabase/functions/gallery-og-image/    # Edge function principal
├── public/
│   ├── _redirects                           # Redirects antigos (backup)
│   └── gallery-preview.html                 # Fallback HTML
├── netlify.toml                             # Configuração de redirects
├── generate-og-html.js                      # Script de geração
└── dist/g/                                  # Páginas OG geradas (após build)
    └── TOKEN.html
```

## 🎯 Resumo

**Para funcionamento básico:**
- ✅ Edge function já está configurada e pública
- ✅ Redirects já estão configurados
- ✅ Só fazer `npm run build` e deploy

**Para otimização (opcional):**
- 🔧 Defina `preview_image_url` nas galerias
- 🔧 Customize `og_title` e `og_description`
- 🔧 Gere páginas HTML estáticas com `npm run generate:og`

---

**Dica**: O mais importante é que a imagem usada como preview esteja **acessível publicamente** e tenha um bom tamanho (recomendado 1200x630px).
