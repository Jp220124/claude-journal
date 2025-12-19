-- Telegram Integration Migration
-- Run this SQL in your Supabase SQL Editor
-- Adds support for Telegram bot integration, message history, and notifications

-- =============================================================================
-- 1. USER INTEGRATIONS TABLE
-- Store Telegram (and future platform) user connections
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.user_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform VARCHAR(20) NOT NULL DEFAULT 'telegram',
  platform_chat_id VARCHAR(255) NOT NULL,
  platform_username VARCHAR(255),
  is_verified BOOLEAN DEFAULT FALSE,
  verification_code VARCHAR(6),
  code_expires_at TIMESTAMPTZ,
  notification_enabled BOOLEAN DEFAULT TRUE,
  reminder_minutes_before INTEGER DEFAULT 30,
  daily_summary_enabled BOOLEAN DEFAULT FALSE,
  daily_summary_time TIME DEFAULT '09:00',
  timezone VARCHAR(50) DEFAULT 'UTC',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(platform, platform_chat_id)
);

-- Enable RLS
ALTER TABLE public.user_integrations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_integrations
CREATE POLICY "Users can view own integrations"
  ON public.user_integrations
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own integrations"
  ON public.user_integrations
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own integrations"
  ON public.user_integrations
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own integrations"
  ON public.user_integrations
  FOR DELETE
  USING (auth.uid() = user_id);

-- Service role can access all integrations (for bot service)
CREATE POLICY "Service role can access all integrations"
  ON public.user_integrations
  FOR ALL
  USING (auth.role() = 'service_role');

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_integrations_user_id ON public.user_integrations(user_id);
CREATE INDEX IF NOT EXISTS idx_user_integrations_platform_chat ON public.user_integrations(platform, platform_chat_id);
CREATE INDEX IF NOT EXISTS idx_user_integrations_verification ON public.user_integrations(verification_code) WHERE is_verified = FALSE;

-- =============================================================================
-- 2. MESSAGE HISTORY TABLE
-- Store conversation history for AI context
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.message_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  integration_id UUID REFERENCES public.user_integrations(id) ON DELETE CASCADE,
  direction VARCHAR(10) NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  message_type VARCHAR(20) NOT NULL CHECK (message_type IN ('text', 'voice', 'command')),
  original_content TEXT,
  transcription TEXT, -- For voice messages
  ai_intent VARCHAR(50),
  ai_response TEXT,
  processing_time_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.message_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for message_history
CREATE POLICY "Users can view own message history"
  ON public.message_history
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can access all message history"
  ON public.message_history
  FOR ALL
  USING (auth.role() = 'service_role');

-- Index for recent messages
CREATE INDEX IF NOT EXISTS idx_message_history_user_created
  ON public.message_history(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_message_history_integration
  ON public.message_history(integration_id, created_at DESC);

-- =============================================================================
-- 3. NOTIFICATION QUEUE TABLE
-- Queue for scheduled notifications
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.notification_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  integration_id UUID NOT NULL REFERENCES public.user_integrations(id) ON DELETE CASCADE,
  todo_id UUID REFERENCES public.todos(id) ON DELETE CASCADE,
  notification_type VARCHAR(50) NOT NULL CHECK (notification_type IN ('due_reminder', 'daily_summary', 'custom')),
  message_content TEXT,
  scheduled_for TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.notification_queue ENABLE ROW LEVEL SECURITY;

-- RLS Policies for notification_queue
CREATE POLICY "Users can view own notifications"
  ON public.notification_queue
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can access all notifications"
  ON public.notification_queue
  FOR ALL
  USING (auth.role() = 'service_role');

-- Index for pending notifications
CREATE INDEX IF NOT EXISTS idx_notification_queue_pending
  ON public.notification_queue(scheduled_for)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_notification_queue_user
  ON public.notification_queue(user_id, status);

-- =============================================================================
-- 4. ADD REMINDER_SENT TO TODOS
-- Track if reminder has been sent for a task
-- =============================================================================

ALTER TABLE public.todos ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN DEFAULT FALSE;

-- Index for finding todos needing reminders
CREATE INDEX IF NOT EXISTS idx_todos_reminder
  ON public.todos(user_id, due_date, due_time)
  WHERE reminder_sent = FALSE AND completed = FALSE;

-- =============================================================================
-- 5. UPDATED_AT TRIGGERS
-- =============================================================================

-- Trigger for user_integrations
CREATE TRIGGER update_user_integrations_updated_at
  BEFORE UPDATE ON public.user_integrations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- 6. HELPER FUNCTIONS
-- =============================================================================

-- Function to generate a random 6-digit verification code
CREATE OR REPLACE FUNCTION generate_verification_code()
RETURNS TEXT AS $$
BEGIN
  RETURN LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

-- Function to create/update integration with verification code
CREATE OR REPLACE FUNCTION create_telegram_verification(p_user_id UUID)
RETURNS TABLE (verification_code TEXT, expires_at TIMESTAMPTZ) AS $$
DECLARE
  v_code TEXT;
  v_expires TIMESTAMPTZ;
BEGIN
  v_code := generate_verification_code();
  v_expires := NOW() + INTERVAL '10 minutes';

  -- Upsert the integration record
  INSERT INTO public.user_integrations (user_id, platform, platform_chat_id, verification_code, code_expires_at, is_verified)
  VALUES (p_user_id, 'telegram', 'pending', v_code, v_expires, FALSE)
  ON CONFLICT (platform, platform_chat_id)
  DO UPDATE SET
    verification_code = v_code,
    code_expires_at = v_expires,
    is_verified = FALSE;

  RETURN QUERY SELECT v_code, v_expires;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to verify Telegram chat (called by bot service)
CREATE OR REPLACE FUNCTION verify_telegram_chat(p_verification_code TEXT, p_chat_id TEXT, p_username TEXT DEFAULT NULL)
RETURNS TABLE (success BOOLEAN, user_id UUID, message TEXT) AS $$
DECLARE
  v_integration RECORD;
BEGIN
  -- Find the integration with this code
  SELECT * INTO v_integration
  FROM public.user_integrations
  WHERE verification_code = p_verification_code
    AND is_verified = FALSE
    AND code_expires_at > NOW()
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, 'Invalid or expired verification code'::TEXT;
    RETURN;
  END IF;

  -- Update the integration
  UPDATE public.user_integrations
  SET
    platform_chat_id = p_chat_id,
    platform_username = p_username,
    is_verified = TRUE,
    verification_code = NULL,
    code_expires_at = NULL,
    updated_at = NOW()
  WHERE id = v_integration.id;

  RETURN QUERY SELECT TRUE, v_integration.user_id, 'Successfully linked!'::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get pending notifications
CREATE OR REPLACE FUNCTION get_pending_notifications(p_limit INTEGER DEFAULT 50)
RETURNS TABLE (
  notification_id UUID,
  user_id UUID,
  chat_id TEXT,
  notification_type VARCHAR(50),
  message_content TEXT,
  todo_title TEXT,
  scheduled_for TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    nq.id AS notification_id,
    nq.user_id,
    ui.platform_chat_id AS chat_id,
    nq.notification_type,
    nq.message_content,
    t.title AS todo_title,
    nq.scheduled_for
  FROM public.notification_queue nq
  JOIN public.user_integrations ui ON nq.integration_id = ui.id
  LEFT JOIN public.todos t ON nq.todo_id = t.id
  WHERE nq.status = 'pending'
    AND nq.scheduled_for <= NOW()
    AND ui.is_verified = TRUE
    AND ui.notification_enabled = TRUE
  ORDER BY nq.scheduled_for ASC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark notification as sent
CREATE OR REPLACE FUNCTION mark_notification_sent(p_notification_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.notification_queue
  SET
    status = 'sent',
    sent_at = NOW()
  WHERE id = p_notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark notification as failed
CREATE OR REPLACE FUNCTION mark_notification_failed(p_notification_id UUID, p_error TEXT)
RETURNS VOID AS $$
DECLARE
  v_retry_count INTEGER;
  v_max_retries INTEGER;
BEGIN
  SELECT retry_count, max_retries INTO v_retry_count, v_max_retries
  FROM public.notification_queue
  WHERE id = p_notification_id;

  IF v_retry_count >= v_max_retries THEN
    UPDATE public.notification_queue
    SET
      status = 'failed',
      error_message = p_error,
      retry_count = retry_count + 1
    WHERE id = p_notification_id;
  ELSE
    -- Reschedule for 5 minutes later
    UPDATE public.notification_queue
    SET
      scheduled_for = NOW() + INTERVAL '5 minutes',
      error_message = p_error,
      retry_count = retry_count + 1
    WHERE id = p_notification_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 7. SCHEDULE REMINDER TRIGGER
-- Auto-create notification when todo with due_time is created/updated
-- =============================================================================

CREATE OR REPLACE FUNCTION schedule_todo_reminder()
RETURNS TRIGGER AS $$
DECLARE
  v_integration RECORD;
  v_scheduled_time TIMESTAMPTZ;
  v_reminder_minutes INTEGER;
BEGIN
  -- Only process if task has due_date and due_time and is not completed
  IF NEW.due_date IS NOT NULL AND NEW.due_time IS NOT NULL AND NEW.completed = FALSE THEN
    -- Find user's Telegram integration
    SELECT * INTO v_integration
    FROM public.user_integrations
    WHERE user_id = NEW.user_id
      AND platform = 'telegram'
      AND is_verified = TRUE
      AND notification_enabled = TRUE
    LIMIT 1;

    IF FOUND THEN
      v_reminder_minutes := COALESCE(v_integration.reminder_minutes_before, 30);
      v_scheduled_time := (NEW.due_date + NEW.due_time) - (v_reminder_minutes || ' minutes')::INTERVAL;

      -- Only schedule if the reminder time is in the future
      IF v_scheduled_time > NOW() THEN
        -- Remove existing pending reminder for this todo
        DELETE FROM public.notification_queue
        WHERE todo_id = NEW.id AND status = 'pending' AND notification_type = 'due_reminder';

        -- Insert new reminder
        INSERT INTO public.notification_queue (
          user_id,
          integration_id,
          todo_id,
          notification_type,
          scheduled_for
        ) VALUES (
          NEW.user_id,
          v_integration.id,
          NEW.id,
          'due_reminder',
          v_scheduled_time
        );
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for todo reminder scheduling
DROP TRIGGER IF EXISTS schedule_todo_reminder_trigger ON public.todos;
CREATE TRIGGER schedule_todo_reminder_trigger
  AFTER INSERT OR UPDATE OF due_date, due_time, completed ON public.todos
  FOR EACH ROW
  EXECUTE FUNCTION schedule_todo_reminder();

-- =============================================================================
-- Grant permissions to service role for bot operations
-- =============================================================================

GRANT EXECUTE ON FUNCTION verify_telegram_chat TO service_role;
GRANT EXECUTE ON FUNCTION get_pending_notifications TO service_role;
GRANT EXECUTE ON FUNCTION mark_notification_sent TO service_role;
GRANT EXECUTE ON FUNCTION mark_notification_failed TO service_role;
