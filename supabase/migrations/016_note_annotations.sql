-- Migration: Add Note Annotations (Sticky Notes)
-- Description: Enables connected sticky notes feature for notes

-- Create the note_annotations table
CREATE TABLE IF NOT EXISTS note_annotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Anchor Information (where the line connects to in the document)
  anchor_id TEXT NOT NULL,           -- Unique ID matching the mark in TipTap document
  anchor_text TEXT,                  -- Snapshot of anchored text for reference

  -- Sticky Note Content
  content TEXT NOT NULL DEFAULT '',
  color TEXT DEFAULT '#FEF3C7',      -- Default yellow/cream color

  -- Sticky Note Position (relative to editor container, in pixels)
  position_x FLOAT NOT NULL DEFAULT 400,
  position_y FLOAT NOT NULL DEFAULT 0,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for efficient queries
CREATE INDEX idx_note_annotations_note_id ON note_annotations(note_id);
CREATE INDEX idx_note_annotations_user_id ON note_annotations(user_id);
CREATE INDEX idx_note_annotations_anchor_id ON note_annotations(anchor_id);

-- Enable RLS
ALTER TABLE note_annotations ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view their own annotations
CREATE POLICY "Users can view own annotations"
  ON note_annotations
  FOR SELECT
  USING (user_id = auth.uid());

-- Users can create annotations for their own notes
CREATE POLICY "Users can create own annotations"
  ON note_annotations
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM notes
      WHERE notes.id = note_id AND notes.user_id = auth.uid()
    )
  );

-- Users can update their own annotations
CREATE POLICY "Users can update own annotations"
  ON note_annotations
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Users can delete their own annotations
CREATE POLICY "Users can delete own annotations"
  ON note_annotations
  FOR DELETE
  USING (user_id = auth.uid());

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_note_annotation_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
CREATE TRIGGER trigger_note_annotation_updated_at
  BEFORE UPDATE ON note_annotations
  FOR EACH ROW
  EXECUTE FUNCTION update_note_annotation_updated_at();

-- Add comment for documentation
COMMENT ON TABLE note_annotations IS 'Stores sticky note annotations attached to specific points in notes';
COMMENT ON COLUMN note_annotations.anchor_id IS 'Unique ID that matches the data-sticky-anchor-id attribute in the TipTap document mark';
COMMENT ON COLUMN note_annotations.position_x IS 'X position in pixels relative to the editor container';
COMMENT ON COLUMN note_annotations.position_y IS 'Y position in pixels relative to the anchor element';
