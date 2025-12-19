-- Daily Journal Application Database Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Daily Template Sections (e.g., Morning, Work, Health, Personal)
CREATE TABLE IF NOT EXISTS template_sections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name VARCHAR(100) NOT NULL,
  icon VARCHAR(50) DEFAULT '📝',
  color VARCHAR(20) DEFAULT '#4A90D9',
  order_index INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Template Tasks (recurring tasks within sections)
CREATE TABLE IF NOT EXISTS template_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  section_id UUID REFERENCES template_sections(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title VARCHAR(255) NOT NULL,
  priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  order_index INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Daily Entries (one per day per user)
CREATE TABLE IF NOT EXISTS daily_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  overall_mood VARCHAR(50),
  overall_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- Section Entries (journal for each section per day)
CREATE TABLE IF NOT EXISTS section_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  daily_entry_id UUID REFERENCES daily_entries(id) ON DELETE CASCADE NOT NULL,
  section_id UUID REFERENCES template_sections(id) ON DELETE SET NULL,
  section_name VARCHAR(100),
  section_icon VARCHAR(50),
  section_color VARCHAR(20),
  content TEXT,
  mood VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Task Instances (actual task completions per day)
CREATE TABLE IF NOT EXISTS task_instances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  daily_entry_id UUID REFERENCES daily_entries(id) ON DELETE CASCADE NOT NULL,
  template_task_id UUID REFERENCES template_tasks(id) ON DELETE SET NULL,
  section_entry_id UUID REFERENCES section_entries(id) ON DELETE CASCADE NOT NULL,
  title VARCHAR(255) NOT NULL,
  is_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low'))
);

-- Custom Tags
CREATE TABLE IF NOT EXISTS tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name VARCHAR(50) NOT NULL,
  color VARCHAR(20) DEFAULT '#4A90D9',
  UNIQUE(user_id, name)
);

-- Entry Tags (many-to-many)
CREATE TABLE IF NOT EXISTS entry_tags (
  entry_id UUID REFERENCES daily_entries(id) ON DELETE CASCADE,
  tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (entry_id, tag_id)
);

-- Attachments
CREATE TABLE IF NOT EXISTS attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  section_entry_id UUID REFERENCES section_entries(id) ON DELETE CASCADE NOT NULL,
  file_url TEXT NOT NULL,
  file_name VARCHAR(255),
  file_type VARCHAR(50),
  file_size INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User Settings
CREATE TABLE IF NOT EXISTS user_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  theme VARCHAR(20) DEFAULT 'system' CHECK (theme IN ('light', 'dark', 'system')),
  reminder_time TIME,
  reminder_enabled BOOLEAN DEFAULT false,
  streak_count INTEGER DEFAULT 0,
  last_entry_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_template_sections_user_id ON template_sections(user_id);
CREATE INDEX IF NOT EXISTS idx_template_tasks_section_id ON template_tasks(section_id);
CREATE INDEX IF NOT EXISTS idx_daily_entries_user_date ON daily_entries(user_id, date);
CREATE INDEX IF NOT EXISTS idx_section_entries_daily_entry ON section_entries(daily_entry_id);
CREATE INDEX IF NOT EXISTS idx_task_instances_section_entry ON task_instances(section_entry_id);

-- Enable Row Level Security
ALTER TABLE template_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE section_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE entry_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for template_sections
CREATE POLICY "Users can view own template sections" ON template_sections
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own template sections" ON template_sections
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own template sections" ON template_sections
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own template sections" ON template_sections
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for template_tasks
CREATE POLICY "Users can view own template tasks" ON template_tasks
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own template tasks" ON template_tasks
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own template tasks" ON template_tasks
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own template tasks" ON template_tasks
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for daily_entries
CREATE POLICY "Users can view own daily entries" ON daily_entries
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own daily entries" ON daily_entries
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own daily entries" ON daily_entries
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own daily entries" ON daily_entries
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for section_entries (check via daily_entry ownership)
CREATE POLICY "Users can view own section entries" ON section_entries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM daily_entries WHERE daily_entries.id = section_entries.daily_entry_id
      AND daily_entries.user_id = auth.uid()
    )
  );
CREATE POLICY "Users can create own section entries" ON section_entries
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM daily_entries WHERE daily_entries.id = section_entries.daily_entry_id
      AND daily_entries.user_id = auth.uid()
    )
  );
CREATE POLICY "Users can update own section entries" ON section_entries
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM daily_entries WHERE daily_entries.id = section_entries.daily_entry_id
      AND daily_entries.user_id = auth.uid()
    )
  );
CREATE POLICY "Users can delete own section entries" ON section_entries
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM daily_entries WHERE daily_entries.id = section_entries.daily_entry_id
      AND daily_entries.user_id = auth.uid()
    )
  );

-- RLS Policies for task_instances (check via daily_entry ownership)
CREATE POLICY "Users can view own task instances" ON task_instances
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM daily_entries WHERE daily_entries.id = task_instances.daily_entry_id
      AND daily_entries.user_id = auth.uid()
    )
  );
CREATE POLICY "Users can create own task instances" ON task_instances
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM daily_entries WHERE daily_entries.id = task_instances.daily_entry_id
      AND daily_entries.user_id = auth.uid()
    )
  );
CREATE POLICY "Users can update own task instances" ON task_instances
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM daily_entries WHERE daily_entries.id = task_instances.daily_entry_id
      AND daily_entries.user_id = auth.uid()
    )
  );
CREATE POLICY "Users can delete own task instances" ON task_instances
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM daily_entries WHERE daily_entries.id = task_instances.daily_entry_id
      AND daily_entries.user_id = auth.uid()
    )
  );

-- RLS Policies for tags
CREATE POLICY "Users can view own tags" ON tags
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own tags" ON tags
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own tags" ON tags
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own tags" ON tags
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for entry_tags
CREATE POLICY "Users can view own entry tags" ON entry_tags
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM daily_entries WHERE daily_entries.id = entry_tags.entry_id
      AND daily_entries.user_id = auth.uid()
    )
  );
CREATE POLICY "Users can create own entry tags" ON entry_tags
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM daily_entries WHERE daily_entries.id = entry_tags.entry_id
      AND daily_entries.user_id = auth.uid()
    )
  );
CREATE POLICY "Users can delete own entry tags" ON entry_tags
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM daily_entries WHERE daily_entries.id = entry_tags.entry_id
      AND daily_entries.user_id = auth.uid()
    )
  );

-- RLS Policies for attachments
CREATE POLICY "Users can view own attachments" ON attachments
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own attachments" ON attachments
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own attachments" ON attachments
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for user_settings
CREATE POLICY "Users can view own settings" ON user_settings
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own settings" ON user_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own settings" ON user_settings
  FOR UPDATE USING (auth.uid() = user_id);

-- Function to create default sections for new users
CREATE OR REPLACE FUNCTION create_default_sections()
RETURNS TRIGGER AS $$
BEGIN
  -- Create Morning section
  INSERT INTO template_sections (user_id, name, icon, color, order_index)
  VALUES (NEW.id, 'Morning', '☀️', '#FFA500', 0);

  -- Create Work section
  INSERT INTO template_sections (user_id, name, icon, color, order_index)
  VALUES (NEW.id, 'Work', '💼', '#4A90D9', 1);

  -- Create Health section
  INSERT INTO template_sections (user_id, name, icon, color, order_index)
  VALUES (NEW.id, 'Health', '💪', '#4CAF50', 2);

  -- Create Personal section
  INSERT INTO template_sections (user_id, name, icon, color, order_index)
  VALUES (NEW.id, 'Personal', '🌟', '#9C27B0', 3);

  -- Create default tasks for Morning
  INSERT INTO template_tasks (section_id, user_id, title, order_index)
  SELECT id, NEW.id, unnest(ARRAY['Wake up early', 'Morning routine', 'Plan the day']), generate_series(0, 2)
  FROM template_sections WHERE user_id = NEW.id AND name = 'Morning';

  -- Create default tasks for Work
  INSERT INTO template_tasks (section_id, user_id, title, order_index)
  SELECT id, NEW.id, unnest(ARRAY['Check emails', 'Priority task', 'Review progress']), generate_series(0, 2)
  FROM template_sections WHERE user_id = NEW.id AND name = 'Work';

  -- Create default tasks for Health
  INSERT INTO template_tasks (section_id, user_id, title, order_index)
  SELECT id, NEW.id, unnest(ARRAY['Exercise', 'Drink water', 'Healthy meals']), generate_series(0, 2)
  FROM template_sections WHERE user_id = NEW.id AND name = 'Health';

  -- Create default tasks for Personal
  INSERT INTO template_tasks (section_id, user_id, title, order_index)
  SELECT id, NEW.id, unnest(ARRAY['Learning time', 'Family time', 'Self-care']), generate_series(0, 2)
  FROM template_sections WHERE user_id = NEW.id AND name = 'Personal';

  -- Create user settings
  INSERT INTO user_settings (user_id) VALUES (NEW.id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create default sections when a new user signs up
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION create_default_sections();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add update triggers
CREATE TRIGGER update_template_sections_updated_at
  BEFORE UPDATE ON template_sections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_daily_entries_updated_at
  BEFORE UPDATE ON daily_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_section_entries_updated_at
  BEFORE UPDATE ON section_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_settings_updated_at
  BEFORE UPDATE ON user_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
