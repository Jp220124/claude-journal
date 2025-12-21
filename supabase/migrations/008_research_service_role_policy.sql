-- Migration: 008_research_service_role_policy
-- Description: Add service_role policy for task_note_links to allow backend to create links

-- Service role policy for task_note_links (for research automation backend)
CREATE POLICY "Service role full access task_note_links" ON task_note_links
    FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- Also ensure notes table has proper service role access for research notes
CREATE POLICY IF NOT EXISTS "Service role full access notes" ON notes
    FOR ALL USING (auth.jwt()->>'role' = 'service_role');
