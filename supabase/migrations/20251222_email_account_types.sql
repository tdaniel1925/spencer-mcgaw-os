-- Email Account Types Migration
-- Adds is_global flag to email_connections for distinguishing global vs personal accounts

-- Add is_global column to email_connections
ALTER TABLE email_connections
ADD COLUMN IF NOT EXISTS is_global BOOLEAN DEFAULT false;

-- Add display_order for sorting global accounts
ALTER TABLE email_connections
ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;

-- Add description for global accounts
ALTER TABLE email_connections
ADD COLUMN IF NOT EXISTS description TEXT;

-- Create index for is_global lookups
CREATE INDEX IF NOT EXISTS idx_email_connections_is_global ON email_connections(is_global);

-- Update RLS policies to allow viewing global email classifications
-- Users can see their own email classifications OR classifications from global accounts
DROP POLICY IF EXISTS "Users can view own email classifications" ON email_classifications;

CREATE POLICY "Users can view email classifications"
    ON email_classifications FOR SELECT
    TO authenticated
    USING (
        -- User owns the account
        account_id IN (
            SELECT id FROM email_connections WHERE user_id = auth.uid()
        )
        OR
        -- OR it's a global account
        account_id IN (
            SELECT id FROM email_connections WHERE is_global = true
        )
    );

-- Allow admins to update email_connections to global
-- (Regular RLS already allows owners to update their own connections)
-- We need a separate policy for admins

-- Create a function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM user_profiles
        WHERE id = auth.uid() AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add policy for admins to update any email connection's global status
CREATE POLICY "Admins can update email connection global status"
    ON email_connections FOR UPDATE
    TO authenticated
    USING (
        auth.uid() = user_id  -- Owner
        OR is_admin()          -- Admin
    )
    WITH CHECK (
        auth.uid() = user_id  -- Owner
        OR is_admin()          -- Admin
    );

-- Add comments
COMMENT ON COLUMN email_connections.is_global IS 'If true, this email account is visible to all org members';
COMMENT ON COLUMN email_connections.display_order IS 'Order for displaying global accounts';
COMMENT ON COLUMN email_connections.description IS 'Optional description for the email account (e.g., "Main Office Inbox")';
