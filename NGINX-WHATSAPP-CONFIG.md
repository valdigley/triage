# Configuração Nginx para Preview do WhatsApp

Este guia explica como configurar o Nginx na sua VPS para que as miniaturas do WhatsApp funcionem corretamente.

## 🎯 Objetivo

Quando o WhatsApp acessa `https://triagem.online/g/TOKEN`, ele precisa receber HTML com meta tags Open Graph. Como sua aplicação é uma SPA (React), o Nginx precisa detectar se é um bot e fazer proxy reverso para a Edge Function do Supabase.

## 📋 Passo a Passo

### 1. Localize seu arquivo de configuração Nginx

O arquivo geralmente está em um destes locais:
```bash
/etc/nginx/sites-available/triagem.online
/etc/nginx/conf.d/triagem.online.conf
/etc/nginx/nginx.conf
```

### 2. Adicione a configuração para a rota `/g/`

Abra o arquivo de configuração:
```bash
sudo nano /etc/nginx/sites-available/triagem.online
```

Adicione este bloco **ANTES** do bloco `location /` existente:

```nginx
# Rota especial para preview do WhatsApp
location ~ ^/g/(.+)$ {
    set $token $1;
    set $proxy_to_supabase 0;

    # Detectar bots de redes sociais
    if ($http_user_agent ~* "(WhatsApp|facebookexternalhit|Facebot|Twitterbot|LinkedInBot|Slackbot|TelegramBot|Discordbot)") {
        set $proxy_to_supabase 1;
    }

    # Se for bot, fazer proxy para Edge Function do Supabase
    if ($proxy_to_supabase = 1) {
        proxy_pass https://0ec90b57d6e95fcbda19832f.supabase.co/functions/v1/gallery-og-image?token=$token;
        proxy_set_header Host 0ec90b57d6e95fcbda19832f.supabase.co;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_ssl_server_name on;
        proxy_ssl_protocols TLSv1.2 TLSv1.3;
        break;
    }

    # Se for usuário normal, servir o SPA normalmente
    try_files $uri $uri/ /index.html;
}
```

### 3. Teste a configuração

```bash
sudo nginx -t
```

Se aparecer "syntax is ok" e "test is successful", prossiga.

### 4. Recarregue o Nginx

```bash
sudo systemctl reload nginx
```

### 5. Teste o funcionamento

**Teste 1 - Como bot (simular WhatsApp):**
```bash
curl -A "WhatsApp/2.0" https://triagem.online/g/SEU_TOKEN_DE_TESTE
```

Deve retornar HTML com meta tags Open Graph.

**Teste 2 - Como navegador normal:**
```bash
curl https://triagem.online/g/SEU_TOKEN_DE_TESTE
```

Deve retornar o HTML da sua SPA React.

**Teste 3 - Envie pelo WhatsApp:**
1. Crie uma galeria de teste
2. Copie o link `https://triagem.online/g/TOKEN`
3. Envie para seu próprio WhatsApp
4. Verifique se a miniatura aparece

## 🔧 Exemplo Completo de Configuração

Aqui está um exemplo completo de como seu arquivo pode ficar:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name triagem.online www.triagem.online;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name triagem.online www.triagem.online;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/triagem.online/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/triagem.online/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Root directory
    root /var/www/triagem.online/dist;
    index index.html;

    # Rota especial para preview do WhatsApp
    location ~ ^/g/(.+)$ {
        set $token $1;
        set $proxy_to_supabase 0;

        # Detectar bots de redes sociais
        if ($http_user_agent ~* "(WhatsApp|facebookexternalhit|Facebot|Twitterbot|LinkedInBot|Slackbot|TelegramBot|Discordbot)") {
            set $proxy_to_supabase 1;
        }

        # Se for bot, fazer proxy para Edge Function do Supabase
        if ($proxy_to_supabase = 1) {
            proxy_pass https://0ec90b57d6e95fcbda19832f.supabase.co/functions/v1/gallery-og-image?token=$token;
            proxy_set_header Host 0ec90b57d6e95fcbda19832f.supabase.co;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_ssl_server_name on;
            proxy_ssl_protocols TLSv1.2 TLSv1.3;
            break;
        }

        # Se for usuário normal, servir o SPA normalmente
        try_files $uri $uri/ /index.html;
    }

    # SPA fallback - qualquer outra rota
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache para assets estáticos
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

## 🐛 Resolução de Problemas

### Problema: "502 Bad Gateway" ao acessar `/g/TOKEN`

**Solução:** Verifique se o Nginx consegue acessar o Supabase:
```bash
curl -v https://0ec90b57d6e95fcbda19832f.supabase.co/functions/v1/gallery-og-image?token=test
```

### Problema: Miniatura não aparece no WhatsApp

**Soluções:**
1. Limpe o cache do WhatsApp: Envie o link, espere 5 minutos e envie novamente
2. Teste com o Facebook Debugger: https://developers.facebook.com/tools/debug/
3. Verifique os logs do Nginx: `sudo tail -f /var/log/nginx/error.log`

### Problema: "if" não está funcionando

Nginx tem limitações com `if`. Se não funcionar, use esta alternativa:

```nginx
location ~ ^/g/(.+)$ {
    set $token $1;

    # Proxy reverso direto (sem detecção de bot)
    # A Edge Function já faz redirect para usuários normais
    proxy_pass https://0ec90b57d6e95fcbda19832f.supabase.co/functions/v1/gallery-og-image?token=$token;
    proxy_set_header Host 0ec90b57d6e95fcbda19832f.supabase.co;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_ssl_server_name on;
    proxy_ssl_protocols TLSv1.2 TLSv1.3;
}
```

## ✅ Checklist Final

- [ ] Configuração adicionada ao Nginx
- [ ] Nginx testado com `nginx -t`
- [ ] Nginx recarregado com `systemctl reload nginx`
- [ ] Teste com curl simulando WhatsApp funcionou
- [ ] Link enviado pelo WhatsApp mostra miniatura
- [ ] Cliente consegue acessar a galeria normalmente

## 📞 Suporte

Se tiver problemas, verifique:
1. Logs do Nginx: `sudo tail -f /var/log/nginx/error.log`
2. Status do Nginx: `sudo systemctl status nginx`
3. Permissões do diretório: `ls -la /var/www/triagem.online/`

## 🎉 Resultado Esperado

Quando tudo estiver funcionando:

**WhatsApp acessa:** `https://triagem.online/g/abc123`
- **Vê:** HTML com meta tags Open Graph (título, descrição, imagem)
- **Mostra:** Miniatura bonita no chat

**Cliente clica no link:**
- **É redirecionado para:** `https://triagem.online/gallery/abc123`
- **Vê:** Galeria React funcionando normalmente
