-- Migration: AI Provider Connections and Chat History
-- Purpose: Store user AI provider OAuth connections, API keys, and chat history for Research Panel
-- Date: 2025-12-23

-- Store user's AI provider OAuth connections (Gemini, Claude, OpenAI)
CREATE TABLE IF NOT EXISTS user_ai_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  provider VARCHAR(50) NOT NULL, -- 'google', 'anthropic', 'openai'
  access_token_encrypted TEXT,
  refresh_token_encrypted TEXT,
  token_expires_at TIMESTAMPTZ,
  is_default BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}', -- Additional provider-specific data
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, provider)
);

-- Store user's API keys (fallback/BYOK - Bring Your Own Key)
CREATE TABLE IF NOT EXISTS user_ai_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  provider VARCHAR(50) NOT NULL, -- 'google', 'anthropic', 'openai'
  api_key_encrypted TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, provider)
);

-- Store chat history per note
CREATE TABLE IF NOT EXISTS note_ai_chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id UUID REFERENCES notes(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  messages JSONB NOT NULL DEFAULT '[]', -- Array of {role, content, timestamp}
  provider VARCHAR(50), -- Which provider was used
  model VARCHAR(100), -- Which model was used
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(note_id, user_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_ai_connections_user_id ON user_ai_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_user_ai_connections_provider ON user_ai_connections(provider);
CREATE INDEX IF NOT EXISTS idx_user_ai_api_keys_user_id ON user_ai_api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_note_ai_chats_note_id ON note_ai_chats(note_id);
CREATE INDEX IF NOT EXISTS idx_note_ai_chats_user_id ON note_ai_chats(user_id);

-- Enable Row Level Security
ALTER TABLE user_ai_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_ai_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE note_ai_chats ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_ai_connections
CREATE POLICY "Users can view own AI connections"
  ON user_ai_connections FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own AI connections"
  ON user_ai_connections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own AI connections"
  ON user_ai_connections FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own AI connections"
  ON user_ai_connections FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for user_ai_api_keys
CREATE POLICY "Users can view own API keys"
  ON user_ai_api_keys FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own API keys"
  ON user_ai_api_keys FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own API keys"
  ON user_ai_api_keys FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own API keys"
  ON user_ai_api_keys FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for note_ai_chats
CREATE POLICY "Users can view own chat history"
  ON note_ai_chats FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own chat history"
  ON note_ai_chats FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own chat history"
  ON note_ai_chats FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own chat history"
  ON note_ai_chats FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_ai_tables_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
CREATE TRIGGER update_user_ai_connections_updated_at
  BEFORE UPDATE ON user_ai_connections
  FOR EACH ROW
  EXECUTE FUNCTION update_ai_tables_updated_at();

CREATE TRIGGER update_user_ai_api_keys_updated_at
  BEFORE UPDATE ON user_ai_api_keys
  FOR EACH ROW
  EXECUTE FUNCTION update_ai_tables_updated_at();

CREATE TRIGGER update_note_ai_chats_updated_at
  BEFORE UPDATE ON note_ai_chats
  FOR EACH ROW
  EXECUTE FUNCTION update_ai_tables_updated_at();

-- Comments for documentation
COMMENT ON TABLE user_ai_connections IS 'Stores OAuth tokens for AI provider connections (Google Gemini, Anthropic Claude, OpenAI)';
COMMENT ON TABLE user_ai_api_keys IS 'Stores encrypted API keys for BYOK (Bring Your Own Key) users';
COMMENT ON TABLE note_ai_chats IS 'Stores AI chat history per note for the Research Panel feature';
