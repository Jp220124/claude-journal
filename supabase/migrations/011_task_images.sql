-- Task Images Feature Database Schema
-- Migration 011: Add task_images table for photo attachments on tasks
-- Following the existing note-images pattern

-- =============================================================================
-- TASK_IMAGES TABLE - Stores metadata for task photo attachments
-- =============================================================================
CREATE TABLE IF NOT EXISTS task_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID NOT NULL REFERENCES todos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,              -- Path in Supabase Storage (user_id/timestamp-random.ext)
  file_name TEXT NOT NULL,                 -- Original filename
  file_size INTEGER,                       -- File size in bytes
  mime_type TEXT,                          -- MIME type (image/jpeg, image/png, etc.)
  width INTEGER,                           -- Image width in pixels
  height INTEGER,                          -- Image height in pixels
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- INDEXES for better query performance
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_task_images_task_id ON task_images(task_id);
CREATE INDEX IF NOT EXISTS idx_task_images_user_id ON task_images(user_id);
CREATE INDEX IF NOT EXISTS idx_task_images_created_at ON task_images(created_at DESC);

-- Unique constraint: one image per task (MVP - single image)
CREATE UNIQUE INDEX IF NOT EXISTS idx_task_images_unique_task ON task_images(task_id);

-- =============================================================================
-- ENABLE ROW LEVEL SECURITY
-- =============================================================================
ALTER TABLE task_images ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- RLS POLICIES FOR TASK_IMAGES TABLE
-- =============================================================================

-- Users can view their own task images
CREATE POLICY "Users can view own task images" ON task_images
  FOR SELECT USING (auth.uid() = user_id);

-- Users can create images for their own tasks
CREATE POLICY "Users can insert own task images" ON task_images
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM todos WHERE todos.id = task_images.task_id AND todos.user_id = auth.uid()
    )
  );

-- Users can update their own task images
CREATE POLICY "Users can update own task images" ON task_images
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own task images
CREATE POLICY "Users can delete own task images" ON task_images
  FOR DELETE USING (auth.uid() = user_id);

-- =============================================================================
-- STORAGE BUCKET SETUP INSTRUCTIONS
-- =============================================================================
-- Run these commands in Supabase Dashboard > SQL Editor to create the storage bucket:
--
-- 1. Create the storage bucket:
-- INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
-- VALUES (
--   'task-images',
--   'task-images',
--   true,  -- Public bucket for easy image access
--   5242880,  -- 5MB limit
--   ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
-- )
-- ON CONFLICT (id) DO NOTHING;
--
-- 2. Storage RLS Policies (run in Supabase Dashboard > Storage > task-images > Policies):
--
-- Policy: Users can upload to their own folder
-- CREATE POLICY "Users can upload task images" ON storage.objects
-- FOR INSERT WITH CHECK (
--   bucket_id = 'task-images' AND
--   auth.uid()::text = (storage.foldername(name))[1]
-- );
--
-- Policy: Anyone can view task images (public bucket)
-- CREATE POLICY "Public can view task images" ON storage.objects
-- FOR SELECT USING (bucket_id = 'task-images');
--
-- Policy: Users can update their own files
-- CREATE POLICY "Users can update own task images" ON storage.objects
-- FOR UPDATE USING (
--   bucket_id = 'task-images' AND
--   auth.uid()::text = (storage.foldername(name))[1]
-- );
--
-- Policy: Users can delete their own files
-- CREATE POLICY "Users can delete own task images" ON storage.objects
-- FOR DELETE USING (
--   bucket_id = 'task-images' AND
--   auth.uid()::text = (storage.foldername(name))[1]
-- );

-- =============================================================================
-- HELPER FUNCTION: Get task image URL
-- =============================================================================
CREATE OR REPLACE FUNCTION get_task_image(p_task_id UUID)
RETURNS TABLE (
  id UUID,
  storage_path TEXT,
  file_name TEXT,
  mime_type TEXT,
  width INTEGER,
  height INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ti.id,
    ti.storage_path,
    ti.file_name,
    ti.mime_type,
    ti.width,
    ti.height
  FROM task_images ti
  WHERE ti.task_id = p_task_id
  AND ti.user_id = auth.uid()
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
