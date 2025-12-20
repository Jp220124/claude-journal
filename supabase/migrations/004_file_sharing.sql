-- File Sharing Feature Database Schema
-- Migration 004: Add files and file sharing tables

-- =============================================================================
-- FILES TABLE - Stores metadata for all uploaded files
-- =============================================================================
CREATE TABLE IF NOT EXISTS files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,                    -- Sanitized/display name
  original_name TEXT NOT NULL,           -- Original filename from upload
  mime_type TEXT NOT NULL,               -- MIME type (image/jpeg, application/pdf, etc.)
  size BIGINT NOT NULL,                  -- File size in bytes
  storage_path TEXT NOT NULL UNIQUE,     -- Path in Supabase Storage
  thumbnail_path TEXT,                   -- Optional thumbnail path
  is_public BOOLEAN DEFAULT false,       -- Quick toggle for public access
  folder TEXT DEFAULT 'root',            -- Virtual folder organization
  description TEXT,                      -- Optional file description
  download_count INTEGER DEFAULT 0,      -- Track downloads
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- FILE SHARES TABLE - Stores shareable links with settings
-- =============================================================================
CREATE TABLE IF NOT EXISTS file_shares (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  file_id UUID REFERENCES files(id) ON DELETE CASCADE NOT NULL,
  share_token TEXT UNIQUE NOT NULL,      -- Unique token for share URL
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  password_hash TEXT,                    -- Optional bcrypt password hash
  expires_at TIMESTAMPTZ,                -- Optional expiry timestamp
  max_downloads INTEGER,                 -- Optional download limit
  download_count INTEGER DEFAULT 0,      -- Track downloads via this share
  is_active BOOLEAN DEFAULT true,        -- Can disable without deleting
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- FILE PERMISSIONS TABLE - For user-to-user sharing
-- =============================================================================
CREATE TABLE IF NOT EXISTS file_permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  file_id UUID REFERENCES files(id) ON DELETE CASCADE NOT NULL,
  shared_with UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  permission_level TEXT NOT NULL DEFAULT 'view'
    CHECK (permission_level IN ('view', 'download', 'edit')),
  shared_by UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(file_id, shared_with)
);

-- =============================================================================
-- INDEXES for better query performance
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_files_user_id ON files(user_id);
CREATE INDEX IF NOT EXISTS idx_files_folder ON files(user_id, folder);
CREATE INDEX IF NOT EXISTS idx_files_mime_type ON files(mime_type);
CREATE INDEX IF NOT EXISTS idx_files_created_at ON files(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_file_shares_token ON file_shares(share_token);
CREATE INDEX IF NOT EXISTS idx_file_shares_file_id ON file_shares(file_id);
CREATE INDEX IF NOT EXISTS idx_file_permissions_shared_with ON file_permissions(shared_with);

-- =============================================================================
-- ENABLE ROW LEVEL SECURITY
-- =============================================================================
ALTER TABLE files ENABLE ROW LEVEL SECURITY;
ALTER TABLE file_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE file_permissions ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- RLS POLICIES FOR FILES TABLE
-- =============================================================================

-- Users can view their own files
CREATE POLICY "Users can view own files" ON files
  FOR SELECT USING (auth.uid() = user_id);

-- Users can also view files shared with them
CREATE POLICY "Users can view shared files" ON files
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM file_permissions
      WHERE file_permissions.file_id = files.id
      AND file_permissions.shared_with = auth.uid()
    )
  );

-- Users can view public files
CREATE POLICY "Users can view public files" ON files
  FOR SELECT USING (is_public = true);

-- Users can create their own files
CREATE POLICY "Users can create own files" ON files
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own files
CREATE POLICY "Users can update own files" ON files
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own files
CREATE POLICY "Users can delete own files" ON files
  FOR DELETE USING (auth.uid() = user_id);

-- =============================================================================
-- RLS POLICIES FOR FILE_SHARES TABLE
-- =============================================================================

-- Users can view shares they created
CREATE POLICY "Users can view own shares" ON file_shares
  FOR SELECT USING (auth.uid() = created_by);

-- Users can view shares for their files
CREATE POLICY "Users can view shares for own files" ON file_shares
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM files WHERE files.id = file_shares.file_id AND files.user_id = auth.uid()
    )
  );

-- Users can create shares for their own files
CREATE POLICY "Users can create shares for own files" ON file_shares
  FOR INSERT WITH CHECK (
    auth.uid() = created_by AND
    EXISTS (
      SELECT 1 FROM files WHERE files.id = file_shares.file_id AND files.user_id = auth.uid()
    )
  );

-- Users can update shares they created
CREATE POLICY "Users can update own shares" ON file_shares
  FOR UPDATE USING (auth.uid() = created_by);

-- Users can delete shares they created
CREATE POLICY "Users can delete own shares" ON file_shares
  FOR DELETE USING (auth.uid() = created_by);

-- =============================================================================
-- RLS POLICIES FOR FILE_PERMISSIONS TABLE
-- =============================================================================

-- Users can view permissions for their own files
CREATE POLICY "Owners can view file permissions" ON file_permissions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM files WHERE files.id = file_permissions.file_id AND files.user_id = auth.uid()
    )
  );

-- Users can view files shared with them
CREATE POLICY "Users can view their permissions" ON file_permissions
  FOR SELECT USING (auth.uid() = shared_with);

-- Owners can create permissions for their files
CREATE POLICY "Owners can create file permissions" ON file_permissions
  FOR INSERT WITH CHECK (
    auth.uid() = shared_by AND
    EXISTS (
      SELECT 1 FROM files WHERE files.id = file_permissions.file_id AND files.user_id = auth.uid()
    )
  );

-- Owners can update permissions for their files
CREATE POLICY "Owners can update file permissions" ON file_permissions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM files WHERE files.id = file_permissions.file_id AND files.user_id = auth.uid()
    )
  );

-- Owners can delete permissions for their files
CREATE POLICY "Owners can delete file permissions" ON file_permissions
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM files WHERE files.id = file_permissions.file_id AND files.user_id = auth.uid()
    )
  );

-- =============================================================================
-- FUNCTIONS
-- =============================================================================

-- Function to validate share token and return file info (public access)
CREATE OR REPLACE FUNCTION validate_share_token(token TEXT)
RETURNS TABLE (
  file_id UUID,
  file_name TEXT,
  mime_type TEXT,
  size BIGINT,
  storage_path TEXT,
  requires_password BOOLEAN,
  is_expired BOOLEAN,
  download_limit_reached BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    f.id,
    f.name,
    f.mime_type,
    f.size,
    f.storage_path,
    (fs.password_hash IS NOT NULL) AS requires_password,
    (fs.expires_at IS NOT NULL AND fs.expires_at < NOW()) AS is_expired,
    (fs.max_downloads IS NOT NULL AND fs.download_count >= fs.max_downloads) AS download_limit_reached
  FROM file_shares fs
  JOIN files f ON f.id = fs.file_id
  WHERE fs.share_token = token AND fs.is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment download count
CREATE OR REPLACE FUNCTION increment_download_count(p_file_id UUID, p_share_token TEXT DEFAULT NULL)
RETURNS VOID AS $$
BEGIN
  -- Increment file download count
  UPDATE files SET download_count = download_count + 1 WHERE id = p_file_id;

  -- If share token provided, increment share download count too
  IF p_share_token IS NOT NULL THEN
    UPDATE file_shares SET download_count = download_count + 1 WHERE share_token = p_share_token;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- Update timestamp trigger for files
CREATE TRIGGER update_files_updated_at
  BEFORE UPDATE ON files
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- STORAGE BUCKET SETUP (Run in Supabase Dashboard SQL Editor)
-- Note: Storage buckets are typically created via Dashboard or API
-- =============================================================================

-- Create the storage bucket for user files (if using SQL)
-- INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
-- VALUES (
--   'user-files',
--   'user-files',
--   false,  -- Private bucket
--   52428800,  -- 50MB limit
--   ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
--         'application/pdf', 'video/mp4', 'video/webm', 'audio/mpeg', 'audio/wav',
--         'text/plain', 'text/markdown', 'application/json']
-- )
-- ON CONFLICT (id) DO NOTHING;

-- Storage RLS Policies (these work on storage.objects table)
-- These need to be created in Supabase Dashboard > Storage > Policies

-- Policy: Users can upload to their own folder
-- CREATE POLICY "Users can upload to own folder" ON storage.objects
-- FOR INSERT WITH CHECK (
--   bucket_id = 'user-files' AND
--   auth.uid()::text = (storage.foldername(name))[1]
-- );

-- Policy: Users can view their own files
-- CREATE POLICY "Users can view own files" ON storage.objects
-- FOR SELECT USING (
--   bucket_id = 'user-files' AND
--   auth.uid()::text = (storage.foldername(name))[1]
-- );

-- Policy: Users can delete their own files
-- CREATE POLICY "Users can delete own files" ON storage.objects
-- FOR DELETE USING (
--   bucket_id = 'user-files' AND
--   auth.uid()::text = (storage.foldername(name))[1]
-- );
