# Como Configurar Preview do WhatsApp

Para que o WhatsApp mostre miniatura ao compartilhar links das galerias (como o Google Drive faz), siga estes passos:

## 1. Criar Imagem de Preview

Você precisa de uma imagem que será exibida no WhatsApp. Esta imagem deve:
- Tamanho recomendado: 1200x630 pixels
- Formato: JPG ou PNG
- Ser representativa do seu serviço (logo, foto de exemplo, etc)

**Opção A: Usar imagem genérica**
- Coloque uma imagem chamada `preview.jpg` no diretório `/var/www/triagem.online/` do seu VPS

**Opção B: Usar imagem existente**
- A imagem `triagem.png` já existe em `public/triagem.png`
- Ela será copiada automaticamente no build

## 2. Configurar Nginx no VPS

Edite o arquivo de configuração do Nginx (provavelmente `/etc/nginx/sites-available/triagem.online`):

```nginx
server {
    listen 80 default_server;
    server_name triagem.online;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2 default_server;
    server_name triagem.online;

    ssl_certificate     /etc/letsencrypt/live/triagem.online/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/triagem.online/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    root /var/www/triagem.online;
    index index.html;

    # Detectar bots do WhatsApp, Facebook, etc
    set $is_bot 0;
    if ($http_user_agent ~* (WhatsApp|facebookexternalhit|Facebot|Twitterbot|LinkedInBot)) {
        set $is_bot 1;
    }

    # Para bots: servir HTML com meta tags
    location ~ ^/g/([a-f0-9]+)$ {
        if ($is_bot = 1) {
            # Servir arquivo HTML estático com meta tags
            try_files /og-gallery.html =404;
        }

        # Para usuários normais: servir a aplicação React
        try_files $uri $uri/ /index.html;
    }

    # Todas as outras rotas
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache para imagens
    location ~* \.(jpg|jpeg|png|gif|ico|svg|webp)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Cache para assets
    location ~* \.(js|css|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

Depois recarregue o Nginx:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

## 3. Fazer Deploy da Aplicação

No seu computador, faça o build e envie para o VPS:

```bash
npm run build
```

Copie os arquivos da pasta `dist/` para `/var/www/triagem.online/` no seu VPS:

```bash
scp -r dist/* root@SEU_IP_VPS:/var/www/triagem.online/
```

Certifique-se de que o arquivo `og-gallery.html` está na pasta `/var/www/triagem.online/`:

```bash
scp dist/og-gallery.html root@SEU_IP_VPS:/var/www/triagem.online/
```

## 4. Testar

### Teste 1: Verificar se o HTML está sendo servido para bots

```bash
curl -A "WhatsApp/2.0" https://triagem.online/g/55d5f40b841853fef8f93def9a485881
```

Deve retornar o HTML com as meta tags Open Graph.

### Teste 2: Verificar se usuários normais veem a aplicação

Acesse `https://triagem.online/g/55d5f40b841853fef8f93def9a485881` no navegador.
Deve abrir a aplicação React normalmente.

### Teste 3: Testar no WhatsApp

1. Abra o WhatsApp Web ou WhatsApp no celular
2. Cole o link: `https://triagem.online/g/55d5f40b841853fef8f93def9a485881`
3. Aguarde alguns segundos
4. Deve aparecer uma miniatura com o título "📸 Galeria de Fotos - Triagem Online"

## 5. Limpar Cache do WhatsApp (se necessário)

Se você já compartilhou o link antes e o WhatsApp ainda mostra sem preview:

1. Acesse: https://developers.facebook.com/tools/debug/
2. Cole o link da galeria
3. Clique em "Scrape Again" para forçar o WhatsApp a buscar novamente

## Personalização

Para personalizar a imagem que aparece no WhatsApp:

1. Edite o arquivo `/var/www/triagem.online/og-gallery.html`
2. Altere a linha:
   ```html
   <meta property="og:image" content="https://triagem.online/triagem.png">
   ```
3. Coloque a URL da sua imagem de preview

## Solução Avançada (Opcional)

Se quiser que cada galeria mostre uma foto diferente no preview:

1. Configure a edge function `gallery-og-image` para gerar HTML dinamicamente
2. Atualize o Nginx para fazer proxy para a edge function quando detectar bots
3. A edge function buscará a primeira foto da galeria e usará como preview

Essa solução é mais complexa e requer configuração adicional.

---

**Dica:** A imagem de preview precisa estar acessível publicamente e não pode estar protegida por autenticação.
