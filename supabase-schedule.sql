-- =====================================================
-- Time Management / Schedule System Tables
-- Created: 2025-12-26
-- Description: Tables for time blocking, schedule settings, and pomodoro timer
-- =====================================================

-- =====================================================
-- Table: time_blocks
-- Purpose: Store time-blocked schedule entries
-- =====================================================

CREATE TABLE IF NOT EXISTS public.time_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  todo_id UUID REFERENCES public.todos(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  color TEXT DEFAULT '#06b6d4',
  is_recurring BOOLEAN DEFAULT false,
  recurrence_pattern JSONB,
  buffer_minutes INTEGER DEFAULT 0,
  block_type TEXT DEFAULT 'task' CHECK (block_type IN ('task', 'focus', 'break', 'meeting', 'personal')),
  energy_level TEXT CHECK (energy_level IS NULL OR energy_level IN ('high', 'medium', 'low')),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add constraint to ensure end_time is after start_time
ALTER TABLE public.time_blocks
ADD CONSTRAINT time_blocks_valid_time_range CHECK (end_time > start_time);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_time_blocks_user_id ON public.time_blocks(user_id);
CREATE INDEX IF NOT EXISTS idx_time_blocks_user_start ON public.time_blocks(user_id, start_time);
CREATE INDEX IF NOT EXISTS idx_time_blocks_todo ON public.time_blocks(todo_id);
CREATE INDEX IF NOT EXISTS idx_time_blocks_start_time ON public.time_blocks(start_time);

-- Enable RLS
ALTER TABLE public.time_blocks ENABLE ROW LEVEL SECURITY;

-- RLS Policies for time_blocks
CREATE POLICY "Users can view own time blocks"
ON public.time_blocks FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own time blocks"
ON public.time_blocks FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own time blocks"
ON public.time_blocks FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own time blocks"
ON public.time_blocks FOR DELETE
USING (auth.uid() = user_id);

-- =====================================================
-- Table: schedule_settings
-- Purpose: Store user preferences for scheduling
-- =====================================================

CREATE TABLE IF NOT EXISTS public.schedule_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  work_start_time TIME DEFAULT '09:00',
  work_end_time TIME DEFAULT '17:00',
  default_block_duration INTEGER DEFAULT 60,
  show_24_hours BOOLEAN DEFAULT true,
  default_view TEXT DEFAULT 'day' CHECK (default_view IN ('day', 'week', 'timeline')),
  -- Pomodoro settings
  pomodoro_work_minutes INTEGER DEFAULT 25,
  pomodoro_break_minutes INTEGER DEFAULT 5,
  pomodoro_long_break_minutes INTEGER DEFAULT 15,
  pomodoro_sessions_before_long INTEGER DEFAULT 4,
  -- Planning ritual settings
  planning_ritual_enabled BOOLEAN DEFAULT true,
  planning_ritual_time TIME DEFAULT '08:00',
  -- Advanced settings
  energy_tracking_enabled BOOLEAN DEFAULT false,
  auto_schedule_enabled BOOLEAN DEFAULT false,
  buffer_between_blocks INTEGER DEFAULT 5,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Create index for user_id
CREATE INDEX IF NOT EXISTS idx_schedule_settings_user ON public.schedule_settings(user_id);

-- Enable RLS
ALTER TABLE public.schedule_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for schedule_settings
CREATE POLICY "Users can view own schedule settings"
ON public.schedule_settings FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own schedule settings"
ON public.schedule_settings FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own schedule settings"
ON public.schedule_settings FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own schedule settings"
ON public.schedule_settings FOR DELETE
USING (auth.uid() = user_id);

-- =====================================================
-- Table: pomodoro_sessions (optional, for tracking)
-- Purpose: Track pomodoro sessions for analytics
-- =====================================================

CREATE TABLE IF NOT EXISTS public.pomodoro_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  time_block_id UUID REFERENCES public.time_blocks(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  phase TEXT NOT NULL CHECK (phase IN ('work', 'break', 'longBreak')),
  duration_seconds INTEGER NOT NULL,
  was_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_pomodoro_sessions_user ON public.pomodoro_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_pomodoro_sessions_block ON public.pomodoro_sessions(time_block_id);
CREATE INDEX IF NOT EXISTS idx_pomodoro_sessions_started ON public.pomodoro_sessions(user_id, started_at);

-- Enable RLS
ALTER TABLE public.pomodoro_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for pomodoro_sessions
CREATE POLICY "Users can view own pomodoro sessions"
ON public.pomodoro_sessions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own pomodoro sessions"
ON public.pomodoro_sessions FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own pomodoro sessions"
ON public.pomodoro_sessions FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own pomodoro sessions"
ON public.pomodoro_sessions FOR DELETE
USING (auth.uid() = user_id);

-- =====================================================
-- Table: daily_plans (for planning ritual)
-- Purpose: Store daily planning ritual data
-- =====================================================

CREATE TABLE IF NOT EXISTS public.daily_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  top_priorities UUID[] DEFAULT '{}', -- Array of todo IDs
  intention TEXT,
  reflection TEXT,
  is_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_daily_plans_user ON public.daily_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_plans_date ON public.daily_plans(user_id, date);

-- Enable RLS
ALTER TABLE public.daily_plans ENABLE ROW LEVEL SECURITY;

-- RLS Policies for daily_plans
CREATE POLICY "Users can view own daily plans"
ON public.daily_plans FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own daily plans"
ON public.daily_plans FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own daily plans"
ON public.daily_plans FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own daily plans"
ON public.daily_plans FOR DELETE
USING (auth.uid() = user_id);

-- =====================================================
-- Triggers for updated_at timestamps
-- =====================================================

-- Trigger function (if not already exists)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers to tables
DROP TRIGGER IF EXISTS update_time_blocks_updated_at ON public.time_blocks;
CREATE TRIGGER update_time_blocks_updated_at
  BEFORE UPDATE ON public.time_blocks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_schedule_settings_updated_at ON public.schedule_settings;
CREATE TRIGGER update_schedule_settings_updated_at
  BEFORE UPDATE ON public.schedule_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_daily_plans_updated_at ON public.daily_plans;
CREATE TRIGGER update_daily_plans_updated_at
  BEFORE UPDATE ON public.daily_plans
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- Helpful Views
-- =====================================================

-- View: Today's schedule with linked todos
CREATE OR REPLACE VIEW public.todays_schedule AS
SELECT
  tb.*,
  t.title as todo_title,
  t.completed as todo_completed,
  t.priority as todo_priority
FROM public.time_blocks tb
LEFT JOIN public.todos t ON tb.todo_id = t.id
WHERE tb.start_time::date = CURRENT_DATE
ORDER BY tb.start_time;

-- Grant access to the view
GRANT SELECT ON public.todays_schedule TO authenticated;
