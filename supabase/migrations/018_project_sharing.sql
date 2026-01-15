-- =====================================================
-- Project Sharing Feature - Migration 018
-- This migration adds shareable links for projects
-- enabling collaboration via URL with optional security
-- =====================================================

-- =====================================================
-- 1. PROJECT SHARE LINKS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS project_share_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Link identification
  token VARCHAR(64) NOT NULL UNIQUE,
  name VARCHAR(100), -- Optional label like "Team Link" or "Client Access"

  -- Access level granted to users who claim this link
  access_level VARCHAR(20) DEFAULT 'viewer'
    CHECK (access_level IN ('viewer', 'member', 'admin')),

  -- Security options
  password_hash TEXT, -- bcrypt hash if password protected
  expires_at TIMESTAMP WITH TIME ZONE, -- NULL = never expires
  max_uses INTEGER, -- NULL = unlimited uses
  use_count INTEGER DEFAULT 0,

  -- Access flags
  is_public BOOLEAN DEFAULT false, -- If true, viewable without login
  is_active BOOLEAN DEFAULT true, -- Can be disabled without deleting

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_used_at TIMESTAMP WITH TIME ZONE
);

-- =====================================================
-- 2. SHARE LINK ACCESS LOG (Audit Trail)
-- =====================================================

CREATE TABLE IF NOT EXISTS share_link_access_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  share_link_id UUID REFERENCES project_share_links(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- NULL for public access
  action VARCHAR(20) NOT NULL CHECK (action IN ('viewed', 'claimed', 'rejected')),
  ip_address VARCHAR(45), -- IPv4 or IPv6
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 3. INDEXES FOR PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_share_links_token ON project_share_links(token);
CREATE INDEX IF NOT EXISTS idx_share_links_project_id ON project_share_links(project_id);
CREATE INDEX IF NOT EXISTS idx_share_links_created_by ON project_share_links(created_by);
CREATE INDEX IF NOT EXISTS idx_share_links_is_active ON project_share_links(is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_access_log_share_link ON share_link_access_log(share_link_id);
CREATE INDEX IF NOT EXISTS idx_access_log_user ON share_link_access_log(user_id);
CREATE INDEX IF NOT EXISTS idx_access_log_created_at ON share_link_access_log(created_at);

-- =====================================================
-- 4. ENABLE ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE project_share_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE share_link_access_log ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 5. RLS POLICIES FOR SHARE LINKS
-- =====================================================

-- Project owner and admins can view share links
CREATE POLICY "Admins can view share links"
  ON project_share_links
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_share_links.project_id
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

-- Project owner and admins can create share links
CREATE POLICY "Admins can create share links"
  ON project_share_links
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_share_links.project_id
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

-- Project owner and admins can update share links
CREATE POLICY "Admins can update share links"
  ON project_share_links
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_share_links.project_id
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

-- Project owner and admins can delete share links
CREATE POLICY "Admins can delete share links"
  ON project_share_links
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_share_links.project_id
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
-- 6. RLS POLICIES FOR ACCESS LOG
-- =====================================================

-- Only project owner/admins can view access logs
CREATE POLICY "Admins can view access logs"
  ON share_link_access_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_share_links psl
      JOIN projects p ON p.id = psl.project_id
      WHERE psl.id = share_link_access_log.share_link_id
      AND (
        p.user_id = auth.uid()
        OR
        EXISTS (
          SELECT 1 FROM project_members pm
          WHERE pm.project_id = p.id
          AND pm.user_id = auth.uid()
          AND pm.role IN ('owner', 'admin')
          AND pm.accepted_at IS NOT NULL
        )
      )
    )
  );

-- System can insert access logs (via service role or RPC)
CREATE POLICY "System can insert access logs"
  ON share_link_access_log
  FOR INSERT
  WITH CHECK (true); -- Controlled via RPC functions

-- =====================================================
-- 7. HELPER FUNCTION: Validate Share Link
-- Returns link details if valid, NULL if invalid
-- =====================================================

CREATE OR REPLACE FUNCTION validate_share_link(p_token VARCHAR(64))
RETURNS TABLE (
  link_id UUID,
  project_id UUID,
  project_name VARCHAR(100),
  access_level VARCHAR(20),
  requires_password BOOLEAN,
  is_valid BOOLEAN,
  invalid_reason TEXT
) AS $$
DECLARE
  v_link project_share_links%ROWTYPE;
  v_project projects%ROWTYPE;
BEGIN
  -- Find the link
  SELECT * INTO v_link
  FROM project_share_links
  WHERE token = p_token;

  -- Link not found
  IF NOT FOUND THEN
    RETURN QUERY SELECT
      NULL::UUID, NULL::UUID, NULL::VARCHAR(100), NULL::VARCHAR(20),
      false, false, 'Link not found'::TEXT;
    RETURN;
  END IF;

  -- Link is inactive
  IF NOT v_link.is_active THEN
    RETURN QUERY SELECT
      v_link.id, v_link.project_id, NULL::VARCHAR(100), v_link.access_level,
      v_link.password_hash IS NOT NULL, false, 'Link has been deactivated'::TEXT;
    RETURN;
  END IF;

  -- Link has expired
  IF v_link.expires_at IS NOT NULL AND v_link.expires_at < NOW() THEN
    RETURN QUERY SELECT
      v_link.id, v_link.project_id, NULL::VARCHAR(100), v_link.access_level,
      v_link.password_hash IS NOT NULL, false, 'Link has expired'::TEXT;
    RETURN;
  END IF;

  -- Link has reached max uses
  IF v_link.max_uses IS NOT NULL AND v_link.use_count >= v_link.max_uses THEN
    RETURN QUERY SELECT
      v_link.id, v_link.project_id, NULL::VARCHAR(100), v_link.access_level,
      v_link.password_hash IS NOT NULL, false, 'Link has reached maximum uses'::TEXT;
    RETURN;
  END IF;

  -- Get project name
  SELECT * INTO v_project
  FROM projects
  WHERE id = v_link.project_id;

  -- Project not found (deleted)
  IF NOT FOUND THEN
    RETURN QUERY SELECT
      v_link.id, v_link.project_id, NULL::VARCHAR(100), v_link.access_level,
      v_link.password_hash IS NOT NULL, false, 'Project no longer exists'::TEXT;
    RETURN;
  END IF;

  -- Link is valid
  RETURN QUERY SELECT
    v_link.id,
    v_link.project_id,
    v_project.name,
    v_link.access_level,
    v_link.password_hash IS NOT NULL,
    true,
    NULL::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 8. HELPER FUNCTION: Claim Share Link
-- Adds user to project_members and increments use count
-- =====================================================

CREATE OR REPLACE FUNCTION claim_share_link(
  p_token VARCHAR(64),
  p_password TEXT DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT,
  project_id UUID,
  access_level VARCHAR(20)
) AS $$
DECLARE
  v_link project_share_links%ROWTYPE;
  v_user_id UUID;
  v_existing_member project_members%ROWTYPE;
BEGIN
  v_user_id := auth.uid();

  -- Must be authenticated
  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT false, 'You must be logged in to join a project'::TEXT, NULL::UUID, NULL::VARCHAR(20);
    RETURN;
  END IF;

  -- Find the link
  SELECT * INTO v_link
  FROM project_share_links
  WHERE token = p_token;

  -- Validate link exists and is active
  IF NOT FOUND OR NOT v_link.is_active THEN
    RETURN QUERY SELECT false, 'Invalid or inactive link'::TEXT, NULL::UUID, NULL::VARCHAR(20);
    RETURN;
  END IF;

  -- Check expiry
  IF v_link.expires_at IS NOT NULL AND v_link.expires_at < NOW() THEN
    RETURN QUERY SELECT false, 'This link has expired'::TEXT, NULL::UUID, NULL::VARCHAR(20);
    RETURN;
  END IF;

  -- Check max uses
  IF v_link.max_uses IS NOT NULL AND v_link.use_count >= v_link.max_uses THEN
    RETURN QUERY SELECT false, 'This link has reached its maximum uses'::TEXT, NULL::UUID, NULL::VARCHAR(20);
    RETURN;
  END IF;

  -- Check password if required (password verification should be done in application layer with bcrypt)
  -- This function assumes password was already verified by the application
  IF v_link.password_hash IS NOT NULL AND p_password IS NULL THEN
    RETURN QUERY SELECT false, 'Password required'::TEXT, NULL::UUID, NULL::VARCHAR(20);
    RETURN;
  END IF;

  -- Check if user is already a member
  SELECT * INTO v_existing_member
  FROM project_members
  WHERE project_id = v_link.project_id AND user_id = v_user_id;

  IF FOUND THEN
    RETURN QUERY SELECT true, 'You are already a member of this project'::TEXT, v_link.project_id, v_existing_member.role;
    RETURN;
  END IF;

  -- Add user as member with the link's access level
  INSERT INTO project_members (project_id, user_id, role, accepted_at, invited_by)
  VALUES (v_link.project_id, v_user_id, v_link.access_level, NOW(), v_link.created_by);

  -- Increment use count and update last_used_at
  UPDATE project_share_links
  SET use_count = use_count + 1, last_used_at = NOW()
  WHERE id = v_link.id;

  -- Log the access
  INSERT INTO share_link_access_log (share_link_id, user_id, action)
  VALUES (v_link.id, v_user_id, 'claimed');

  RETURN QUERY SELECT true, 'Successfully joined project'::TEXT, v_link.project_id, v_link.access_level;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 9. HELPER FUNCTION: Generate Random Token
-- =====================================================

CREATE OR REPLACE FUNCTION generate_share_token()
RETURNS VARCHAR(64) AS $$
DECLARE
  v_token VARCHAR(64);
  v_exists BOOLEAN;
BEGIN
  LOOP
    -- Generate a random 64-character hex string
    v_token := encode(gen_random_bytes(32), 'hex');

    -- Check if it already exists
    SELECT EXISTS (
      SELECT 1 FROM project_share_links WHERE token = v_token
    ) INTO v_exists;

    -- Exit loop if unique
    EXIT WHEN NOT v_exists;
  END LOOP;

  RETURN v_token;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 10. HELPER FUNCTION: Create Share Link
-- =====================================================

CREATE OR REPLACE FUNCTION create_share_link(
  p_project_id UUID,
  p_name VARCHAR(100) DEFAULT NULL,
  p_access_level VARCHAR(20) DEFAULT 'viewer',
  p_password_hash TEXT DEFAULT NULL,
  p_expires_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_max_uses INTEGER DEFAULT NULL,
  p_is_public BOOLEAN DEFAULT false
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT,
  link_id UUID,
  token VARCHAR(64)
) AS $$
DECLARE
  v_user_id UUID;
  v_is_admin BOOLEAN;
  v_token VARCHAR(64);
  v_link_id UUID;
BEGIN
  v_user_id := auth.uid();

  -- Must be authenticated
  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT false, 'You must be logged in'::TEXT, NULL::UUID, NULL::VARCHAR(64);
    RETURN;
  END IF;

  -- Check if user is owner or admin of the project
  SELECT EXISTS (
    SELECT 1 FROM projects p
    LEFT JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = v_user_id
    WHERE p.id = p_project_id
    AND (
      p.user_id = v_user_id
      OR (pm.role IN ('owner', 'admin') AND pm.accepted_at IS NOT NULL)
    )
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RETURN QUERY SELECT false, 'You do not have permission to create share links for this project'::TEXT, NULL::UUID, NULL::VARCHAR(64);
    RETURN;
  END IF;

  -- Generate unique token
  v_token := generate_share_token();

  -- Create the share link
  INSERT INTO project_share_links (
    project_id, created_by, token, name, access_level,
    password_hash, expires_at, max_uses, is_public
  ) VALUES (
    p_project_id, v_user_id, v_token, p_name, p_access_level,
    p_password_hash, p_expires_at, p_max_uses, p_is_public
  )
  RETURNING id INTO v_link_id;

  RETURN QUERY SELECT true, 'Share link created successfully'::TEXT, v_link_id, v_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
