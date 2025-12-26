-- =====================================================
-- FIX RLS RECURSION - Remove circular policy dependencies
-- =====================================================

-- Drop the problematic policies that cause recursion
DROP POLICY IF EXISTS "Users can view folders they have permission to" ON folders;
DROP POLICY IF EXISTS "Users can view permissions for folders they own" ON folder_permissions;
DROP POLICY IF EXISTS "Folder owners can manage permissions" ON folder_permissions;
DROP POLICY IF EXISTS "Users can view files in permitted folders" ON files;

-- Recreate folder_permissions policies WITHOUT referencing folders table
-- Instead, use a SECURITY DEFINER function to check ownership

-- Function to check if user owns a folder (bypasses RLS)
CREATE OR REPLACE FUNCTION check_folder_ownership(p_folder_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_owner_id UUID;
BEGIN
  SELECT owner_id INTO v_owner_id FROM folders WHERE id = p_folder_id;
  RETURN v_owner_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user has permission to a folder (bypasses RLS)
CREATE OR REPLACE FUNCTION check_folder_permission(p_folder_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM folder_permissions
    WHERE folder_id = p_folder_id AND user_id = p_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- FOLDER PERMISSIONS POLICIES (fixed - no recursion)
-- Users can view their own permission records directly
CREATE POLICY "Users can view their own permissions" ON folder_permissions
  FOR SELECT USING (user_id = auth.uid());

-- Folder owners can view all permissions for their folders (using function)
CREATE POLICY "Folder owners can view folder permissions" ON folder_permissions
  FOR SELECT USING (check_folder_ownership(folder_id, auth.uid()));

-- Folder owners can insert permissions
CREATE POLICY "Folder owners can insert permissions" ON folder_permissions
  FOR INSERT WITH CHECK (check_folder_ownership(folder_id, auth.uid()));

-- Folder owners can update permissions
CREATE POLICY "Folder owners can update permissions" ON folder_permissions
  FOR UPDATE USING (check_folder_ownership(folder_id, auth.uid()));

-- Folder owners can delete permissions
CREATE POLICY "Folder owners can delete permissions" ON folder_permissions
  FOR DELETE USING (check_folder_ownership(folder_id, auth.uid()));

-- FOLDERS POLICIES (fixed - use function instead of subquery)
-- Users can view folders they have explicit permission to
CREATE POLICY "Users can view permitted folders" ON folders
  FOR SELECT USING (check_folder_permission(id, auth.uid()));

-- FILES POLICIES (fixed - use function)
-- Users can view files in folders they have permission to
CREATE POLICY "Users can view permitted files" ON files
  FOR SELECT USING (
    folder_id IS NULL OR check_folder_permission(folder_id, auth.uid())
  );

-- =====================================================
-- SUMMARY
-- =====================================================
-- Fixed infinite recursion in RLS policies by:
-- 1. Using SECURITY DEFINER functions to break circular dependencies
-- 2. Simplified permission checks
-- =====================================================
