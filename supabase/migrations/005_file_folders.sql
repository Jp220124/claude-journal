-- File Folders Feature Database Schema
-- Migration 005: Add hierarchical folder management for files

-- =============================================================================
-- FILE_FOLDERS TABLE - Stores folder hierarchy for file organization
-- =============================================================================
CREATE TABLE IF NOT EXISTS file_folders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  parent_folder_id UUID REFERENCES file_folders(id) ON DELETE CASCADE,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Prevent duplicate folder names at the same level for the same user
  UNIQUE(user_id, parent_folder_id, name)
);

-- =============================================================================
-- UPDATE FILES TABLE - Add folder_id reference
-- =============================================================================
ALTER TABLE files ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES file_folders(id) ON DELETE SET NULL;

-- =============================================================================
-- INDEXES for better query performance
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_file_folders_user_id ON file_folders(user_id);
CREATE INDEX IF NOT EXISTS idx_file_folders_parent ON file_folders(parent_folder_id);
CREATE INDEX IF NOT EXISTS idx_file_folders_user_parent ON file_folders(user_id, parent_folder_id);
CREATE INDEX IF NOT EXISTS idx_files_folder_id ON files(folder_id);

-- =============================================================================
-- ENABLE ROW LEVEL SECURITY
-- =============================================================================
ALTER TABLE file_folders ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- RLS POLICIES FOR FILE_FOLDERS TABLE
-- =============================================================================

-- Users can view their own folders
CREATE POLICY "Users can view own folders" ON file_folders
  FOR SELECT USING (auth.uid() = user_id);

-- Users can create their own folders
CREATE POLICY "Users can create own folders" ON file_folders
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own folders
CREATE POLICY "Users can update own folders" ON file_folders
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own folders
CREATE POLICY "Users can delete own folders" ON file_folders
  FOR DELETE USING (auth.uid() = user_id);

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- Function to get folder path (for breadcrumb navigation)
-- Returns folders from root to the given folder
CREATE OR REPLACE FUNCTION get_folder_path(p_folder_id UUID)
RETURNS TABLE (
  id UUID,
  name TEXT,
  depth INTEGER
) AS $$
WITH RECURSIVE folder_path AS (
  -- Start with the target folder
  SELECT
    ff.id,
    ff.name,
    ff.parent_folder_id,
    0 as depth
  FROM file_folders ff
  WHERE ff.id = p_folder_id

  UNION ALL

  -- Recursively get parent folders
  SELECT
    ff.id,
    ff.name,
    ff.parent_folder_id,
    fp.depth + 1
  FROM file_folders ff
  JOIN folder_path fp ON ff.id = fp.parent_folder_id
)
SELECT fp.id, fp.name, fp.depth
FROM folder_path fp
ORDER BY fp.depth DESC;  -- Root first, then children
$$ LANGUAGE sql SECURITY DEFINER;

-- Function to get all descendant folder IDs (for bulk operations like delete)
CREATE OR REPLACE FUNCTION get_folder_descendants(p_folder_id UUID)
RETURNS TABLE (id UUID) AS $$
WITH RECURSIVE descendants AS (
  -- Start with the target folder
  SELECT ff.id
  FROM file_folders ff
  WHERE ff.id = p_folder_id

  UNION ALL

  -- Get all children recursively
  SELECT ff.id
  FROM file_folders ff
  JOIN descendants d ON ff.parent_folder_id = d.id
)
SELECT d.id FROM descendants d;
$$ LANGUAGE sql SECURITY DEFINER;

-- Function to check if moving a folder would create a cycle
CREATE OR REPLACE FUNCTION would_create_folder_cycle(
  p_folder_id UUID,
  p_new_parent_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
  -- If new parent is null (moving to root), no cycle possible
  IF p_new_parent_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Check if new parent is a descendant of the folder being moved
  RETURN EXISTS (
    SELECT 1
    FROM get_folder_descendants(p_folder_id) d
    WHERE d.id = p_new_parent_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- Update timestamp trigger for file_folders
CREATE TRIGGER update_file_folders_updated_at
  BEFORE UPDATE ON file_folders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- DATA MIGRATION - Convert existing folder strings to folder records
-- =============================================================================
DO $$
DECLARE
  r RECORD;
  new_folder_id UUID;
BEGIN
  -- Get unique folder names per user (excluding 'root', 'all', empty, and null)
  FOR r IN
    SELECT DISTINCT user_id, folder
    FROM files
    WHERE folder IS NOT NULL
      AND folder != 'root'
      AND folder != 'all'
      AND folder != ''
  LOOP
    -- Try to insert the folder (will do nothing if already exists due to UNIQUE constraint)
    INSERT INTO file_folders (user_id, name, parent_folder_id)
    VALUES (r.user_id, r.folder, NULL)
    ON CONFLICT (user_id, parent_folder_id, name) DO NOTHING;

    -- Get the folder ID (whether just inserted or already existed)
    SELECT id INTO new_folder_id
    FROM file_folders
    WHERE user_id = r.user_id
      AND name = r.folder
      AND parent_folder_id IS NULL;

    -- Update files to use the new folder_id
    IF new_folder_id IS NOT NULL THEN
      UPDATE files
      SET folder_id = new_folder_id
      WHERE user_id = r.user_id
        AND folder = r.folder
        AND folder_id IS NULL;
    END IF;
  END LOOP;
END $$;
