-- =====================================================
-- FIX DUPLICATE FOLDERS - Fix RLS and add uniqueness constraint
-- =====================================================

-- First, delete duplicate "My Files" folders, keeping only the oldest one per user
DELETE FROM folders
WHERE id IN (
    SELECT id FROM (
        SELECT id,
               ROW_NUMBER() OVER (PARTITION BY owner_id, folder_type, is_root ORDER BY created_at ASC) as rn
        FROM folders
        WHERE is_root = true AND folder_type = 'personal'
    ) duplicates
    WHERE rn > 1
);

-- Drop the existing broken policy
DROP POLICY IF EXISTS "Users can view permitted folders" ON folders;

-- Create a fixed policy that allows:
-- 1. Owners to see their own folders
-- 2. Users with explicit permissions to see shared folders
CREATE POLICY "Users can view their own and permitted folders" ON folders
  FOR SELECT USING (
    -- User owns the folder
    owner_id = auth.uid()
    -- OR user has permission to the folder
    OR check_folder_permission(id, auth.uid())
  );

-- Add unique index to prevent duplicate root folders per user per type
-- This ensures only one personal root folder per user
CREATE UNIQUE INDEX IF NOT EXISTS unique_user_root_folder
ON folders (owner_id, folder_type)
WHERE is_root = true;

-- =====================================================
-- SUMMARY
-- =====================================================
-- 1. Deleted duplicate "My Files" folders (kept oldest per user)
-- 2. Fixed RLS policy to allow owners to see their folders
-- 3. Added unique constraint to prevent future duplicates
-- =====================================================
