-- Task-Note Links Table
-- This table enables bidirectional linking between tasks and notes

-- Create the task_note_links table
CREATE TABLE IF NOT EXISTS task_note_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID REFERENCES todos(id) ON DELETE CASCADE NOT NULL,
  note_id UUID REFERENCES notes(id) ON DELETE CASCADE NOT NULL,
  link_type VARCHAR(20) DEFAULT 'reference' CHECK (link_type IN ('reference', 'checklist', 'attachment')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(task_id, note_id)
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_task_note_links_task_id ON task_note_links(task_id);
CREATE INDEX IF NOT EXISTS idx_task_note_links_note_id ON task_note_links(note_id);

-- Enable Row Level Security
ALTER TABLE task_note_links ENABLE ROW LEVEL SECURITY;

-- RLS Policies for task_note_links
-- Users can only access links for their own tasks/notes

-- Policy for selecting links (user must own either the task or note)
CREATE POLICY "Users can view their own task-note links"
  ON task_note_links
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM todos WHERE todos.id = task_note_links.task_id AND todos.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM notes WHERE notes.id = task_note_links.note_id AND notes.user_id = auth.uid()
    )
  );

-- Policy for inserting links (user must own both the task and note)
CREATE POLICY "Users can create links for their own tasks and notes"
  ON task_note_links
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM todos WHERE todos.id = task_note_links.task_id AND todos.user_id = auth.uid()
    )
    AND
    EXISTS (
      SELECT 1 FROM notes WHERE notes.id = task_note_links.note_id AND notes.user_id = auth.uid()
    )
  );

-- Policy for deleting links (user must own either the task or note)
CREATE POLICY "Users can delete their own task-note links"
  ON task_note_links
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM todos WHERE todos.id = task_note_links.task_id AND todos.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM notes WHERE notes.id = task_note_links.note_id AND notes.user_id = auth.uid()
    )
  );

-- Policy for updating links (user must own both the task and note)
CREATE POLICY "Users can update their own task-note links"
  ON task_note_links
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM todos WHERE todos.id = task_note_links.task_id AND todos.user_id = auth.uid()
    )
    AND
    EXISTS (
      SELECT 1 FROM notes WHERE notes.id = task_note_links.note_id AND notes.user_id = auth.uid()
    )
  );
