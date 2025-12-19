-- Calendar Tables Migration
-- Creates calendar_connections and calendar_events tables for multi-provider calendar integration

-- Calendar Connections Table (stores OAuth tokens for Google, Microsoft, etc.)
CREATE TABLE IF NOT EXISTS calendar_connections (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL CHECK (provider IN ('google', 'microsoft', 'apple')),
    email TEXT NOT NULL,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    expires_at TIMESTAMPTZ,
    calendar_id TEXT, -- Primary calendar ID from provider
    sync_enabled BOOLEAN DEFAULT true,
    last_sync_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Unique constraint: one connection per provider per user
    UNIQUE(user_id, provider)
);

-- Calendar Events Table (local events + synced events)
CREATE TABLE IF NOT EXISTS calendar_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    connection_id UUID REFERENCES calendar_connections(id) ON DELETE SET NULL,
    provider TEXT NOT NULL DEFAULT 'local' CHECK (provider IN ('local', 'google', 'microsoft', 'apple')),
    external_id TEXT, -- ID from external calendar (Google/Microsoft event ID)

    -- Event details
    title TEXT NOT NULL,
    description TEXT,
    location TEXT,
    meeting_link TEXT,

    -- Time
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    all_day BOOLEAN DEFAULT false,
    timezone TEXT DEFAULT 'America/Chicago',

    -- Recurrence (for recurring events)
    is_recurring BOOLEAN DEFAULT false,
    recurrence_rule TEXT, -- RRULE format
    recurrence_end TIMESTAMPTZ,
    parent_event_id UUID REFERENCES calendar_events(id) ON DELETE CASCADE,

    -- Categorization
    category TEXT DEFAULT 'other' CHECK (category IN (
        'client_meeting', 'internal_meeting', 'deadline', 'reminder',
        'follow_up', 'consultation', 'document_review', 'tax_filing',
        'phone_call', 'personal', 'other'
    )),
    color TEXT DEFAULT '#3b82f6',

    -- Status
    status TEXT DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'tentative', 'cancelled')),
    visibility TEXT DEFAULT 'default' CHECK (visibility IN ('default', 'public', 'private', 'confidential')),

    -- Attendees (stored as JSONB array)
    attendees JSONB DEFAULT '[]'::jsonb,

    -- Reminders (stored as JSONB array of {minutes, method})
    reminders JSONB DEFAULT '[{"minutes": 30, "method": "popup"}]'::jsonb,

    -- Client/Contact association
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    contact_id UUID REFERENCES client_contacts(id) ON DELETE SET NULL,

    -- Sync metadata
    etag TEXT, -- For detecting changes from provider
    synced_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_calendar_connections_user ON calendar_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_connections_provider ON calendar_connections(provider);
CREATE INDEX IF NOT EXISTS idx_calendar_events_user ON calendar_events(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_start ON calendar_events(start_time);
CREATE INDEX IF NOT EXISTS idx_calendar_events_end ON calendar_events(end_time);
CREATE INDEX IF NOT EXISTS idx_calendar_events_provider ON calendar_events(provider);
CREATE INDEX IF NOT EXISTS idx_calendar_events_client ON calendar_events(client_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_category ON calendar_events(category);
CREATE INDEX IF NOT EXISTS idx_calendar_events_date_range ON calendar_events(start_time, end_time);

-- RLS Policies for calendar_connections
ALTER TABLE calendar_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own calendar connections"
    ON calendar_connections FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own calendar connections"
    ON calendar_connections FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own calendar connections"
    ON calendar_connections FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own calendar connections"
    ON calendar_connections FOR DELETE
    USING (auth.uid() = user_id);

-- RLS Policies for calendar_events
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own calendar events"
    ON calendar_events FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own calendar events"
    ON calendar_events FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own calendar events"
    ON calendar_events FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own calendar events"
    ON calendar_events FOR DELETE
    USING (auth.uid() = user_id);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_calendar_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER calendar_connections_updated_at
    BEFORE UPDATE ON calendar_connections
    FOR EACH ROW
    EXECUTE FUNCTION update_calendar_updated_at();

CREATE TRIGGER calendar_events_updated_at
    BEFORE UPDATE ON calendar_events
    FOR EACH ROW
    EXECUTE FUNCTION update_calendar_updated_at();

-- Add helpful comments
COMMENT ON TABLE calendar_connections IS 'OAuth connections to external calendar providers (Google, Microsoft, Apple)';
COMMENT ON TABLE calendar_events IS 'Calendar events - both local and synced from external providers';
COMMENT ON COLUMN calendar_events.external_id IS 'The event ID from Google/Microsoft for sync purposes';
COMMENT ON COLUMN calendar_events.etag IS 'ETag for detecting remote changes during sync';
