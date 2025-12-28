-- =====================================================
-- Migration 015: Add Password Protection to Notes
-- Allows users to lock individual notes with a password
-- =====================================================

-- Add password protection columns to notes table
ALTER TABLE notes ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT false;
ALTER TABLE notes ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE notes ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ;

-- Create index for quick filtering of locked notes
CREATE INDEX IF NOT EXISTS idx_notes_is_locked ON notes(is_locked) WHERE is_locked = true;

-- Comment on columns for documentation
COMMENT ON COLUMN notes.is_locked IS 'Whether this note requires a password to view';
COMMENT ON COLUMN notes.password_hash IS 'Bcrypt hash of the note password (never store plain text)';
COMMENT ON COLUMN notes.locked_at IS 'Timestamp when the note was locked';
