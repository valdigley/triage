/*
  # Adicionar tabela de sessões compartilhadas

  1. Nova Tabela
    - `user_sessions`
      - `id` (uuid, primary key)
      - `user_id` (uuid, referência ao usuário)
      - `session_token` (text, token único da sessão)
      - `is_active` (boolean, se a sessão está ativa)
      - `expires_at` (timestamp, quando a sessão expira)
      - `last_activity` (timestamp, última atividade)
      - `ip_address` (text, IP do usuário)
      - `user_agent` (text, navegador do usuário)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Segurança
    - Enable RLS na tabela `user_sessions`
    - Adicionar políticas para usuários autenticados gerenciarem suas próprias sessões
    - Adicionar política para leitura pública de sessões ativas (para verificação)

  3. Índices
    - Índice no session_token para busca rápida
    - Índice no user_id para busca por usuário
    - Índice no expires_at para limpeza automática
</*/

-- Criar tabela de sessões compartilhadas
CREATE TABLE IF NOT EXISTS user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  session_token text UNIQUE NOT NULL,
  is_active boolean DEFAULT true,
  expires_at timestamptz NOT NULL,
  last_activity timestamptz DEFAULT now(),
  ip_address text,
  user_agent text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

-- Políticas de segurança
CREATE POLICY "Users can manage their own sessions"
  ON user_sessions
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Public can read active sessions for verification"
  ON user_sessions
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true AND expires_at > now());

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON user_sessions(is_active);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_user_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_sessions_updated_at
  BEFORE UPDATE ON user_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_user_sessions_updated_at();

-- Função para limpar sessões expiradas (pode ser chamada periodicamente)
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void AS $$
BEGIN
  UPDATE user_sessions 
  SET is_active = false, updated_at = now()
  WHERE expires_at < now() AND is_active = true;
END;
$$ LANGUAGE plpgsql;