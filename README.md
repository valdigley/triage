# Sistema de Triagem - Valdigley Santos

## Autenticação Compartilhada
Sistema integrado de gerenciamento de sessões fotográficas com autenticação compartilhada.
Este sistema utiliza autenticação compartilhada com o site principal (https://fotografo.site/). 
### Como funciona:
1. **Login Principal**: O usuário faz login em https://fotografo.site/
2. **Sessão Compartilhada**: Uma sessão é criada na tabela `user_sessions` do Supabase
3. **Redirecionamento**: O usuário é redirecionado para o sistema de triagem com um token de sessão
4. **Verificação Automática**: O sistema verifica automaticamente se a sessão é válida
5. **Acesso Direto**: Se válida, o usuário entra diretamente sem nova tela de login
### Integração com o Site Principal
Para integrar com o site principal, use as funções utilitárias:
```javascript
import { createSharedSession, generateTriageUrl } from './utils/sessionManager';
// Após login bem-sucedido no site principal:
const sessionToken = await createSharedSession(user.id);
const triageUrl = generateTriageUrl(sessionToken, 'https://triagem.fotografo.site/');
// Redirecionar o usuário:
window.location.href = triageUrl;
```
### Segurança
- Sessões expiram automaticamente em 24 horas
- Tokens são únicos e não reutilizáveis
- RLS (Row Level Security) protege os dados de sessão
- Limpeza automática de sessões expiradas
- Rastreamento de IP e User Agent para auditoria
### Fallback
Se não houver sessão compartilhada válida, o sistema:
1. Mostra uma tela explicativa
2. Oferece redirecionamento para o site principal
3. Mantém a opção de login direto como fallback