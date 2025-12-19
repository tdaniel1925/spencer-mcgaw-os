-- Migration: Add created_by column to clients table
-- Created: 2025-12-19
-- Description: Adds created_by column to track who created each client

-- Add created_by column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE clients ADD COLUMN created_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create index for created_by lookups
CREATE INDEX IF NOT EXISTS idx_clients_created_by ON clients(created_by);

-- MIGRATION COMPLETE
