-- =====================================================
-- ORG SETTINGS TABLE MIGRATION
-- Created: 2026-01-13
-- Description: Creates org_settings table for organization-wide settings
-- including call auto-delete configuration
-- =====================================================

-- =====================================================
-- 1. CREATE ORG_SETTINGS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS org_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  -- Call data auto-delete settings
  call_auto_delete_enabled BOOLEAN DEFAULT false,
  call_delete_after_days INTEGER DEFAULT 30,
  call_delete_on_day TEXT, -- e.g., 'monday', 'sunday', or null for daily
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Ensure only one row exists
  CONSTRAINT single_row CHECK (id = 1)
);

-- =====================================================
-- 2. INSERT DEFAULT ROW
-- =====================================================
INSERT INTO org_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- 3. ROW LEVEL SECURITY
-- =====================================================
ALTER TABLE org_settings ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read settings
CREATE POLICY "Authenticated users can view org settings" ON org_settings
  FOR SELECT TO authenticated USING (true);

-- Only admins can update settings
CREATE POLICY "Admins can update org settings" ON org_settings
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('owner', 'admin'))
  );

-- Service role can manage settings
CREATE POLICY "Service role can manage org settings" ON org_settings
  FOR ALL WITH CHECK (true);

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
