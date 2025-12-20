-- Migration: 007_research_automation
-- Description: Add tables for autonomous AI research automation feature
-- This enables automatic research when tasks are added to specific categories

-- ============================================================================
-- CATEGORY AUTOMATIONS TABLE
-- Defines which categories trigger what type of automation
-- ============================================================================

CREATE TABLE IF NOT EXISTS category_automations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES task_categories(id) ON DELETE CASCADE,

    -- Automation configuration
    automation_type VARCHAR(50) NOT NULL DEFAULT 'research',
    -- Types: 'research', 'summary', 'analysis' (extensible for future)

    llm_model VARCHAR(100) DEFAULT 'z-ai/glm-4.5-air:free',
    research_depth VARCHAR(20) DEFAULT 'medium',
    -- Depth options: 'quick' (2-3 sources), 'medium' (5-8 sources), 'deep' (10+ sources)

    ask_clarification BOOLEAN DEFAULT true,
    notification_enabled BOOLEAN DEFAULT true,
    max_sources INTEGER DEFAULT 10,

    -- Status
    is_active BOOLEAN DEFAULT true,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraints
    CONSTRAINT unique_category_automation UNIQUE (category_id),
    CONSTRAINT valid_automation_type CHECK (automation_type IN ('research', 'summary', 'analysis')),
    CONSTRAINT valid_research_depth CHECK (research_depth IN ('quick', 'medium', 'deep')),
    CONSTRAINT valid_max_sources CHECK (max_sources >= 1 AND max_sources <= 50)
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_category_automations_category ON category_automations(category_id);
CREATE INDEX IF NOT EXISTS idx_category_automations_user ON category_automations(user_id);
CREATE INDEX IF NOT EXISTS idx_category_automations_active ON category_automations(is_active) WHERE is_active = true;

-- ============================================================================
-- RESEARCH JOBS TABLE
-- Tracks the status and data of background research jobs
-- ============================================================================

CREATE TABLE IF NOT EXISTS research_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- References
    task_id UUID NOT NULL REFERENCES todos(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    automation_id UUID REFERENCES category_automations(id) ON DELETE SET NULL,

    -- Job status
    status VARCHAR(30) NOT NULL DEFAULT 'pending',
    -- Status values:
    --   'pending' - Job queued
    --   'understanding' - LLM analyzing task
    --   'awaiting_clarification' - Waiting for user response
    --   'researching' - Performing web research
    --   'synthesizing' - Generating note from research
    --   'completed' - Successfully finished
    --   'failed' - Error occurred
    --   'cancelled' - User or system cancelled

    current_stage INTEGER DEFAULT 1,
    -- Stages: 1=understand, 2=clarify, 3=research, 4=synthesize, 5=notify, 6=complete

    -- BullMQ reference
    bullmq_job_id VARCHAR(100),

    -- Task understanding
    interpreted_topic TEXT,
    focus_areas JSONB DEFAULT '[]',

    -- Clarification
    clarification_question TEXT,
    clarification_response TEXT,
    clarification_sent_at TIMESTAMPTZ,
    clarification_timeout_at TIMESTAMPTZ,

    -- Research data
    search_queries JSONB DEFAULT '[]',
    raw_research_data JSONB DEFAULT '{}',
    sources_used JSONB DEFAULT '[]',

    -- Result
    generated_note_id UUID REFERENCES notes(id) ON DELETE SET NULL,

    -- Error handling
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,

    -- Telegram integration
    telegram_chat_id BIGINT,
    telegram_message_id BIGINT,

    -- Timestamps
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_research_jobs_task ON research_jobs(task_id);
CREATE INDEX IF NOT EXISTS idx_research_jobs_user ON research_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_research_jobs_status ON research_jobs(status);
CREATE INDEX IF NOT EXISTS idx_research_jobs_telegram ON research_jobs(telegram_chat_id);
CREATE INDEX IF NOT EXISTS idx_research_jobs_pending ON research_jobs(status, created_at)
    WHERE status IN ('pending', 'researching', 'awaiting_clarification');

-- ============================================================================
-- TELEGRAM RESEARCH CONVERSATIONS TABLE
-- Tracks active clarification conversations
-- ============================================================================

CREATE TABLE IF NOT EXISTS telegram_research_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- References
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    telegram_chat_id BIGINT NOT NULL,
    research_job_id UUID REFERENCES research_jobs(id) ON DELETE CASCADE,

    -- State
    state VARCHAR(30) DEFAULT 'idle',
    -- States: 'idle', 'awaiting_clarification', 'awaiting_custom_input'

    context JSONB DEFAULT '{}',

    -- Expiration
    expires_at TIMESTAMPTZ,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- One active conversation per chat
    CONSTRAINT unique_active_conversation UNIQUE (telegram_chat_id)
);

CREATE INDEX IF NOT EXISTS idx_telegram_research_chat ON telegram_research_conversations(telegram_chat_id);
CREATE INDEX IF NOT EXISTS idx_telegram_research_job ON telegram_research_conversations(research_job_id);

-- ============================================================================
-- UPDATE NOTES TABLE
-- Add fields for research-generated notes
-- ============================================================================

-- Add research job reference to notes
ALTER TABLE notes
ADD COLUMN IF NOT EXISTS research_job_id UUID REFERENCES research_jobs(id) ON DELETE SET NULL;

-- Add source type to track how note was created
ALTER TABLE notes
ADD COLUMN IF NOT EXISTS source_type VARCHAR(30) DEFAULT 'manual';
-- Source types: 'manual', 'ai_generated', 'research', 'imported'

-- Add sources array for research notes
ALTER TABLE notes
ADD COLUMN IF NOT EXISTS sources JSONB DEFAULT '[]';

-- Index for finding research-generated notes
CREATE INDEX IF NOT EXISTS idx_notes_research_job ON notes(research_job_id) WHERE research_job_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notes_source_type ON notes(source_type);

-- ============================================================================
-- USER RESEARCH QUOTAS TABLE
-- Track daily usage limits
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_research_quotas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Daily counters
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    jobs_today INTEGER DEFAULT 0,
    max_jobs_per_day INTEGER DEFAULT 10,

    -- Usage stats
    total_jobs_all_time INTEGER DEFAULT 0,
    total_sources_fetched INTEGER DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- One quota record per user per day
    CONSTRAINT unique_user_quota_day UNIQUE (user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_user_research_quotas_user_date ON user_research_quotas(user_id, date);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to check if user can start new research job
CREATE OR REPLACE FUNCTION can_start_research_job(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_quota_record user_research_quotas%ROWTYPE;
BEGIN
    -- Get or create today's quota record
    SELECT * INTO v_quota_record
    FROM user_research_quotas
    WHERE user_id = p_user_id AND date = CURRENT_DATE;

    IF NOT FOUND THEN
        -- Create new quota record for today
        INSERT INTO user_research_quotas (user_id, date, jobs_today)
        VALUES (p_user_id, CURRENT_DATE, 0);
        RETURN true;
    END IF;

    RETURN v_quota_record.jobs_today < v_quota_record.max_jobs_per_day;
END;
$$ LANGUAGE plpgsql;

-- Function to increment job counter
CREATE OR REPLACE FUNCTION increment_research_job_count(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
    INSERT INTO user_research_quotas (user_id, date, jobs_today, total_jobs_all_time)
    VALUES (p_user_id, CURRENT_DATE, 1, 1)
    ON CONFLICT (user_id, date)
    DO UPDATE SET
        jobs_today = user_research_quotas.jobs_today + 1,
        total_jobs_all_time = user_research_quotas.total_jobs_all_time + 1,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update updated_at timestamp on category_automations
CREATE OR REPLACE FUNCTION update_category_automations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_category_automations_updated_at
    BEFORE UPDATE ON category_automations
    FOR EACH ROW
    EXECUTE FUNCTION update_category_automations_updated_at();

-- Update updated_at timestamp on research_jobs
CREATE OR REPLACE FUNCTION update_research_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_research_jobs_updated_at
    BEFORE UPDATE ON research_jobs
    FOR EACH ROW
    EXECUTE FUNCTION update_research_jobs_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS on new tables
ALTER TABLE category_automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE research_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE telegram_research_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_research_quotas ENABLE ROW LEVEL SECURITY;

-- Category Automations policies
CREATE POLICY "Users can view own category automations" ON category_automations
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own category automations" ON category_automations
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own category automations" ON category_automations
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own category automations" ON category_automations
    FOR DELETE USING (auth.uid() = user_id);

-- Research Jobs policies
CREATE POLICY "Users can view own research jobs" ON research_jobs
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own research jobs" ON research_jobs
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own research jobs" ON research_jobs
    FOR UPDATE USING (auth.uid() = user_id);

-- Telegram Research Conversations policies
CREATE POLICY "Users can view own telegram conversations" ON telegram_research_conversations
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own telegram conversations" ON telegram_research_conversations
    FOR ALL USING (auth.uid() = user_id);

-- User Research Quotas policies
CREATE POLICY "Users can view own quotas" ON user_research_quotas
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own quotas" ON user_research_quotas
    FOR ALL USING (auth.uid() = user_id);

-- ============================================================================
-- SERVICE ROLE BYPASS
-- For telegram bot backend access
-- ============================================================================

-- These policies allow service_role to bypass RLS for backend operations
CREATE POLICY "Service role full access category_automations" ON category_automations
    FOR ALL USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Service role full access research_jobs" ON research_jobs
    FOR ALL USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Service role full access telegram_conversations" ON telegram_research_conversations
    FOR ALL USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Service role full access user_quotas" ON user_research_quotas
    FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE category_automations IS 'Defines automation rules for task categories (e.g., Research category triggers automatic research)';
COMMENT ON TABLE research_jobs IS 'Tracks background research jobs with status, data, and results';
COMMENT ON TABLE telegram_research_conversations IS 'Manages active clarification conversations via Telegram';
COMMENT ON TABLE user_research_quotas IS 'Tracks daily usage limits for research automation';
COMMENT ON COLUMN notes.research_job_id IS 'Reference to research job that generated this note (if any)';
COMMENT ON COLUMN notes.source_type IS 'How the note was created: manual, ai_generated, research, imported';
COMMENT ON COLUMN notes.sources IS 'Array of source URLs and metadata for research notes';
