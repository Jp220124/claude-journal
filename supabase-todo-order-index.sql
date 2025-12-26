-- Migration: Add order_index to todos table for drag-and-drop reordering
-- Run this in your Supabase SQL Editor

-- Add order_index column to todos table
ALTER TABLE public.todos ADD COLUMN IF NOT EXISTS order_index INTEGER DEFAULT 0;

-- Create index for faster ordering queries (category + order)
CREATE INDEX IF NOT EXISTS idx_todos_category_order ON public.todos(category_id, order_index);

-- RPC function for atomic reordering of tasks within a category
-- Takes a category_id and an array of task IDs in the desired order
CREATE OR REPLACE FUNCTION reorder_tasks_in_category(
  p_category_id UUID,
  p_task_ids UUID[]
)
RETURNS VOID AS $$
DECLARE
  v_index INTEGER := 0;
  v_task_id UUID;
BEGIN
  FOREACH v_task_id IN ARRAY p_task_ids
  LOOP
    UPDATE public.todos
    SET order_index = v_index, updated_at = NOW()
    WHERE id = v_task_id
      AND (category_id = p_category_id OR (category_id IS NULL AND p_category_id IS NULL));
    v_index := v_index + 1;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION reorder_tasks_in_category(UUID, UUID[]) TO authenticated;
