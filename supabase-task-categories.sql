-- =====================================================
-- Task Categories System - Database Schema
-- =====================================================
-- This migration adds custom task categories for organizing todos
-- Categories can be things like "Work", "Personal", "Health", etc.
-- =====================================================

-- 1. TASK CATEGORIES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.task_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT DEFAULT 'folder',
  color TEXT DEFAULT '#6366f1',
  is_recurring BOOLEAN DEFAULT FALSE,  -- If true, tasks in this category repeat daily
  order_index INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.task_categories ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own task categories"
  ON public.task_categories
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own task categories"
  ON public.task_categories
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own task categories"
  ON public.task_categories
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own task categories"
  ON public.task_categories
  FOR DELETE
  USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_task_categories_user_id
  ON public.task_categories(user_id);
CREATE INDEX IF NOT EXISTS idx_task_categories_user_active
  ON public.task_categories(user_id, is_active);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_task_categories_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_task_categories_updated_at
  BEFORE UPDATE ON public.task_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_task_categories_updated_at();


-- 2. ADD CATEGORY_ID TO TODOS TABLE
-- =====================================================
-- Add foreign key reference to task_categories
ALTER TABLE public.todos
  ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.task_categories(id) ON DELETE SET NULL;

-- Index for faster category lookups
CREATE INDEX IF NOT EXISTS idx_todos_category_id
  ON public.todos(category_id);


-- 3. CREATE STARTER CATEGORIES FUNCTION
-- =====================================================
-- This function is IDEMPOTENT - calling it multiple times will not create duplicates
CREATE OR REPLACE FUNCTION create_starter_task_categories(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
  -- Create "Daily Recurring" category (only if not exists)
  IF NOT EXISTS (SELECT 1 FROM public.task_categories WHERE user_id = p_user_id AND name = 'Daily Recurring') THEN
    INSERT INTO public.task_categories (user_id, name, icon, color, is_recurring, order_index)
    VALUES (p_user_id, 'Daily Recurring', 'repeat', '#8b5cf6', TRUE, 0);
  END IF;

  -- Create "One-Time Tasks" category (only if not exists)
  IF NOT EXISTS (SELECT 1 FROM public.task_categories WHERE user_id = p_user_id AND name = 'One-Time Tasks') THEN
    INSERT INTO public.task_categories (user_id, name, icon, color, is_recurring, order_index)
    VALUES (p_user_id, 'One-Time Tasks', 'task_alt', '#3b82f6', FALSE, 1);
  END IF;

  -- Create "Work" category (only if not exists)
  IF NOT EXISTS (SELECT 1 FROM public.task_categories WHERE user_id = p_user_id AND name = 'Work') THEN
    INSERT INTO public.task_categories (user_id, name, icon, color, is_recurring, order_index)
    VALUES (p_user_id, 'Work', 'business_center', '#f59e0b', FALSE, 2);
  END IF;

  -- Create "Personal" category (only if not exists)
  IF NOT EXISTS (SELECT 1 FROM public.task_categories WHERE user_id = p_user_id AND name = 'Personal') THEN
    INSERT INTO public.task_categories (user_id, name, icon, color, is_recurring, order_index)
    VALUES (p_user_id, 'Personal', 'person', '#10b981', FALSE, 3);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION create_starter_task_categories(UUID) TO authenticated;
