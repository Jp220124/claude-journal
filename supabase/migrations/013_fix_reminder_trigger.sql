-- =====================================================
-- Migration 013: Fix Reminder Trigger
-- Makes the reminder trigger gracefully handle missing tables
-- =====================================================

-- Drop the problematic trigger first
DROP TRIGGER IF EXISTS time_block_reminder_trigger ON time_blocks;

-- Create user_integrations table if it doesn't exist
CREATE TABLE IF NOT EXISTS user_integrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  telegram_chat_id BIGINT,
  telegram_username VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Enable RLS on user_integrations
ALTER TABLE user_integrations ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_integrations
DROP POLICY IF EXISTS "Users can view own integrations" ON user_integrations;
CREATE POLICY "Users can view own integrations"
  ON user_integrations FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own integrations" ON user_integrations;
CREATE POLICY "Users can insert own integrations"
  ON user_integrations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own integrations" ON user_integrations;
CREATE POLICY "Users can update own integrations"
  ON user_integrations FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role full access to integrations" ON user_integrations;
CREATE POLICY "Service role full access to integrations"
  ON user_integrations FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Create notification_queue table if it doesn't exist
CREATE TABLE IF NOT EXISTS notification_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  telegram_chat_id BIGINT,
  notification_type VARCHAR(50) NOT NULL,
  time_block_id UUID REFERENCES time_blocks(id) ON DELETE CASCADE,
  scheduled_for TIMESTAMPTZ NOT NULL,
  message_content JSONB,
  status VARCHAR(20) DEFAULT 'pending',
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on notification_queue
ALTER TABLE notification_queue ENABLE ROW LEVEL SECURITY;

-- RLS policies for notification_queue
DROP POLICY IF EXISTS "Service role full access to notifications" ON notification_queue;
CREATE POLICY "Service role full access to notifications"
  ON notification_queue FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Recreate the reminder trigger function with error handling
CREATE OR REPLACE FUNCTION schedule_time_block_reminder()
RETURNS TRIGGER AS $$
DECLARE
  v_telegram_chat_id BIGINT;
  v_reminder_time TIMESTAMPTZ;
  v_notification_type VARCHAR(50);
BEGIN
  -- Silently return if reminder_minutes_before is null or 0
  IF NEW.reminder_minutes_before IS NULL OR NEW.reminder_minutes_before <= 0 THEN
    RETURN NEW;
  END IF;

  -- Only create reminder for non-template blocks with reminder enabled
  IF (NEW.is_template IS NULL OR NEW.is_template = false) AND NEW.reminder_minutes_before > 0 THEN
    BEGIN
      -- Get user's telegram chat ID (with exception handling)
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
    EXCEPTION
      WHEN undefined_table THEN
        -- Tables don't exist yet, silently continue
        NULL;
      WHEN undefined_column THEN
        -- Column doesn't exist, silently continue
        NULL;
      WHEN OTHERS THEN
        -- Log but don't fail the insert
        RAISE WARNING 'Failed to schedule reminder: %', SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
CREATE TRIGGER time_block_reminder_trigger
  AFTER INSERT ON time_blocks
  FOR EACH ROW
  EXECUTE FUNCTION schedule_time_block_reminder();
