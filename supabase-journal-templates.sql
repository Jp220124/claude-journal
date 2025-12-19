-- =====================================================
-- Journal Templates System - Database Schema
-- =====================================================
-- This migration creates tables for custom journal templates
-- where users can create templates with sections and use them
-- for daily journaling.
-- =====================================================

-- 1. JOURNAL TEMPLATES TABLE
-- Stores the main template definitions (e.g., "Daily Routine", "Work Log")
-- =====================================================
CREATE TABLE IF NOT EXISTS public.journal_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT 'auto_stories',
  color TEXT DEFAULT '#6366f1',
  is_default BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.journal_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for journal_templates
CREATE POLICY "Users can view own journal templates"
  ON public.journal_templates
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own journal templates"
  ON public.journal_templates
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own journal templates"
  ON public.journal_templates
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own journal templates"
  ON public.journal_templates
  FOR DELETE
  USING (auth.uid() = user_id);

-- Indexes for journal_templates
CREATE INDEX IF NOT EXISTS idx_journal_templates_user_id
  ON public.journal_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_journal_templates_user_active
  ON public.journal_templates(user_id, is_active);

-- Updated_at trigger for journal_templates
CREATE OR REPLACE FUNCTION update_journal_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_journal_templates_updated_at
  BEFORE UPDATE ON public.journal_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_journal_templates_updated_at();


-- 2. JOURNAL TEMPLATE SECTIONS TABLE
-- Stores sections within each template (e.g., "Morning", "Work", "Exercise")
-- =====================================================
CREATE TABLE IF NOT EXISTS public.journal_template_sections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES public.journal_templates(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT 'notes',
  color TEXT DEFAULT '#8b5cf6',
  order_index INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.journal_template_sections ENABLE ROW LEVEL SECURITY;

-- RLS Policies for journal_template_sections
CREATE POLICY "Users can view own template sections"
  ON public.journal_template_sections
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own template sections"
  ON public.journal_template_sections
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own template sections"
  ON public.journal_template_sections
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own template sections"
  ON public.journal_template_sections
  FOR DELETE
  USING (auth.uid() = user_id);

-- Indexes for journal_template_sections
CREATE INDEX IF NOT EXISTS idx_journal_template_sections_template_id
  ON public.journal_template_sections(template_id);
CREATE INDEX IF NOT EXISTS idx_journal_template_sections_user_id
  ON public.journal_template_sections(user_id);


-- 3. JOURNAL TEMPLATE ENTRIES TABLE
-- Stores daily entries for a specific template
-- One entry per template per day per user
-- =====================================================
CREATE TABLE IF NOT EXISTS public.journal_template_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES public.journal_templates(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  overall_mood TEXT,
  overall_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- Ensure one entry per template per day per user
  UNIQUE(user_id, template_id, date)
);

-- Enable RLS
ALTER TABLE public.journal_template_entries ENABLE ROW LEVEL SECURITY;

-- RLS Policies for journal_template_entries
CREATE POLICY "Users can view own template entries"
  ON public.journal_template_entries
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own template entries"
  ON public.journal_template_entries
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own template entries"
  ON public.journal_template_entries
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own template entries"
  ON public.journal_template_entries
  FOR DELETE
  USING (auth.uid() = user_id);

-- Indexes for journal_template_entries
CREATE INDEX IF NOT EXISTS idx_journal_template_entries_user_id
  ON public.journal_template_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_journal_template_entries_template_id
  ON public.journal_template_entries(template_id);
CREATE INDEX IF NOT EXISTS idx_journal_template_entries_user_date
  ON public.journal_template_entries(user_id, date);
CREATE INDEX IF NOT EXISTS idx_journal_template_entries_template_date
  ON public.journal_template_entries(template_id, date);

-- Updated_at trigger for journal_template_entries
CREATE OR REPLACE FUNCTION update_journal_template_entries_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_journal_template_entries_updated_at
  BEFORE UPDATE ON public.journal_template_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_journal_template_entries_updated_at();


-- 4. JOURNAL TEMPLATE SECTION ENTRIES TABLE
-- Stores content for each section within a daily entry
-- =====================================================
CREATE TABLE IF NOT EXISTS public.journal_template_section_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  entry_id UUID NOT NULL REFERENCES public.journal_template_entries(id) ON DELETE CASCADE,
  section_id UUID REFERENCES public.journal_template_sections(id) ON DELETE SET NULL,
  -- Denormalized fields for when section is deleted
  section_name TEXT,
  section_icon TEXT,
  section_color TEXT,
  content TEXT,
  mood TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- Ensure one section entry per entry per section
  UNIQUE(entry_id, section_id)
);

-- Enable RLS
ALTER TABLE public.journal_template_section_entries ENABLE ROW LEVEL SECURITY;

-- RLS Policies for journal_template_section_entries
-- Need to join through entry to check user ownership
CREATE POLICY "Users can view own section entries"
  ON public.journal_template_section_entries
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.journal_template_entries e
      WHERE e.id = entry_id AND e.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own section entries"
  ON public.journal_template_section_entries
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.journal_template_entries e
      WHERE e.id = entry_id AND e.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own section entries"
  ON public.journal_template_section_entries
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.journal_template_entries e
      WHERE e.id = entry_id AND e.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.journal_template_entries e
      WHERE e.id = entry_id AND e.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own section entries"
  ON public.journal_template_section_entries
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.journal_template_entries e
      WHERE e.id = entry_id AND e.user_id = auth.uid()
    )
  );

-- Indexes for journal_template_section_entries
CREATE INDEX IF NOT EXISTS idx_journal_template_section_entries_entry_id
  ON public.journal_template_section_entries(entry_id);
CREATE INDEX IF NOT EXISTS idx_journal_template_section_entries_section_id
  ON public.journal_template_section_entries(section_id);

-- Updated_at trigger for journal_template_section_entries
CREATE OR REPLACE FUNCTION update_journal_template_section_entries_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_journal_template_section_entries_updated_at
  BEFORE UPDATE ON public.journal_template_section_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_journal_template_section_entries_updated_at();


-- =====================================================
-- HELPER FUNCTION: Create Starter Templates for New Users
-- This can be called when a new user signs up
-- This function is IDEMPOTENT - calling it multiple times will not create duplicates
-- =====================================================
CREATE OR REPLACE FUNCTION create_starter_templates(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
  v_daily_routine_id UUID;
  v_work_log_id UUID;
  v_gratitude_id UUID;
BEGIN
  -- Create "Daily Routine" template (only if not exists)
  IF NOT EXISTS (SELECT 1 FROM public.journal_templates WHERE user_id = p_user_id AND name = 'Daily Routine') THEN
    INSERT INTO public.journal_templates (user_id, name, description, icon, color, is_default, order_index)
    VALUES (p_user_id, 'Daily Routine', 'Track your daily activities and reflections', 'wb_sunny', '#f59e0b', TRUE, 0)
    RETURNING id INTO v_daily_routine_id;

    -- Daily Routine sections (only created if template was just created)
    INSERT INTO public.journal_template_sections (template_id, user_id, name, description, icon, color, order_index) VALUES
      (v_daily_routine_id, p_user_id, 'Morning', 'How did your morning go? What did you do when you woke up?', 'wb_twilight', '#fbbf24', 0),
      (v_daily_routine_id, p_user_id, 'Work', 'What did you accomplish at work today?', 'work', '#3b82f6', 1),
      (v_daily_routine_id, p_user_id, 'Exercise', 'Did you work out? How did it feel?', 'fitness_center', '#10b981', 2),
      (v_daily_routine_id, p_user_id, 'Evening', 'How did you spend your evening? Any reflections?', 'nights_stay', '#8b5cf6', 3);
  END IF;

  -- Create "Work Log" template (only if not exists)
  IF NOT EXISTS (SELECT 1 FROM public.journal_templates WHERE user_id = p_user_id AND name = 'Work Log') THEN
    INSERT INTO public.journal_templates (user_id, name, description, icon, color, order_index)
    VALUES (p_user_id, 'Work Log', 'Track your professional progress and goals', 'business_center', '#3b82f6', 1)
    RETURNING id INTO v_work_log_id;

    -- Work Log sections (only created if template was just created)
    INSERT INTO public.journal_template_sections (template_id, user_id, name, description, icon, color, order_index) VALUES
      (v_work_log_id, p_user_id, 'Accomplishments', 'What did you complete today?', 'task_alt', '#10b981', 0),
      (v_work_log_id, p_user_id, 'Challenges', 'What obstacles did you face?', 'warning', '#f59e0b', 1),
      (v_work_log_id, p_user_id, 'Tomorrow''s Goals', 'What do you want to achieve tomorrow?', 'flag', '#6366f1', 2);
  END IF;

  -- Create "Gratitude Journal" template (only if not exists)
  IF NOT EXISTS (SELECT 1 FROM public.journal_templates WHERE user_id = p_user_id AND name = 'Gratitude Journal') THEN
    INSERT INTO public.journal_templates (user_id, name, description, icon, color, order_index)
    VALUES (p_user_id, 'Gratitude Journal', 'Practice gratitude and positive thinking', 'favorite', '#ec4899', 2)
    RETURNING id INTO v_gratitude_id;

    -- Gratitude Journal sections (only created if template was just created)
    INSERT INTO public.journal_template_sections (template_id, user_id, name, description, icon, color, order_index) VALUES
      (v_gratitude_id, p_user_id, 'Grateful For', 'What are you grateful for today?', 'volunteer_activism', '#ec4899', 0),
      (v_gratitude_id, p_user_id, 'Positive Moments', 'What made you smile today?', 'sentiment_very_satisfied', '#f59e0b', 1),
      (v_gratitude_id, p_user_id, 'Affirmations', 'What positive affirmations do you have for yourself?', 'self_improvement', '#8b5cf6', 2);
  END IF;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION create_starter_templates(UUID) TO authenticated;
