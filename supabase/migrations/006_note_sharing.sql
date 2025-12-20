-- Migration: Note Sharing Feature
-- Description: Add note sharing capability with public links, password protection, and expiration

-- =====================================================
-- 1. CREATE NOTE_SHARES TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS note_shares (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  note_id UUID REFERENCES notes(id) ON DELETE CASCADE NOT NULL,
  share_token VARCHAR(32) UNIQUE NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  password_hash TEXT,
  view_count INTEGER DEFAULT 0,
  allow_copy BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_note_shares_note_id ON note_shares(note_id);
CREATE INDEX IF NOT EXISTS idx_note_shares_share_token ON note_shares(share_token);
CREATE INDEX IF NOT EXISTS idx_note_shares_created_by ON note_shares(created_by);
CREATE INDEX IF NOT EXISTS idx_note_shares_is_active ON note_shares(is_active) WHERE is_active = true;

-- =====================================================
-- 2. ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE note_shares ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own shares
CREATE POLICY "Users can view own shares"
  ON note_shares FOR SELECT
  USING (auth.uid() = created_by);

-- Policy: Users can create shares for their own notes
CREATE POLICY "Users can create shares for own notes"
  ON note_shares FOR INSERT
  WITH CHECK (
    auth.uid() = created_by
    AND EXISTS (
      SELECT 1 FROM notes
      WHERE notes.id = note_id
      AND notes.user_id = auth.uid()
    )
  );

-- Policy: Users can update their own shares
CREATE POLICY "Users can update own shares"
  ON note_shares FOR UPDATE
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

-- Policy: Users can delete their own shares
CREATE POLICY "Users can delete own shares"
  ON note_shares FOR DELETE
  USING (auth.uid() = created_by);

-- Policy: Public can view active shares (for the public page)
CREATE POLICY "Public can view active shares"
  ON note_shares FOR SELECT
  USING (
    is_active = true
    AND (expires_at IS NULL OR expires_at > NOW())
  );

-- =====================================================
-- 3. HELPER FUNCTIONS
-- =====================================================

-- Function to generate a secure random share token
CREATE OR REPLACE FUNCTION generate_share_token()
RETURNS VARCHAR(32) AS $$
DECLARE
  token VARCHAR(32);
  exists_check BOOLEAN;
BEGIN
  LOOP
    -- Generate a 32-character token using random bytes
    token := encode(gen_random_bytes(16), 'hex');

    -- Check if token already exists
    SELECT EXISTS(
      SELECT 1 FROM note_shares WHERE share_token = token
    ) INTO exists_check;

    EXIT WHEN NOT exists_check;
  END LOOP;

  RETURN token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get public note by share token
CREATE OR REPLACE FUNCTION get_public_note(p_share_token VARCHAR(32))
RETURNS TABLE (
  note_id UUID,
  title TEXT,
  content JSONB,
  allow_copy BOOLEAN,
  has_password BOOLEAN,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    n.id as note_id,
    n.title,
    n.content,
    ns.allow_copy,
    (ns.password_hash IS NOT NULL) as has_password,
    n.created_at
  FROM note_shares ns
  JOIN notes n ON n.id = ns.note_id
  WHERE ns.share_token = p_share_token
    AND ns.is_active = true
    AND (ns.expires_at IS NULL OR ns.expires_at > NOW());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment view count
CREATE OR REPLACE FUNCTION increment_note_share_view(p_share_token VARCHAR(32))
RETURNS VOID AS $$
BEGIN
  UPDATE note_shares
  SET view_count = view_count + 1,
      updated_at = NOW()
  WHERE share_token = p_share_token
    AND is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to verify share password
CREATE OR REPLACE FUNCTION verify_share_password(p_share_token VARCHAR(32), p_password TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  stored_hash TEXT;
BEGIN
  SELECT password_hash INTO stored_hash
  FROM note_shares
  WHERE share_token = p_share_token
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > NOW());

  IF stored_hash IS NULL THEN
    -- No password required or share not found
    RETURN TRUE;
  END IF;

  -- Simple comparison (in production, use proper bcrypt/argon2)
  -- For now using a simple hash comparison
  RETURN stored_hash = crypt(p_password, stored_hash);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 4. UPDATED_AT TRIGGER
-- =====================================================

CREATE OR REPLACE FUNCTION update_note_shares_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_note_shares_updated_at ON note_shares;
CREATE TRIGGER trigger_note_shares_updated_at
  BEFORE UPDATE ON note_shares
  FOR EACH ROW
  EXECUTE FUNCTION update_note_shares_updated_at();

-- =====================================================
-- 5. GRANT PERMISSIONS
-- =====================================================

-- Grant access to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON note_shares TO authenticated;

-- Grant access to anon users for public viewing
GRANT SELECT ON note_shares TO anon;

-- Grant execute on functions
GRANT EXECUTE ON FUNCTION generate_share_token() TO authenticated;
GRANT EXECUTE ON FUNCTION get_public_note(VARCHAR) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION increment_note_share_view(VARCHAR) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION verify_share_password(VARCHAR, TEXT) TO anon, authenticated;
