-- =====================================================
-- Migration 012: Recurring Time Blocks
-- Adds support for daily recurring time blocks with reminders
-- =====================================================

-- Create the time_blocks table if it doesn't exist
CREATE TABLE IF NOT EXISTS time_blocks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  todo_id UUID REFERENCES todos(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  color VARCHAR(20) DEFAULT '#3b82f6',
  is_recurring BOOLEAN DEFAULT false,
  recurrence_pattern JSONB, -- { frequency, interval, daysOfWeek, endDate, occurrences }
  buffer_minutes INTEGER DEFAULT 0,
  block_type VARCHAR(20) DEFAULT 'task' CHECK (block_type IN ('task', 'focus', 'break', 'meeting', 'personal')),
  energy_level VARCHAR(10) CHECK (energy_level IN ('high', 'medium', 'low')),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add columns for recurring instance management
ALTER TABLE time_blocks ADD COLUMN IF NOT EXISTS parent_block_id UUID REFERENCES time_blocks(id) ON DELETE CASCADE;
ALTER TABLE time_blocks ADD COLUMN IF NOT EXISTS is_template BOOLEAN DEFAULT false;
ALTER TABLE time_blocks ADD COLUMN IF NOT EXISTS instance_date DATE;
ALTER TABLE time_blocks ADD COLUMN IF NOT EXISTS reminder_minutes_before INTEGER DEFAULT 15;
ALTER TABLE time_blocks ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN DEFAULT false;

-- Add comment explaining the recurring block model
COMMENT ON COLUMN time_blocks.is_template IS 'True for recurring pattern templates, false for actual instances';
COMMENT ON COLUMN time_blocks.parent_block_id IS 'Links instance to its recurring template';
COMMENT ON COLUMN time_blocks.instance_date IS 'The specific date this instance is for';
COMMENT ON COLUMN time_blocks.reminder_minutes_before IS 'Minutes before block start to send reminder';

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_time_blocks_user_id ON time_blocks(user_id);
CREATE INDEX IF NOT EXISTS idx_time_blocks_user_date ON time_blocks(user_id, instance_date);
CREATE INDEX IF NOT EXISTS idx_time_blocks_parent ON time_blocks(parent_block_id) WHERE parent_block_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_time_blocks_start_time ON time_blocks(user_id, start_time);
CREATE INDEX IF NOT EXISTS idx_time_blocks_templates ON time_blocks(user_id) WHERE is_template = true;
CREATE INDEX IF NOT EXISTS idx_time_blocks_reminder ON time_blocks(start_time, reminder_sent) WHERE reminder_sent = false;

-- Enable RLS
ALTER TABLE time_blocks ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view own time blocks" ON time_blocks;
CREATE POLICY "Users can view own time blocks"
  ON time_blocks FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own time blocks" ON time_blocks;
CREATE POLICY "Users can insert own time blocks"
  ON time_blocks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own time blocks" ON time_blocks;
CREATE POLICY "Users can update own time blocks"
  ON time_blocks FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own time blocks" ON time_blocks;
CREATE POLICY "Users can delete own time blocks"
  ON time_blocks FOR DELETE
  USING (auth.uid() = user_id);

-- Service role policy for Telegram bot
DROP POLICY IF EXISTS "Service role full access to time blocks" ON time_blocks;
CREATE POLICY "Service role full access to time blocks"
  ON time_blocks FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_time_blocks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS time_blocks_updated_at ON time_blocks;
CREATE TRIGGER time_blocks_updated_at
  BEFORE UPDATE ON time_blocks
  FOR EACH ROW
  EXECUTE FUNCTION update_time_blocks_updated_at();

-- =====================================================
-- Time Block Notification Queue Extension
-- =====================================================

-- Add time_block_id to notification queue if column doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notification_queue' AND column_name = 'time_block_id'
  ) THEN
    ALTER TABLE notification_queue ADD COLUMN time_block_id UUID REFERENCES time_blocks(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Function to schedule time block reminder
CREATE OR REPLACE FUNCTION schedule_time_block_reminder()
RETURNS TRIGGER AS $$
DECLARE
  v_telegram_chat_id BIGINT;
  v_reminder_time TIMESTAMPTZ;
  v_notification_type VARCHAR(50);
BEGIN
  -- Only create reminder for non-template blocks with reminder enabled
  IF NEW.is_template = false AND NEW.reminder_minutes_before > 0 THEN
    -- Get user's telegram chat ID
    SELECT telegram_chat_id INTO v_telegram_chat_id
    FROM user_integrations
    WHERE user_id = NEW.user_id AND telegram_chat_id IS NOT NULL;

    IF v_telegram_chat_id IS NOT NULL THEN
      -- Calculate reminder time
      v_reminder_time := NEW.start_time - (NEW.reminder_minutes_before || ' minutes')::INTERVAL;

      -- Only schedule if reminder time is in the future
      IF v_reminder_time > NOW() THEN
        v_notification_type := 'time_block_reminder';

        -- Insert into notification queue
        INSERT INTO notification_queue (
          user_id,
          telegram_chat_id,
          notification_type,
          time_block_id,
          scheduled_for,
          message_content,
          status
        ) VALUES (
          NEW.user_id,
          v_telegram_chat_id,
          v_notification_type,
          NEW.id,
          v_reminder_time,
          jsonb_build_object(
            'title', NEW.title,
            'start_time', NEW.start_time,
            'end_time', NEW.end_time,
            'block_type', NEW.block_type,
            'minutes_before', NEW.reminder_minutes_before
          ),
          'pending'
        );
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for automatic reminder scheduling
DROP TRIGGER IF EXISTS time_block_reminder_trigger ON time_blocks;
CREATE TRIGGER time_block_reminder_trigger
  AFTER INSERT ON time_blocks
  FOR EACH ROW
  EXECUTE FUNCTION schedule_time_block_reminder();

-- =====================================================
-- Helper function to generate recurring instances
-- Called by application code, not automatically
-- =====================================================

CREATE OR REPLACE FUNCTION generate_recurring_instances(
  p_template_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS INTEGER AS $$
DECLARE
  v_template RECORD;
  v_current_date DATE;
  v_frequency VARCHAR(20);
  v_interval INTEGER;
  v_days_of_week INTEGER[];
  v_start_time TIME;
  v_end_time TIME;
  v_duration INTERVAL;
  v_count INTEGER := 0;
  v_day_of_week INTEGER;
BEGIN
  -- Get template info
  SELECT * INTO v_template
  FROM time_blocks
  WHERE id = p_template_id AND is_template = true;

  IF v_template IS NULL THEN
    RAISE EXCEPTION 'Template not found or not a template: %', p_template_id;
  END IF;

  -- Extract recurrence pattern
  v_frequency := v_template.recurrence_pattern->>'frequency';
  v_interval := COALESCE((v_template.recurrence_pattern->>'interval')::INTEGER, 1);

  -- Extract time components
  v_start_time := v_template.start_time::TIME;
  v_end_time := v_template.end_time::TIME;
  v_duration := v_end_time - v_start_time;

  -- Generate instances based on frequency
  v_current_date := p_start_date;

  WHILE v_current_date <= p_end_date LOOP
    -- Check if instance already exists for this date
    IF NOT EXISTS (
      SELECT 1 FROM time_blocks
      WHERE parent_block_id = p_template_id
      AND instance_date = v_current_date
    ) THEN
      -- For daily frequency, create instance
      IF v_frequency = 'daily' THEN
        INSERT INTO time_blocks (
          user_id,
          todo_id,
          title,
          description,
          start_time,
          end_time,
          color,
          is_recurring,
          buffer_minutes,
          block_type,
          energy_level,
          parent_block_id,
          is_template,
          instance_date,
          reminder_minutes_before
        ) VALUES (
          v_template.user_id,
          v_template.todo_id,
          v_template.title,
          v_template.description,
          v_current_date + v_start_time,
          v_current_date + v_end_time,
          v_template.color,
          false,
          v_template.buffer_minutes,
          v_template.block_type,
          v_template.energy_level,
          p_template_id,
          false,
          v_current_date,
          v_template.reminder_minutes_before
        );

        v_count := v_count + 1;
      END IF;
    END IF;

    -- Move to next interval
    IF v_frequency = 'daily' THEN
      v_current_date := v_current_date + v_interval;
    ELSE
      v_current_date := v_current_date + 1;
    END IF;
  END LOOP;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION generate_recurring_instances(UUID, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION generate_recurring_instances(UUID, DATE, DATE) TO service_role;
