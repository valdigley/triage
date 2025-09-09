# Integração do Site Principal (https://fotografo.site/)

## 1. Adicionar Utilitários de Sessão

Crie ou adicione ao arquivo `utils/sessionManager.js` (ou `.ts`):

```javascript
import { supabase } from '../lib/supabase'; // Usar o mesmo cliente Supabase

/**
 * Criar sessão compartilhada após login bem-sucedido
 */
export async function createSharedSession(userId) {
  try {
    console.log('🔐 Criando sessão compartilhada para usuário:', userId);
    
    // Gerar token único e seguro
    const sessionToken = `session_${Date.now()}_${Math.random().toString(36).substring(2)}_${Math.random().toString(36).substring(2)}`;
    
    // Definir expiração (24 horas)
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Obter informações do navegador para segurança
    let ipAddress = 'unknown';
    try {
      const ipResponse = await fetch('https://api.ipify.org?format=json');
      const ipData = await ipResponse.json();
      ipAddress = ipData.ip;
    } catch (error) {
      console.warn('Não foi possível obter IP:', error);
    }

    const userAgent = navigator.userAgent;

    // Invalidar sessões antigas do mesmo usuário (máximo 1 sessão ativa por usuário)
    await supabase
      .from('user_sessions')
      .update({ 
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('is_active', true);

    // Criar nova sessão
    const { data, error } = await supabase
      .from('user_sessions')
      .insert({
        user_id: userId,
        session_token: sessionToken,
        is_active: true,
        expires_at: expiresAt.toISOString(),
        ip_address: ipAddress,
        user_agent: userAgent
      })
      .select()
      .single();

    if (error) throw error;

    console.log('✅ Sessão compartilhada criada:', sessionToken.substring(0, 20) + '...');
    return sessionToken;

  } catch (error) {
    console.error('❌ Erro ao criar sessão compartilhada:', error);
    return null;
  }
}

/**
 * Gerar URLs para sistemas com token de sessão
 */
export function generateSystemUrl(sessionToken, systemName) {
  const systemUrls = {
    'triagem': 'https://triagem.fotografo.site',
    'contrato': 'https://contrato.fotografo.site',
    'drive': 'https://drive.fotografo.site',
    'formatura': 'https://formatura.fotografo.site',
    'dremedio': 'https://dremedio.shop'
  };
  
  const baseUrl = systemUrls[systemName];
  if (!baseUrl) {
    console.error('Sistema não encontrado:', systemName);
    return null;
  }
  
  const url = new URL(baseUrl);
  url.searchParams.set('session_token', sessionToken);
  return url.toString();
}

/**
 * Redirecionar para sistema específico
 */
export async function redirectToSystem(userId, systemName) {
  try {
    console.log('🚀 Redirecionando para sistema:', systemName);
    
    // Criar sessão compartilhada
    const sessionToken = await createSharedSession(userId);
    
    if (!sessionToken) {
      alert('Erro ao criar sessão. Tente novamente.');
      return false;
    }
    
    // Gerar URL do sistema
    const systemUrl = generateSystemUrl(sessionToken, systemName);
    
    if (!systemUrl) {
      alert('Sistema não encontrado. Verifique o nome.');
      return false;
    }
    
    console.log('🔗 Redirecionando para:', systemUrl);
    
    // Redirecionar
    window.location.href = systemUrl;
    return true;
    
  } catch (error) {
    console.error('❌ Erro ao redirecionar:', error);
    alert('Erro ao acessar sistema. Tente novamente.');
    return false;
  }
}
```

## 2. Modificar o Componente de Login

No seu componente de login existente, adicione após login bem-sucedido:

```javascript
// Exemplo no handleLogin ou função similar
const handleLogin = async (email, password) => {
  try {
    // Seu código de login existente
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;
    
    // ✅ ADICIONAR ESTA PARTE:
    // Criar sessão compartilhada após login bem-sucedido
    if (data.user) {
      try {
        const sessionToken = await createSharedSession(data.user.id);
        if (sessionToken) {
          console.log('✅ Sessão compartilhada criada para futuros acessos');
          // Opcional: salvar no localStorage para uso posterior
          localStorage.setItem('shared_session_token', sessionToken);
        }
      } catch (sessionError) {
        console.warn('⚠️ Erro ao criar sessão compartilhada (não crítico):', sessionError);
      }
    }
    
    // Continuar com seu fluxo normal de login
    setUser(data.user);
    // ... resto do código
    
  } catch (error) {
    // Seu tratamento de erro existente
  }
};
```

## 3. Adicionar Menu de Sistemas

Crie um componente ou seção para navegar entre sistemas:

```javascript
import { redirectToSystem } from '../utils/sessionManager';

function SystemsMenu({ user }) {
  const systems = [
    { id: 'triagem', name: 'Triagem', icon: '📸', description: 'Seleção de fotos' },
    { id: 'contrato', name: 'Contratos', icon: '📋', description: 'Gestão de contratos' },
    { id: 'drive', name: 'Drive', icon: '📁', description: 'Gerenciar arquivos' },
    { id: 'formatura', name: 'Formatura', icon: '🎓', description: 'Sessões de formatura' },
    { id: 'dremedio', name: 'Dr. Remédio', icon: '💊', description: 'Sistema farmacêutico' }
  ];

  const handleSystemAccess = async (systemName) => {
    if (!user) {
      alert('Você precisa estar logado para acessar os sistemas.');
      return;
    }
    
    await redirectToSystem(user.id, systemName);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {systems.map((system) => (
        <button
          key={system.id}
          onClick={() => handleSystemAccess(system.id)}
          className="p-6 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow border border-gray-200 hover:border-purple-300"
        >
          <div className="text-4xl mb-3">{system.icon}</div>
          <h3 className="text-lg font-semibold text-gray-800 mb-2">{system.name}</h3>
          <p className="text-sm text-gray-600">{system.description}</p>
        </button>
      ))}
    </div>
  );
}
```

## 4. Configuração Necessária

**Importante:** Todos os sistemas devem usar o **mesmo projeto Supabase**:

```javascript
// Mesmo em TODOS os 6 sistemas (.env):
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anonima
```

## 5. Fluxo Completo

1. **Usuário faz login** em https://fotografo.site/
2. **Sistema cria sessão** na tabela `user_sessions`
3. **Usuário clica em qualquer sistema** → Redireciona para URL com token
4. **Sistema de destino verifica** token no banco Supabase
5. **Se válido** → Acesso direto ao sistema
6. **Se inválido** → Tela de redirecionamento

## 6. Teste Local

Para testar localmente:

```javascript
// No console do navegador em https://fotografo.site/ (após implementar):
const token = await createSharedSession('user-id-teste');
console.log('Token criado:', token);

// Depois acesse qualquer sistema: http://localhost:5173/?session_token=TOKEN_GERADO
```

## 7. Logs para Debug

O sistema inclui logs detalhados:
- ✅ Sessão criada
- 🔍 Verificando token
- ❌ Sessão inválida
- 🧹 Limpeza de sessões expiradas

## Resumo das Modificações no Site Principal:

1. ✅ Adicionar `utils/sessionManager.js`
2. ✅ Modificar função de login para criar sessão
3. ✅ Adicionar menu com todos os 6 sistemas
4. ✅ Usar mesmas credenciais Supabase
5. ✅ Testar fluxo completo

**Resultado:** Usuário logado no site principal → Acesso direto a qualquer um dos 6 sistemas sem nova tela de login!

## Sistemas Suportados:
- 📸 **triagem.fotografo.site** - Seleção de fotos
- 📋 **contrato.fotografo.site** - Gestão de contratos  
- 📁 **drive.fotografo.site** - Gerenciamento de arquivos
- 🎓 **formatura.fotografo.site** - Sessões de formatura
- 💊 **dremedio.shop** - Sistema farmacêutico
- 🏠 **fotografo.site** - Site principal (hub central)