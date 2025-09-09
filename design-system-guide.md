# 🎨 Sistema de Design - Valdigley Santos

## 📋 Como Usar

### 1. **Instalação**
```html
<!-- Adicione no <head> do seu HTML -->
<link rel="stylesheet" href="design-system.css">
```

### 2. **Estrutura Base**
```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Seu Projeto</title>
    <link rel="stylesheet" href="design-system.css">
    <!-- Seus outros CSS aqui -->
</head>
<body>
    <!-- Seu conteúdo aqui -->
</body>
</html>
```

## 🎯 Componentes Principais

### **Botões**
```html
<!-- Botões básicos -->
<button class="btn btn-primary">Primário</button>
<button class="btn btn-secondary">Secundário</button>
<button class="btn btn-success">Sucesso</button>
<button class="btn btn-danger">Perigo</button>
<button class="btn btn-warning">Aviso</button>

<!-- Tamanhos -->
<button class="btn btn-primary btn-sm">Pequeno</button>
<button class="btn btn-primary">Normal</button>
<button class="btn btn-primary btn-lg">Grande</button>
<button class="btn btn-primary btn-xl">Extra Grande</button>

<!-- Estados -->
<button class="btn btn-primary" disabled>Desabilitado</button>
<button class="btn btn-primary loading">
    <span class="loading-spinner"></span>
    Carregando...
</button>
```

### **Cards**
```html
<div class="card">
    <div class="card-header">
        <h3 class="heading-4">Título do Card</h3>
    </div>
    <div class="card-body">
        <p class="text-body">Conteúdo do card aqui.</p>
    </div>
    <div class="card-footer">
        <button class="btn btn-primary">Ação</button>
    </div>
</div>
```

### **Formulários**
```html
<form>
    <div class="form-group">
        <label class="form-label">Nome</label>
        <input type="text" class="input" placeholder="Digite seu nome">
        <div class="form-help">Texto de ajuda opcional</div>
    </div>
    
    <div class="form-group">
        <label class="form-label">E-mail</label>
        <input type="email" class="input input-error" placeholder="email@exemplo.com">
        <div class="form-error">E-mail é obrigatório</div>
    </div>
    
    <button type="submit" class="btn btn-primary">Enviar</button>
</form>
```

### **Alertas**
```html
<div class="alert alert-success">✅ Operação realizada com sucesso!</div>
<div class="alert alert-error">❌ Ocorreu um erro. Tente novamente.</div>
<div class="alert alert-warning">⚠️ Atenção: Verifique os dados.</div>
<div class="alert alert-info">ℹ️ Informação importante.</div>
```

### **Badges**
```html
<span class="badge badge-primary">Novo</span>
<span class="badge badge-success">Ativo</span>
<span class="badge badge-error">Erro</span>
<span class="badge badge-warning">Pendente</span>
<span class="badge badge-info">Info</span>
<span class="badge badge-neutral">Neutro</span>
```

### **Modais**
```html
<div class="modal-backdrop">
    <div class="modal" style="width: 500px;">
        <div class="card">
            <div class="card-header">
                <h3 class="heading-4">Título do Modal</h3>
            </div>
            <div class="card-body">
                <p class="text-body">Conteúdo do modal aqui.</p>
            </div>
            <div class="card-footer">
                <button class="btn btn-secondary">Cancelar</button>
                <button class="btn btn-primary">Confirmar</button>
            </div>
        </div>
    </div>
</div>
```

## 🎨 Sistema de Cores

### **Paleta Principal**
- **Primary (Cinza):** `var(--primary-500)` - Cor principal neutra
- **Secondary (Roxo):** `var(--secondary-600)` - Cor de destaque
- **Success (Verde):** `var(--success-600)` - Sucesso/confirmação
- **Error (Vermelho):** `var(--error-600)` - Erros/perigo
- **Warning (Amarelo):** `var(--warning-600)` - Avisos
- **Info (Azul):** `var(--info-600)` - Informações

### **Como Usar**
```css
/* Em CSS customizado */
.meu-componente {
    background-color: var(--secondary-600);
    color: white;
    border: 1px solid var(--secondary-700);
}

.meu-componente:hover {
    background-color: var(--secondary-700);
}
```

## 📐 Sistema de Espaçamento

### **Escala 8px**
- `var(--space-1)` = 4px
- `var(--space-2)` = 8px
- `var(--space-3)` = 12px
- `var(--space-4)` = 16px
- `var(--space-6)` = 24px
- `var(--space-8)` = 32px
- `var(--space-12)` = 48px

### **Classes Utilitárias**
```html
<!-- Padding -->
<div class="p-4">Padding 16px</div>
<div class="px-6 py-3">Padding horizontal 24px, vertical 12px</div>

<!-- Margin -->
<div class="mb-4">Margin bottom 16px</div>
<div class="mx-auto">Margin horizontal auto (centralizar)</div>

<!-- Espaçamento entre elementos -->
<div class="space-y-4">
    <div>Item 1</div>
    <div>Item 2</div> <!-- 16px de espaço acima -->
</div>
```

## 📱 Layout Responsivo

### **Grid System**
```html
<!-- Grid responsivo -->
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
    <div class="card">Item 1</div>
    <div class="card">Item 2</div>
    <div class="card">Item 3</div>
</div>
```

### **Flexbox**
```html
<!-- Flex layouts -->
<div class="flex items-center justify-between">
    <h1>Título</h1>
    <button class="btn btn-primary">Ação</button>
</div>

<div class="flex flex-col space-y-4">
    <div>Item 1</div>
    <div>Item 2</div>
</div>
```

## 🌙 Modo Escuro

### **Ativação**
```html
<!-- Adicione a classe 'dark' no elemento raiz -->
<html class="dark">
<!-- ou -->
<body class="dark">
```

### **JavaScript Toggle**
```javascript
function toggleDarkMode() {
    document.documentElement.classList.toggle('dark');
    localStorage.setItem('darkMode', 
        document.documentElement.classList.contains('dark')
    );
}

// Carregar preferência salva
if (localStorage.getItem('darkMode') === 'true') {
    document.documentElement.classList.add('dark');
}
```

## 🎯 Componentes Específicos

### **Galeria de Fotos**
```html
<div class="photo-grid">
    <div class="photo-card">
        <img src="foto1.jpg" alt="Foto 1">
        <div class="photo-overlay">
            <span>Foto 1</span>
        </div>
    </div>
    <div class="photo-card selected">
        <img src="foto2.jpg" alt="Foto 2">
        <div class="photo-overlay">
            <span>Foto 2 - Selecionada</span>
        </div>
    </div>
</div>
```

### **Dashboard Stats**
```html
<div class="grid grid-cols-1 md:grid-cols-4 gap-6">
    <div class="stat-card">
        <div class="flex items-center justify-between">
            <div>
                <div class="stat-value">150</div>
                <div class="stat-label">Total de Clientes</div>
            </div>
            <div class="stat-icon" style="background-color: var(--success-100);">
                <svg class="h-6 w-6" style="color: var(--success-600);">...</svg>
            </div>
        </div>
    </div>
</div>
```

### **Formulário de Agendamento**
```html
<div class="booking-step">
    <div class="step-indicator">
        <div class="step-circle completed">1</div>
        <div class="step-circle active">2</div>
        <div class="step-circle pending">3</div>
    </div>
    
    <h2 class="heading-2">Dados Pessoais</h2>
    
    <form class="space-y-4">
        <div class="form-group">
            <label class="form-label">Nome Completo</label>
            <input type="text" class="input" placeholder="Digite seu nome">
        </div>
        
        <button type="submit" class="btn btn-primary w-full">
            Continuar
        </button>
    </form>
</div>
```

## 🔧 Customização

### **Sobrescrever Cores**
```css
/* No seu CSS customizado */
:root {
    /* Mudar cor primária para azul */
    --secondary-600: #2563eb;
    --secondary-700: #1d4ed8;
    
    /* Mudar fonte */
    font-family: 'Roboto', sans-serif;
}
```

### **Adicionar Componentes**
```css
/* Seus componentes customizados */
.meu-componente-especial {
    background-color: var(--bg-tertiary);
    border: var(--border-width) solid var(--border-primary);
    border-radius: var(--border-radius-lg);
    padding: var(--space-4);
    box-shadow: var(--shadow-sm);
    transition: all var(--transition-normal);
}

.meu-componente-especial:hover {
    box-shadow: var(--shadow-md);
    transform: translateY(-2px);
}
```

## 📱 Breakpoints

- **sm:** 640px+
- **md:** 768px+
- **lg:** 1024px+
- **xl:** 1280px+

## ✨ Animações Incluídas

- **fade-in:** Fade suave
- **slide-up:** Deslizar para cima
- **pulse:** Pulsação
- **loading-spinner:** Spinner de carregamento
- **skeleton-loading:** Efeito skeleton

## 🎯 Exemplos de Uso

### **Página de Login**
```html
<div class="min-h-screen flex items-center justify-center" style="background: var(--gradient-hero);">
    <div class="card" style="width: 400px;">
        <div class="card-header text-center">
            <h1 class="heading-2">Login</h1>
        </div>
        <div class="card-body">
            <form class="space-y-4">
                <div class="form-group">
                    <label class="form-label">E-mail</label>
                    <input type="email" class="input" placeholder="seu@email.com">
                </div>
                <div class="form-group">
                    <label class="form-label">Senha</label>
                    <input type="password" class="input" placeholder="••••••••">
                </div>
                <button type="submit" class="btn btn-primary w-full">
                    Entrar
                </button>
            </form>
        </div>
    </div>
</div>
```

### **Dashboard**
```html
<div class="container">
    <div class="mb-8">
        <h1 class="heading-1">Dashboard</h1>
        <p class="text-small">Visão geral do sistema</p>
    </div>
    
    <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <!-- Stats cards aqui -->
    </div>
    
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Conteúdo principal aqui -->
    </div>
</div>
```

## 🚀 Benefícios

✅ **Consistência** - Mesmo visual em todos os projetos
✅ **Responsivo** - Funciona em mobile, tablet e desktop
✅ **Modo Escuro** - Suporte nativo
✅ **Acessibilidade** - Foco, contraste e motion
✅ **Performance** - Otimizado para velocidade
✅ **Manutenível** - Variáveis CSS organizadas
✅ **Flexível** - Fácil de customizar

## 📞 Suporte

Para dúvidas ou sugestões sobre o sistema de design, entre em contato!