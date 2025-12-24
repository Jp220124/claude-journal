-- =====================================================
-- Projects Hub Feature - Migration 009
-- This migration adds the complete projects system
-- including collaboration, calendar events, and file storage
-- =====================================================

-- =====================================================
-- 1. CORE PROJECTS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  color VARCHAR(20) DEFAULT '#6366f1',
  icon VARCHAR(50) DEFAULT 'folder',
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'on_hold', 'completed', 'archived')),
  start_date DATE,
  target_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 2. PROJECT MEMBERS (Collaboration)
-- =====================================================

CREATE TABLE IF NOT EXISTS project_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role VARCHAR(20) DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  invited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  accepted_at TIMESTAMP WITH TIME ZONE,
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE(project_id, user_id)
);

-- =====================================================
-- 3. PROJECT-TASK LINKS (Many-to-Many)
-- =====================================================

CREATE TABLE IF NOT EXISTS project_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  task_id UUID REFERENCES todos(id) ON DELETE CASCADE NOT NULL,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  added_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE(project_id, task_id)
);

-- =====================================================
-- 4. PROJECT-NOTE LINKS (Many-to-Many)
-- =====================================================

CREATE TABLE IF NOT EXISTS project_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  note_id UUID REFERENCES notes(id) ON DELETE CASCADE NOT NULL,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  added_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE(project_id, note_id)
);

-- =====================================================
-- 5. CALENDAR EVENTS
-- =====================================================

CREATE TABLE IF NOT EXISTS calendar_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  event_type VARCHAR(20) DEFAULT 'event' CHECK (event_type IN ('event', 'milestone', 'deadline', 'meeting')),
  start_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
  end_datetime TIMESTAMP WITH TIME ZONE,
  all_day BOOLEAN DEFAULT false,
  color VARCHAR(20),
  location VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 6. PROJECT-EVENT LINKS (Many-to-Many)
-- =====================================================

CREATE TABLE IF NOT EXISTS project_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  event_id UUID REFERENCES calendar_events(id) ON DELETE CASCADE NOT NULL,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  added_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE(project_id, event_id)
);

-- =====================================================
-- 7. PROJECT FILES
-- =====================================================

CREATE TABLE IF NOT EXISTS project_files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  file_type VARCHAR(100),
  description TEXT,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 8. INDEXES FOR PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at);

CREATE INDEX IF NOT EXISTS idx_project_members_project_id ON project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user_id ON project_members(user_id);

CREATE INDEX IF NOT EXISTS idx_project_tasks_project_id ON project_tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_project_tasks_task_id ON project_tasks(task_id);

CREATE INDEX IF NOT EXISTS idx_project_notes_project_id ON project_notes(project_id);
CREATE INDEX IF NOT EXISTS idx_project_notes_note_id ON project_notes(note_id);

CREATE INDEX IF NOT EXISTS idx_calendar_events_user_id ON calendar_events(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_start_datetime ON calendar_events(start_datetime);

CREATE INDEX IF NOT EXISTS idx_project_events_project_id ON project_events(project_id);
CREATE INDEX IF NOT EXISTS idx_project_events_event_id ON project_events(event_id);

CREATE INDEX IF NOT EXISTS idx_project_files_project_id ON project_files(project_id);
CREATE INDEX IF NOT EXISTS idx_project_files_user_id ON project_files(user_id);

-- =====================================================
-- 9. ENABLE ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_files ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 10. RLS POLICIES FOR PROJECTS
-- =====================================================

-- Users can view projects they own or are members of
CREATE POLICY "Users can view accessible projects"
  ON projects
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR
    EXISTS (
      SELECT 1 FROM project_members
      WHERE project_members.project_id = projects.id
      AND project_members.user_id = auth.uid()
      AND project_members.accepted_at IS NOT NULL
    )
  );

-- Only the owner can create projects
CREATE POLICY "Users can create own projects"
  ON projects
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Owner and admins can update projects
CREATE POLICY "Users can update accessible projects"
  ON projects
  FOR UPDATE
  USING (
    auth.uid() = user_id
    OR
    EXISTS (
      SELECT 1 FROM project_members
      WHERE project_members.project_id = projects.id
      AND project_members.user_id = auth.uid()
      AND project_members.role IN ('owner', 'admin')
      AND project_members.accepted_at IS NOT NULL
    )
  );

-- Only the owner can delete projects
CREATE POLICY "Users can delete own projects"
  ON projects
  FOR DELETE
  USING (auth.uid() = user_id);

-- =====================================================
-- 11. RLS POLICIES FOR PROJECT MEMBERS
-- =====================================================

-- Users can view members of projects they have access to
CREATE POLICY "Users can view members of accessible projects"
  ON project_members
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_members.project_id
      AND (
        projects.user_id = auth.uid()
        OR
        EXISTS (
          SELECT 1 FROM project_members pm2
          WHERE pm2.project_id = projects.id
          AND pm2.user_id = auth.uid()
          AND pm2.accepted_at IS NOT NULL
        )
      )
    )
  );

-- Only owner and admins can add members
CREATE POLICY "Admins can add members"
  ON project_members
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_members.project_id
      AND (
        projects.user_id = auth.uid()
        OR
        EXISTS (
          SELECT 1 FROM project_members pm2
          WHERE pm2.project_id = projects.id
          AND pm2.user_id = auth.uid()
          AND pm2.role IN ('owner', 'admin')
          AND pm2.accepted_at IS NOT NULL
        )
      )
    )
  );

-- Users can update their own membership (e.g., accept invitation)
-- Or admins can update any membership
CREATE POLICY "Users can update membership"
  ON project_members
  FOR UPDATE
  USING (
    project_members.user_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_members.project_id
      AND (
        projects.user_id = auth.uid()
        OR
        EXISTS (
          SELECT 1 FROM project_members pm2
          WHERE pm2.project_id = projects.id
          AND pm2.user_id = auth.uid()
          AND pm2.role IN ('owner', 'admin')
          AND pm2.accepted_at IS NOT NULL
        )
      )
    )
  );

-- Owner and admins can remove members, users can remove themselves
CREATE POLICY "Users can remove membership"
  ON project_members
  FOR DELETE
  USING (
    project_members.user_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_members.project_id
      AND (
        projects.user_id = auth.uid()
        OR
        EXISTS (
          SELECT 1 FROM project_members pm2
          WHERE pm2.project_id = projects.id
          AND pm2.user_id = auth.uid()
          AND pm2.role IN ('owner', 'admin')
          AND pm2.accepted_at IS NOT NULL
        )
      )
    )
  );

-- =====================================================
-- 12. RLS POLICIES FOR PROJECT TASKS
-- =====================================================

-- Users can view task links for accessible projects
CREATE POLICY "Users can view project task links"
  ON project_tasks
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_tasks.project_id
      AND (
        projects.user_id = auth.uid()
        OR
        EXISTS (
          SELECT 1 FROM project_members
          WHERE project_members.project_id = projects.id
          AND project_members.user_id = auth.uid()
          AND project_members.accepted_at IS NOT NULL
        )
      )
    )
  );

-- Members (not viewers) can add task links
CREATE POLICY "Members can add task links"
  ON project_tasks
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_tasks.project_id
      AND (
        projects.user_id = auth.uid()
        OR
        EXISTS (
          SELECT 1 FROM project_members
          WHERE project_members.project_id = projects.id
          AND project_members.user_id = auth.uid()
          AND project_members.role IN ('owner', 'admin', 'member')
          AND project_members.accepted_at IS NOT NULL
        )
      )
    )
  );

-- Members can remove task links
CREATE POLICY "Members can remove task links"
  ON project_tasks
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_tasks.project_id
      AND (
        projects.user_id = auth.uid()
        OR
        EXISTS (
          SELECT 1 FROM project_members
          WHERE project_members.project_id = projects.id
          AND project_members.user_id = auth.uid()
          AND project_members.role IN ('owner', 'admin', 'member')
          AND project_members.accepted_at IS NOT NULL
        )
      )
    )
  );

-- =====================================================
-- 13. RLS POLICIES FOR PROJECT NOTES
-- =====================================================

-- Users can view note links for accessible projects
CREATE POLICY "Users can view project note links"
  ON project_notes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_notes.project_id
      AND (
        projects.user_id = auth.uid()
        OR
        EXISTS (
          SELECT 1 FROM project_members
          WHERE project_members.project_id = projects.id
          AND project_members.user_id = auth.uid()
          AND project_members.accepted_at IS NOT NULL
        )
      )
    )
  );

-- Members (not viewers) can add note links
CREATE POLICY "Members can add note links"
  ON project_notes
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_notes.project_id
      AND (
        projects.user_id = auth.uid()
        OR
        EXISTS (
          SELECT 1 FROM project_members
          WHERE project_members.project_id = projects.id
          AND project_members.user_id = auth.uid()
          AND project_members.role IN ('owner', 'admin', 'member')
          AND project_members.accepted_at IS NOT NULL
        )
      )
    )
  );

-- Members can remove note links
CREATE POLICY "Members can remove note links"
  ON project_notes
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_notes.project_id
      AND (
        projects.user_id = auth.uid()
        OR
        EXISTS (
          SELECT 1 FROM project_members
          WHERE project_members.project_id = projects.id
          AND project_members.user_id = auth.uid()
          AND project_members.role IN ('owner', 'admin', 'member')
          AND project_members.accepted_at IS NOT NULL
        )
      )
    )
  );

-- =====================================================
-- 14. RLS POLICIES FOR CALENDAR EVENTS
-- =====================================================

-- Users can view their own calendar events
CREATE POLICY "Users can view own calendar events"
  ON calendar_events
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create their own calendar events
CREATE POLICY "Users can create own calendar events"
  ON calendar_events
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own calendar events
CREATE POLICY "Users can update own calendar events"
  ON calendar_events
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own calendar events
CREATE POLICY "Users can delete own calendar events"
  ON calendar_events
  FOR DELETE
  USING (auth.uid() = user_id);

-- =====================================================
-- 15. RLS POLICIES FOR PROJECT EVENTS
-- =====================================================

-- Users can view event links for accessible projects
CREATE POLICY "Users can view project event links"
  ON project_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_events.project_id
      AND (
        projects.user_id = auth.uid()
        OR
        EXISTS (
          SELECT 1 FROM project_members
          WHERE project_members.project_id = projects.id
          AND project_members.user_id = auth.uid()
          AND project_members.accepted_at IS NOT NULL
        )
      )
    )
  );

-- Members can add event links
CREATE POLICY "Members can add event links"
  ON project_events
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_events.project_id
      AND (
        projects.user_id = auth.uid()
        OR
        EXISTS (
          SELECT 1 FROM project_members
          WHERE project_members.project_id = projects.id
          AND project_members.user_id = auth.uid()
          AND project_members.role IN ('owner', 'admin', 'member')
          AND project_members.accepted_at IS NOT NULL
        )
      )
    )
  );

-- Members can remove event links
CREATE POLICY "Members can remove event links"
  ON project_events
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_events.project_id
      AND (
        projects.user_id = auth.uid()
        OR
        EXISTS (
          SELECT 1 FROM project_members
          WHERE project_members.project_id = projects.id
          AND project_members.user_id = auth.uid()
          AND project_members.role IN ('owner', 'admin', 'member')
          AND project_members.accepted_at IS NOT NULL
        )
      )
    )
  );

-- =====================================================
-- 16. RLS POLICIES FOR PROJECT FILES
-- =====================================================

-- Users can view files in accessible projects
CREATE POLICY "Users can view project files"
  ON project_files
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_files.project_id
      AND (
        projects.user_id = auth.uid()
        OR
        EXISTS (
          SELECT 1 FROM project_members
          WHERE project_members.project_id = projects.id
          AND project_members.user_id = auth.uid()
          AND project_members.accepted_at IS NOT NULL
        )
      )
    )
  );

-- Members (not viewers) can upload files
CREATE POLICY "Members can upload files"
  ON project_files
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_files.project_id
      AND (
        projects.user_id = auth.uid()
        OR
        EXISTS (
          SELECT 1 FROM project_members
          WHERE project_members.project_id = projects.id
          AND project_members.user_id = auth.uid()
          AND project_members.role IN ('owner', 'admin', 'member')
          AND project_members.accepted_at IS NOT NULL
        )
      )
    )
  );

-- Users can update their own file metadata
CREATE POLICY "Users can update own file metadata"
  ON project_files
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Owner/admins can delete any file, users can delete their own
CREATE POLICY "Users can delete files"
  ON project_files
  FOR DELETE
  USING (
    auth.uid() = user_id
    OR
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_files.project_id
      AND (
        projects.user_id = auth.uid()
        OR
        EXISTS (
          SELECT 1 FROM project_members
          WHERE project_members.project_id = projects.id
          AND project_members.user_id = auth.uid()
          AND project_members.role IN ('owner', 'admin')
          AND project_members.accepted_at IS NOT NULL
        )
      )
    )
  );

-- =====================================================
-- 17. UPDATE TRIGGERS
-- =====================================================

-- Add updated_at trigger for projects
CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add updated_at trigger for calendar_events
CREATE TRIGGER update_calendar_events_updated_at
  BEFORE UPDATE ON calendar_events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 18. HELPER FUNCTION: Get project progress
-- =====================================================

CREATE OR REPLACE FUNCTION get_project_progress(p_project_id UUID)
RETURNS TABLE (
  total_tasks INTEGER,
  completed_tasks INTEGER,
  progress_percent NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::INTEGER as total_tasks,
    COUNT(*) FILTER (WHERE t.completed = true)::INTEGER as completed_tasks,
    CASE
      WHEN COUNT(*) = 0 THEN 0
      ELSE ROUND((COUNT(*) FILTER (WHERE t.completed = true)::NUMERIC / COUNT(*)::NUMERIC) * 100, 1)
    END as progress_percent
  FROM project_tasks pt
  JOIN todos t ON t.id = pt.task_id
  WHERE pt.project_id = p_project_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 19. HELPER FUNCTION: Create project with owner member
-- =====================================================

CREATE OR REPLACE FUNCTION create_project_with_owner(
  p_name VARCHAR(100),
  p_description TEXT DEFAULT NULL,
  p_color VARCHAR(20) DEFAULT '#6366f1',
  p_icon VARCHAR(50) DEFAULT 'folder',
  p_start_date DATE DEFAULT NULL,
  p_target_date DATE DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_project_id UUID;
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  -- Create the project
  INSERT INTO projects (user_id, name, description, color, icon, start_date, target_date)
  VALUES (v_user_id, p_name, p_description, p_color, p_icon, p_start_date, p_target_date)
  RETURNING id INTO v_project_id;

  -- Add the creator as owner member
  INSERT INTO project_members (project_id, user_id, role, accepted_at, invited_by)
  VALUES (v_project_id, v_user_id, 'owner', NOW(), v_user_id);

  RETURN v_project_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
