-- =====================================================
-- ADD EMAIL BODY COLUMNS
-- Created: 2026-01-13
-- Description: Adds body_text and body_preview columns
-- to email_classifications for full email display
-- =====================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'email_classifications') THEN
    -- Add body_text column for full email body (plaintext)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'email_classifications' AND column_name = 'body_text') THEN
      ALTER TABLE email_classifications ADD COLUMN body_text TEXT;
    END IF;

    -- Add body_preview column for truncated preview
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'email_classifications' AND column_name = 'body_preview') THEN
      ALTER TABLE email_classifications ADD COLUMN body_preview TEXT;
    END IF;

    -- Add body_html column for HTML body (optional)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'email_classifications' AND column_name = 'body_html') THEN
      ALTER TABLE email_classifications ADD COLUMN body_html TEXT;
    END IF;
  END IF;
END $$;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
