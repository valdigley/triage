import { supabase } from '../lib/supabase';

export interface SessionInfo {
  sessionToken: string;
  userId: string;
  expiresAt: string;
}

/**
 * Função para ser chamada pelo site principal (fotografo.site) após login
 * Cria uma sessão compartilhada e retorna o token
 */
export async function createSharedSession(userId: string): Promise<string | null> {
  try {
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

    // Invalidar sessões antigas do mesmo usuário
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

    console.log('✅ Sessão compartilhada criada:', sessionToken);
    return sessionToken;

  } catch (error) {
    console.error('❌ Erro ao criar sessão compartilhada:', error);
    return null;
  }
}

/**
 * Função para verificar se uma sessão é válida
 */
export async function verifySharedSession(sessionToken: string): Promise<SessionInfo | null> {
  try {
    const { data, error } = await supabase
      .from('user_sessions')
      .select('*')
      .eq('session_token', sessionToken)
      .eq('is_active', true)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (error || !data) {
      return null;
    }

    // Atualizar última atividade
    await supabase
      .from('user_sessions')
      .update({ 
        last_activity: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', data.id);

    return {
      sessionToken: data.session_token,
      userId: data.user_id,
      expiresAt: data.expires_at
    };

  } catch (error) {
    console.error('❌ Erro ao verificar sessão:', error);
    return null;
  }
}

/**
 * Função para invalidar uma sessão
 */
export async function invalidateSharedSession(sessionToken: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('user_sessions')
      .update({ 
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('session_token', sessionToken);

    if (error) throw error;

    console.log('✅ Sessão invalidada:', sessionToken);
    return true;

  } catch (error) {
    console.error('❌ Erro ao invalidar sessão:', error);
    return false;
  }
}

/**
 * Função para limpar sessões expiradas (pode ser chamada periodicamente)
 */
export async function cleanupExpiredSessions(): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('user_sessions')
      .update({ 
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .lt('expires_at', new Date().toISOString())
      .eq('is_active', true)
      .select('id');

    if (error) throw error;

    const cleanedCount = data?.length || 0;
    if (cleanedCount > 0) {
      console.log(`🧹 ${cleanedCount} sessões expiradas limpas`);
    }
    return cleanedCount;

  } catch (error) {
    console.error('❌ Erro ao limpar sessões expiradas:', error);
    return 0;
  }
}

/**
 * Função para gerar URL de redirecionamento com token de sessão
 * Para ser usada pelo site principal - FUNCIONA ENTRE DOMÍNIOS DIFERENTES
 */
export function generateSystemUrl(sessionToken: string, systemUrl: string): string {
  const url = new URL(systemUrl);
  url.searchParams.set('session_token', sessionToken);
  return url.toString();
}

/**
 * Função específica para o sistema de triagem (compatibilidade)
 */
export function generateTriageUrl(sessionToken: string, baseUrl: string = 'https://triagem.fotografo.site/'): string {
  const url = new URL(baseUrl);
  url.searchParams.set('session_token', sessionToken);
  return url.toString();
}

/**
 * Função para verificar se há sessões ativas de um usuário específico
 * Útil para o site principal verificar se pode fazer redirecionamento direto
 */
export async function hasActiveSession(userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('user_sessions')
      .select('id')
      .eq('user_id', userId)
      .eq('is_active', true)
      .gt('expires_at', new Date().toISOString())
      .limit(1);
    if (error) throw error;
    return (data?.length || 0) > 0;
  } catch (error) {
    console.error('❌ Erro ao verificar sessões ativas:', error);
    return false;
  }
}