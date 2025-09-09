import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { cleanupExpiredSessions } from '../utils/sessionManager';

interface SessionData {
  user_id: string;
  session_token: string;
  expires_at: string;
  last_activity: string;
}

export function useSessionVerification() {
  const [isVerifying, setIsVerifying] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    verifySession();
  }, []);

  const verifySession = async () => {
    try {
      setIsVerifying(true);
      setError(null);

      // Primeiro, limpar sessões expiradas
      await cleanupExpiredSessions();

      // Verificar se há uma sessão ativa do Supabase
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.warn('Erro ao verificar sessão Supabase:', sessionError);
      }

      if (session) {
        // Usuário já está logado no Supabase
        console.log('✅ Usuário já autenticado no Supabase');
        setIsAuthenticated(true);
        setIsVerifying(false);
        return;
      }

      // Verificar token de sessão compartilhada nos parâmetros da URL
      const urlParams = new URLSearchParams(window.location.search);
      let sessionToken = urlParams.get('session_token');
      
      // Se não há token na URL, verificar se há uma sessão ativa no banco
      // (para casos onde o usuário volta diretamente ao sistema)
      if (!sessionToken) {
        console.log('🔍 Verificando sessões ativas no banco...');
        
        // Buscar qualquer sessão ativa válida (última criada)
        const { data: activeSessions, error: sessionSearchError } = await supabase
          .from('user_sessions')
          .select('*')
          .eq('is_active', true)
          .gt('expires_at', new Date().toISOString())
          .order('last_activity', { ascending: false })
          .limit(1);

        if (!sessionSearchError && activeSessions && activeSessions.length > 0) {
          sessionToken = activeSessions[0].session_token;
          console.log('✅ Sessão ativa encontrada no banco');
        }
      }

      if (!sessionToken) {
        console.log('ℹ️ Nenhum token de sessão encontrado');
        setIsAuthenticated(false);
        setIsVerifying(false);
        return;
      }

      console.log('🔍 Verificando token de sessão compartilhada:', sessionToken.substring(0, 20) + '...');

      // Verificar se a sessão é válida na tabela user_sessions
      const { data: sessionRecord, error: sessionCheckError } = await supabase
        .from('user_sessions')
        .select('*')
        .eq('session_token', sessionToken)
        .eq('is_active', true)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (sessionCheckError || !sessionRecord) {
        console.log('❌ Sessão inválida ou expirada');
        setIsAuthenticated(false);
        setIsVerifying(false);
        return;
      }

      console.log('✅ Sessão válida encontrada');

      // Atualizar última atividade
      await supabase
        .from('user_sessions')
        .update({ 
          last_activity: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', sessionRecord.id);

      console.log('🔐 Criando sessão automática...');
      
      setSessionData(sessionRecord);
      setIsAuthenticated(true);
      
      // Remover token da URL se estiver presente
      if (urlParams.get('session_token')) {
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.delete('session_token');
        window.history.replaceState({}, '', newUrl.toString());
      }

    } catch (error) {
      console.error('❌ Erro na verificação de sessão:', error);
      setError(error instanceof Error ? error.message : 'Erro na verificação de sessão');
      setIsAuthenticated(false);
    } finally {
      setIsVerifying(false);
    }
  };

  const createSharedSession = async (userId: string): Promise<string | null> => {
    try {
      // Gerar token único
      const sessionToken = `session_${Date.now()}_${Math.random().toString(36).substring(2)}`;
      
      // Definir expiração (24 horas)
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      // Obter informações do navegador
      const ipAddress = await fetch('https://api.ipify.org?format=json')
        .then(res => res.json())
        .then(data => data.ip)
        .catch(() => 'unknown');

      const userAgent = navigator.userAgent;

      // Criar registro de sessão
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
  };

  const invalidateSession = async (sessionToken?: string) => {
    try {
      const tokenToInvalidate = sessionToken || sessionData?.session_token;
      
      if (tokenToInvalidate) {
        await supabase
          .from('user_sessions')
          .update({ 
            is_active: false,
            updated_at: new Date().toISOString()
          })
          .eq('session_token', tokenToInvalidate);

      }

      setIsAuthenticated(false);
      setSessionData(null);
    } catch (error) {
      console.error('❌ Erro ao invalidar sessão:', error);
    }
  };

  const refreshSession = async () => {
    await verifySession();
  };

  return {
    isVerifying,
    isAuthenticated,
    sessionData,
    error,
    createSharedSession,
    invalidateSession,
    refreshSession
  };
}