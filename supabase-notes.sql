-- =====================================================
-- Notes & Planning System - Database Schema
-- =====================================================
-- This migration adds a full-featured notes system
-- with folders, tags, and task integration
-- =====================================================

-- =====================================================
-- 1. NOTE FOLDERS TABLE
-- =====================================================
-- Create folders table first (notes reference it)

CREATE TABLE IF NOT EXISTS public.note_folders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT DEFAULT 'folder',
  color TEXT DEFAULT '#6366f1',
  parent_folder_id UUID REFERENCES public.note_folders(id) ON DELETE CASCADE,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.note_folders ENABLE ROW LEVEL SECURITY;

-- RLS Policies for note_folders
CREATE POLICY "Users can view own note folders"
  ON public.note_folders
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own note folders"
  ON public.note_folders
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own note folders"
  ON public.note_folders
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own note folders"
  ON public.note_folders
  FOR DELETE
  USING (auth.uid() = user_id);

-- Indexes for note_folders
CREATE INDEX IF NOT EXISTS idx_note_folders_user_id
  ON public.note_folders(user_id);
CREATE INDEX IF NOT EXISTS idx_note_folders_parent
  ON public.note_folders(parent_folder_id);
CREATE INDEX IF NOT EXISTS idx_note_folders_user_order
  ON public.note_folders(user_id, order_index);

-- Updated_at trigger for note_folders
CREATE OR REPLACE FUNCTION update_note_folders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_note_folders_updated_at
  BEFORE UPDATE ON public.note_folders
  FOR EACH ROW
  EXECUTE FUNCTION update_note_folders_updated_at();


-- =====================================================
-- 2. NOTES TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Untitled',
  content JSONB DEFAULT '{}',           -- TipTap JSON format for rich text
  content_text TEXT DEFAULT '',         -- Plain text version for search
  folder_id UUID REFERENCES public.note_folders(id) ON DELETE SET NULL,
  is_pinned BOOLEAN DEFAULT FALSE,
  is_archived BOOLEAN DEFAULT FALSE,
  word_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for notes
CREATE POLICY "Users can view own notes"
  ON public.notes
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notes"
  ON public.notes
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notes"
  ON public.notes
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own notes"
  ON public.notes
  FOR DELETE
  USING (auth.uid() = user_id);

-- Indexes for notes
CREATE INDEX IF NOT EXISTS idx_notes_user_id
  ON public.notes(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_folder_id
  ON public.notes(folder_id);
CREATE INDEX IF NOT EXISTS idx_notes_user_pinned
  ON public.notes(user_id, is_pinned DESC);
CREATE INDEX IF NOT EXISTS idx_notes_user_archived
  ON public.notes(user_id, is_archived);
CREATE INDEX IF NOT EXISTS idx_notes_user_updated
  ON public.notes(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_notes_user_created
  ON public.notes(user_id, created_at DESC);

-- Full-text search index on content_text
CREATE INDEX IF NOT EXISTS idx_notes_content_search
  ON public.notes USING gin(to_tsvector('english', coalesce(title, '') || ' ' || coalesce(content_text, '')));

-- Updated_at trigger for notes
CREATE OR REPLACE FUNCTION update_notes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_notes_updated_at
  BEFORE UPDATE ON public.notes
  FOR EACH ROW
  EXECUTE FUNCTION update_notes_updated_at();


-- =====================================================
-- 3. NOTE TAGS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.note_tags (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6366f1',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.note_tags ENABLE ROW LEVEL SECURITY;

-- RLS Policies for note_tags
CREATE POLICY "Users can view own note tags"
  ON public.note_tags
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own note tags"
  ON public.note_tags
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own note tags"
  ON public.note_tags
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own note tags"
  ON public.note_tags
  FOR DELETE
  USING (auth.uid() = user_id);

-- Indexes for note_tags
CREATE INDEX IF NOT EXISTS idx_note_tags_user_id
  ON public.note_tags(user_id);

-- Unique constraint: user can't have duplicate tag names
CREATE UNIQUE INDEX IF NOT EXISTS idx_note_tags_user_name
  ON public.note_tags(user_id, LOWER(name));


-- =====================================================
-- 4. NOTE TAG LINKS TABLE (Many-to-Many)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.note_tag_links (
  note_id UUID NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.note_tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (note_id, tag_id)
);

-- Enable RLS
ALTER TABLE public.note_tag_links ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only manage links for their own notes
CREATE POLICY "Users can view own note-tag links"
  ON public.note_tag_links
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.notes
      WHERE id = note_tag_links.note_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own note-tag links"
  ON public.note_tag_links
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.notes
      WHERE id = note_tag_links.note_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own note-tag links"
  ON public.note_tag_links
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.notes
      WHERE id = note_tag_links.note_id
      AND user_id = auth.uid()
    )
  );

-- Indexes for note_tag_links
CREATE INDEX IF NOT EXISTS idx_note_tag_links_note_id
  ON public.note_tag_links(note_id);
CREATE INDEX IF NOT EXISTS idx_note_tag_links_tag_id
  ON public.note_tag_links(tag_id);


-- =====================================================
-- 5. TASK-NOTE LINKS TABLE
-- =====================================================
-- Links notes to todos for bidirectional navigation

CREATE TABLE IF NOT EXISTS public.task_note_links (
  task_id UUID NOT NULL REFERENCES public.todos(id) ON DELETE CASCADE,
  note_id UUID NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (task_id, note_id)
);

-- Enable RLS
ALTER TABLE public.task_note_links ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only manage links for their own tasks/notes
CREATE POLICY "Users can view own task-note links"
  ON public.task_note_links
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.todos
      WHERE id = task_note_links.task_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own task-note links"
  ON public.task_note_links
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.todos
      WHERE id = task_note_links.task_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own task-note links"
  ON public.task_note_links
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.todos
      WHERE id = task_note_links.task_id
      AND user_id = auth.uid()
    )
  );

-- Indexes for task_note_links
CREATE INDEX IF NOT EXISTS idx_task_note_links_task_id
  ON public.task_note_links(task_id);
CREATE INDEX IF NOT EXISTS idx_task_note_links_note_id
  ON public.task_note_links(note_id);


-- =====================================================
-- 6. NOTE IMAGES TABLE
-- =====================================================
-- Tracks images uploaded to notes for cleanup and management

CREATE TABLE IF NOT EXISTS public.note_images (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note_id UUID REFERENCES public.notes(id) ON DELETE SET NULL,
  storage_path TEXT NOT NULL,           -- Path in Supabase Storage
  filename TEXT NOT NULL,               -- Original filename
  size_bytes INTEGER,                   -- File size
  mime_type TEXT,                       -- MIME type (image/png, etc.)
  width INTEGER,                        -- Image width in pixels
  height INTEGER,                       -- Image height in pixels
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.note_images ENABLE ROW LEVEL SECURITY;

-- RLS Policies for note_images
CREATE POLICY "Users can view own note images"
  ON public.note_images
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own note images"
  ON public.note_images
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own note images"
  ON public.note_images
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own note images"
  ON public.note_images
  FOR DELETE
  USING (auth.uid() = user_id);

-- Indexes for note_images
CREATE INDEX IF NOT EXISTS idx_note_images_user_id
  ON public.note_images(user_id);
CREATE INDEX IF NOT EXISTS idx_note_images_note_id
  ON public.note_images(note_id);


-- =====================================================
-- 7. STARTER FOLDERS FUNCTION
-- =====================================================
-- Creates default folders for new users
-- This function is IDEMPOTENT - calling it multiple times will not create duplicates

CREATE OR REPLACE FUNCTION create_starter_note_folders(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
  -- Create "Quick Notes" folder (only if not exists)
  IF NOT EXISTS (SELECT 1 FROM public.note_folders WHERE user_id = p_user_id AND name = 'Quick Notes') THEN
    INSERT INTO public.note_folders (user_id, name, icon, color, order_index)
    VALUES (p_user_id, 'Quick Notes', 'edit_note', '#10b981', 0);
  END IF;

  -- Create "Work" folder (only if not exists)
  IF NOT EXISTS (SELECT 1 FROM public.note_folders WHERE user_id = p_user_id AND name = 'Work') THEN
    INSERT INTO public.note_folders (user_id, name, icon, color, order_index)
    VALUES (p_user_id, 'Work', 'business_center', '#f59e0b', 1);
  END IF;

  -- Create "Personal" folder (only if not exists)
  IF NOT EXISTS (SELECT 1 FROM public.note_folders WHERE user_id = p_user_id AND name = 'Personal') THEN
    INSERT INTO public.note_folders (user_id, name, icon, color, order_index)
    VALUES (p_user_id, 'Personal', 'person', '#3b82f6', 2);
  END IF;

  -- Create "Ideas" folder (only if not exists)
  IF NOT EXISTS (SELECT 1 FROM public.note_folders WHERE user_id = p_user_id AND name = 'Ideas') THEN
    INSERT INTO public.note_folders (user_id, name, icon, color, order_index)
    VALUES (p_user_id, 'Ideas', 'lightbulb', '#8b5cf6', 3);
  END IF;

  -- Create "Archive" folder (only if not exists)
  IF NOT EXISTS (SELECT 1 FROM public.note_folders WHERE user_id = p_user_id AND name = 'Archive') THEN
    INSERT INTO public.note_folders (user_id, name, icon, color, order_index)
    VALUES (p_user_id, 'Archive', 'archive', '#6b7280', 4);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION create_starter_note_folders(UUID) TO authenticated;


-- =====================================================
-- 8. STARTER TAGS FUNCTION
-- =====================================================
-- Creates default tags for new users
-- This function is IDEMPOTENT - calling it multiple times will not create duplicates

CREATE OR REPLACE FUNCTION create_starter_note_tags(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
  -- Create starter tags with different colors (only if not exists)
  IF NOT EXISTS (SELECT 1 FROM public.note_tags WHERE user_id = p_user_id AND name = 'important') THEN
    INSERT INTO public.note_tags (user_id, name, color) VALUES (p_user_id, 'important', '#ef4444');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.note_tags WHERE user_id = p_user_id AND name = 'project') THEN
    INSERT INTO public.note_tags (user_id, name, color) VALUES (p_user_id, 'project', '#3b82f6');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.note_tags WHERE user_id = p_user_id AND name = 'meeting') THEN
    INSERT INTO public.note_tags (user_id, name, color) VALUES (p_user_id, 'meeting', '#8b5cf6');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.note_tags WHERE user_id = p_user_id AND name = 'idea') THEN
    INSERT INTO public.note_tags (user_id, name, color) VALUES (p_user_id, 'idea', '#f59e0b');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.note_tags WHERE user_id = p_user_id AND name = 'reference') THEN
    INSERT INTO public.note_tags (user_id, name, color) VALUES (p_user_id, 'reference', '#10b981');
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION create_starter_note_tags(UUID) TO authenticated;


-- =====================================================
-- 9. FULL-TEXT SEARCH FUNCTION
-- =====================================================
-- Search notes by title and content

CREATE OR REPLACE FUNCTION search_notes(
  p_user_id UUID,
  p_query TEXT,
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  content_preview TEXT,
  folder_id UUID,
  folder_name TEXT,
  is_pinned BOOLEAN,
  updated_at TIMESTAMPTZ,
  rank REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    n.id,
    n.title,
    LEFT(n.content_text, 200) as content_preview,
    n.folder_id,
    f.name as folder_name,
    n.is_pinned,
    n.updated_at,
    ts_rank(
      to_tsvector('english', coalesce(n.title, '') || ' ' || coalesce(n.content_text, '')),
      plainto_tsquery('english', p_query)
    ) as rank
  FROM public.notes n
  LEFT JOIN public.note_folders f ON n.folder_id = f.id
  WHERE n.user_id = p_user_id
    AND n.is_archived = FALSE
    AND (
      to_tsvector('english', coalesce(n.title, '') || ' ' || coalesce(n.content_text, ''))
      @@ plainto_tsquery('english', p_query)
      OR n.title ILIKE '%' || p_query || '%'
      OR n.content_text ILIKE '%' || p_query || '%'
    )
  ORDER BY rank DESC, n.updated_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION search_notes(UUID, TEXT, INTEGER, INTEGER) TO authenticated;


-- =====================================================
-- 10. GET NOTES WITH TAGS FUNCTION
-- =====================================================
-- Efficiently fetch notes with their tags

CREATE OR REPLACE FUNCTION get_notes_with_tags(
  p_user_id UUID,
  p_folder_id UUID DEFAULT NULL,
  p_tag_id UUID DEFAULT NULL,
  p_is_pinned BOOLEAN DEFAULT NULL,
  p_is_archived BOOLEAN DEFAULT FALSE,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  content_preview TEXT,
  folder_id UUID,
  folder_name TEXT,
  folder_color TEXT,
  is_pinned BOOLEAN,
  is_archived BOOLEAN,
  word_count INTEGER,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  tags JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    n.id,
    n.title,
    LEFT(n.content_text, 150) as content_preview,
    n.folder_id,
    f.name as folder_name,
    f.color as folder_color,
    n.is_pinned,
    n.is_archived,
    n.word_count,
    n.created_at,
    n.updated_at,
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', t.id,
            'name', t.name,
            'color', t.color
          )
        )
        FROM public.note_tag_links ntl
        JOIN public.note_tags t ON ntl.tag_id = t.id
        WHERE ntl.note_id = n.id
      ),
      '[]'::jsonb
    ) as tags
  FROM public.notes n
  LEFT JOIN public.note_folders f ON n.folder_id = f.id
  WHERE n.user_id = p_user_id
    AND (p_folder_id IS NULL OR n.folder_id = p_folder_id)
    AND (p_is_pinned IS NULL OR n.is_pinned = p_is_pinned)
    AND n.is_archived = p_is_archived
    AND (
      p_tag_id IS NULL OR EXISTS (
        SELECT 1 FROM public.note_tag_links ntl
        WHERE ntl.note_id = n.id AND ntl.tag_id = p_tag_id
      )
    )
  ORDER BY n.is_pinned DESC, n.updated_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_notes_with_tags(UUID, UUID, UUID, BOOLEAN, BOOLEAN, INTEGER, INTEGER) TO authenticated;


-- =====================================================
-- 11. GET NOTE WITH LINKED TASKS FUNCTION
-- =====================================================
-- Fetch a single note with its linked tasks

CREATE OR REPLACE FUNCTION get_note_with_tasks(
  p_user_id UUID,
  p_note_id UUID
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  content JSONB,
  content_text TEXT,
  folder_id UUID,
  folder_name TEXT,
  is_pinned BOOLEAN,
  is_archived BOOLEAN,
  word_count INTEGER,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  tags JSONB,
  linked_tasks JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    n.id,
    n.title,
    n.content,
    n.content_text,
    n.folder_id,
    f.name as folder_name,
    n.is_pinned,
    n.is_archived,
    n.word_count,
    n.created_at,
    n.updated_at,
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', t.id,
            'name', t.name,
            'color', t.color
          )
        )
        FROM public.note_tag_links ntl
        JOIN public.note_tags t ON ntl.tag_id = t.id
        WHERE ntl.note_id = n.id
      ),
      '[]'::jsonb
    ) as tags,
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', td.id,
            'title', td.title,
            'completed', td.completed,
            'priority', td.priority,
            'due_date', td.due_date,
            'due_time', td.due_time
          )
        )
        FROM public.task_note_links tnl
        JOIN public.todos td ON tnl.task_id = td.id
        WHERE tnl.note_id = n.id
      ),
      '[]'::jsonb
    ) as linked_tasks
  FROM public.notes n
  LEFT JOIN public.note_folders f ON n.folder_id = f.id
  WHERE n.id = p_note_id
    AND n.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_note_with_tasks(UUID, UUID) TO authenticated;


-- =====================================================
-- 12. GET TASK LINKED NOTES FUNCTION
-- =====================================================
-- Fetch notes linked to a specific task

CREATE OR REPLACE FUNCTION get_task_linked_notes(
  p_user_id UUID,
  p_task_id UUID
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  content_preview TEXT,
  folder_name TEXT,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    n.id,
    n.title,
    LEFT(n.content_text, 100) as content_preview,
    f.name as folder_name,
    n.updated_at
  FROM public.task_note_links tnl
  JOIN public.notes n ON tnl.note_id = n.id
  LEFT JOIN public.note_folders f ON n.folder_id = f.id
  WHERE tnl.task_id = p_task_id
    AND n.user_id = p_user_id
  ORDER BY n.updated_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_task_linked_notes(UUID, UUID) TO authenticated;


-- =====================================================
-- 13. NOTE STATISTICS FUNCTION
-- =====================================================
-- Get note statistics for dashboard

CREATE OR REPLACE FUNCTION get_note_stats(p_user_id UUID)
RETURNS TABLE (
  total_notes BIGINT,
  pinned_notes BIGINT,
  archived_notes BIGINT,
  total_folders BIGINT,
  total_tags BIGINT,
  total_word_count BIGINT,
  notes_this_week BIGINT,
  notes_this_month BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM public.notes WHERE user_id = p_user_id AND is_archived = FALSE),
    (SELECT COUNT(*) FROM public.notes WHERE user_id = p_user_id AND is_pinned = TRUE AND is_archived = FALSE),
    (SELECT COUNT(*) FROM public.notes WHERE user_id = p_user_id AND is_archived = TRUE),
    (SELECT COUNT(*) FROM public.note_folders WHERE user_id = p_user_id),
    (SELECT COUNT(*) FROM public.note_tags WHERE user_id = p_user_id),
    (SELECT COALESCE(SUM(word_count), 0) FROM public.notes WHERE user_id = p_user_id),
    (SELECT COUNT(*) FROM public.notes WHERE user_id = p_user_id AND created_at >= NOW() - INTERVAL '7 days'),
    (SELECT COUNT(*) FROM public.notes WHERE user_id = p_user_id AND created_at >= NOW() - INTERVAL '30 days');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_note_stats(UUID) TO authenticated;


-- =====================================================
-- STORAGE BUCKET SETUP (Run in Supabase Dashboard)
-- =====================================================
-- Note: Storage bucket must be created via Supabase Dashboard or API
--
-- Bucket name: note-images
-- Public: false (private)
-- File size limit: 5MB
-- Allowed MIME types: image/png, image/jpeg, image/gif, image/webp
--
-- Storage Policies (create in Dashboard):
--
-- 1. Allow authenticated users to upload to their own folder:
--    Policy name: "Users can upload own images"
--    Target: INSERT
--    Policy: (bucket_id = 'note-images' AND auth.uid()::text = (storage.foldername(name))[1])
--
-- 2. Allow authenticated users to view their own images:
--    Policy name: "Users can view own images"
--    Target: SELECT
--    Policy: (bucket_id = 'note-images' AND auth.uid()::text = (storage.foldername(name))[1])
--
-- 3. Allow authenticated users to delete their own images:
--    Policy name: "Users can delete own images"
--    Target: DELETE
--    Policy: (bucket_id = 'note-images' AND auth.uid()::text = (storage.foldername(name))[1])


-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
--
-- Tables created:
--   1. note_folders - Folder organization for notes
--   2. notes - Main notes table with content
--   3. note_tags - User-defined tags
--   4. note_tag_links - Many-to-many note-tag relationships
--   5. task_note_links - Link notes to tasks
--   6. note_images - Track uploaded images
--
-- Functions created:
--   1. create_starter_note_folders() - Creates default folders
--   2. create_starter_note_tags() - Creates default tags
--   3. search_notes() - Full-text search
--   4. get_notes_with_tags() - Fetch notes with tags
--   5. get_note_with_tasks() - Fetch note with linked tasks
--   6. get_task_linked_notes() - Fetch notes for a task
--   7. get_note_stats() - Dashboard statistics
--
-- Next steps:
--   1. Run this migration in Supabase SQL Editor
--   2. Create 'note-images' storage bucket in Dashboard
--   3. Add storage policies for the bucket
--   4. Test with: SELECT create_starter_note_folders('user-uuid-here');
-- =====================================================
