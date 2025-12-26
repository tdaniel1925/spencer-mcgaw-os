-- Migration: Fix Database Issues
-- Created: 2025-12-26
-- Description: Fixes FK relationships, RLS recursion, and missing columns

-- ============================================================================
-- 1. FIX CHAT_ROOM_MEMBERS RLS INFINITE RECURSION
-- ============================================================================
-- The current "View room members" policy has a self-referential check that
-- causes infinite recursion. We fix this by using a simpler approach.

-- Drop the problematic policies
DROP POLICY IF EXISTS "View room members" ON chat_room_members;
DROP POLICY IF EXISTS "Admin manage members" ON chat_room_members;
DROP POLICY IF EXISTS "Manage own membership" ON chat_room_members;

-- Create fixed policies that avoid recursion
-- Use a security definer function to check membership without triggering RLS

CREATE OR REPLACE FUNCTION is_room_member(p_room_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM chat_room_members
    WHERE room_id = p_room_id AND user_id = p_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_room_admin(p_room_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM chat_room_members
    WHERE room_id = p_room_id AND user_id = p_user_id AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Fixed "View room members" - uses security definer function instead of subquery
CREATE POLICY "View room members" ON chat_room_members
  FOR SELECT USING (
    -- Can see members if room is community or user is a member (checked via function)
    EXISTS (
      SELECT 1 FROM chat_rooms r
      WHERE r.id = room_id
      AND (r.type = 'community' OR is_room_member(r.id, auth.uid()))
    )
  );

-- Users can manage their own membership
CREATE POLICY "Manage own membership" ON chat_room_members
  FOR ALL USING (user_id = auth.uid());

-- Admins can manage all members in their rooms (checked via function)
CREATE POLICY "Admin manage members" ON chat_room_members
  FOR ALL USING (is_room_admin(room_id, auth.uid()));

-- ============================================================================
-- 2. ADD MISSING EMAIL_CLASSIFICATIONS COLUMNS
-- ============================================================================

-- Check if table exists before adding columns
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'email_classifications'
  ) THEN
    -- Add email_id column if it doesn't exist
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'email_classifications' AND column_name = 'email_id'
    ) THEN
      ALTER TABLE email_classifications ADD COLUMN email_id TEXT;
      CREATE INDEX IF NOT EXISTS idx_email_classifications_email_id ON email_classifications(email_id);
    END IF;

    -- Add from_name column if it doesn't exist
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'email_classifications' AND column_name = 'from_name'
    ) THEN
      ALTER TABLE email_classifications ADD COLUMN from_name TEXT;
    END IF;

    -- Add from_email column if it doesn't exist
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'email_classifications' AND column_name = 'from_email'
    ) THEN
      ALTER TABLE email_classifications ADD COLUMN from_email TEXT;
    END IF;
  END IF;
END $$;

-- ============================================================================
-- 2b. FIX CHAT_ROOMS RLS RECURSION
-- ============================================================================

-- Drop problematic chat_rooms policies
DROP POLICY IF EXISTS "View member rooms" ON chat_rooms;

-- Create fixed policy using security definer function
CREATE POLICY "View member rooms" ON chat_rooms
  FOR SELECT USING (
    type = 'community' OR is_room_member(id, auth.uid())
  );

-- ============================================================================
-- 3. ENSURE TASKS FOREIGN KEY TO CLIENTS EXISTS
-- ============================================================================

-- The FK might exist but Supabase's schema cache needs refresh
-- This is a no-op if FK already exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'tasks_client_id_fkey'
    AND table_name = 'tasks'
  ) THEN
    -- Only add if the constraint doesn't exist
    ALTER TABLE tasks
      ADD CONSTRAINT tasks_client_id_fkey
      FOREIGN KEY (client_id)
      REFERENCES clients(id)
      ON DELETE SET NULL;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN
    -- Constraint already exists, ignore
    NULL;
END $$;

-- ============================================================================
-- 4. REFRESH SUPABASE SCHEMA CACHE
-- ============================================================================

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
