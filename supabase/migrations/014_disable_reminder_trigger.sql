-- =====================================================
-- Migration 014: Disable Reminder Trigger Temporarily
-- Drops the problematic trigger that references missing columns
-- The trigger was causing "column telegram_chat_id does not exist" error
-- =====================================================

-- Drop the problematic trigger
DROP TRIGGER IF EXISTS time_block_reminder_trigger ON time_blocks;

-- Drop the function too since it references missing tables
DROP FUNCTION IF EXISTS schedule_time_block_reminder();

-- Note: When ready to enable Telegram notifications:
-- 1. First apply migration 013_fix_reminder_trigger.sql to create user_integrations table
-- 2. Then recreate the trigger function and trigger
