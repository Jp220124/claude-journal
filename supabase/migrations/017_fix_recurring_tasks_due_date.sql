-- Migration: Fix existing tasks in recurring categories
-- Problem: Tasks in recurring categories were created with due_date set to a specific date
-- instead of NULL, causing them to only appear on that one day instead of every day.
-- Solution: Set due_date to NULL for all tasks in recurring categories.

-- Update all todos in recurring categories to have NULL due_date
UPDATE todos
SET due_date = NULL
WHERE category_id IN (
  SELECT id FROM task_categories WHERE is_recurring = true
)
AND due_date IS NOT NULL;

-- Add a comment to document this fix
COMMENT ON TABLE todos IS 'Tasks/todos table. For recurring category tasks, due_date should be NULL so they appear every day.';
