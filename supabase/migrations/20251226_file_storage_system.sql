-- =====================================================
-- FILE STORAGE SYSTEM - Complete Database Schema
-- Creates tables for Dropbox-like file storage with
-- 25GB per user, versioning, sharing, and permissions
-- =====================================================

-- 1. FOLDERS TABLE
-- Hierarchical folder structure with multiple folder types
CREATE TABLE IF NOT EXISTS folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  parent_id UUID REFERENCES folders(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  folder_type TEXT NOT NULL DEFAULT 'personal' CHECK (folder_type IN ('personal', 'team', 'repository', 'client')),
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  is_root BOOLEAN NOT NULL DEFAULT false,
  color TEXT,
  icon TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,

  -- Ensure unique folder names within same parent
  UNIQUE(parent_id, name, owner_id)
);

-- 2. FILES TABLE
-- Core file metadata with soft delete, versioning support
CREATE TABLE IF NOT EXISTS files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  original_name TEXT NOT NULL,
  description TEXT,
  folder_id UUID REFERENCES folders(id) ON DELETE SET NULL,
  owner_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  storage_bucket TEXT NOT NULL DEFAULT 'files',
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL DEFAULT 0,
  file_extension TEXT,
  checksum TEXT,
  is_starred BOOLEAN NOT NULL DEFAULT false,
  is_trashed BOOLEAN NOT NULL DEFAULT false,
  trashed_at TIMESTAMPTZ,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  version INTEGER NOT NULL DEFAULT 1,
  current_version_id UUID,
  thumbnail_path TEXT,
  preview_generated BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB NOT NULL DEFAULT '{}',
  tags TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  last_accessed_at TIMESTAMPTZ
);

-- 3. FILE VERSIONS TABLE
-- Complete version history for all files
CREATE TABLE IF NOT EXISTS file_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  storage_path TEXT NOT NULL,
  storage_bucket TEXT NOT NULL DEFAULT 'files',
  size_bytes BIGINT NOT NULL DEFAULT 0,
  checksum TEXT,
  change_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,

  UNIQUE(file_id, version_number)
);

-- 4. FILE SHARES TABLE
-- Sharing via links, email invites, or internal users
CREATE TABLE IF NOT EXISTS file_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID REFERENCES files(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES folders(id) ON DELETE CASCADE,
  share_token UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  share_type TEXT NOT NULL DEFAULT 'link' CHECK (share_type IN ('link', 'email', 'internal')),
  permission TEXT NOT NULL DEFAULT 'view' CHECK (permission IN ('view', 'download', 'edit')),
  password_hash TEXT,
  max_downloads INTEGER,
  download_count INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_accessed_at TIMESTAMPTZ,
  recipient_email TEXT,
  message TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Must share either a file or folder
  CHECK (file_id IS NOT NULL OR folder_id IS NOT NULL)
);

-- 5. FOLDER PERMISSIONS TABLE
-- Granular access control for folders
CREATE TABLE IF NOT EXISTS folder_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id UUID NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  role TEXT,
  permission TEXT NOT NULL DEFAULT 'view' CHECK (permission IN ('view', 'edit', 'admin')),
  inherited BOOLEAN NOT NULL DEFAULT false,
  granted_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,

  UNIQUE(folder_id, user_id)
);

-- 6. STORAGE QUOTAS TABLE
-- 25GB per user storage quota tracking
CREATE TABLE IF NOT EXISTS storage_quotas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES user_profiles(id) ON DELETE CASCADE,
  quota_bytes BIGINT NOT NULL DEFAULT 26843545600, -- 25GB in bytes
  used_bytes BIGINT NOT NULL DEFAULT 0,
  file_count INTEGER NOT NULL DEFAULT 0,
  last_calculated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. FILE ACTIVITY TABLE
-- Audit trail for all file operations
CREATE TABLE IF NOT EXISTS file_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID REFERENCES files(id) ON DELETE SET NULL,
  folder_id UUID REFERENCES folders(id) ON DELETE SET NULL,
  user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}',
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- INDEXES for Performance
-- =====================================================

-- Folders indexes
CREATE INDEX IF NOT EXISTS idx_folders_owner ON folders(owner_id);
CREATE INDEX IF NOT EXISTS idx_folders_parent ON folders(parent_id);
CREATE INDEX IF NOT EXISTS idx_folders_type ON folders(folder_type);
CREATE INDEX IF NOT EXISTS idx_folders_client ON folders(client_id) WHERE client_id IS NOT NULL;

-- Files indexes
CREATE INDEX IF NOT EXISTS idx_files_owner ON files(owner_id);
CREATE INDEX IF NOT EXISTS idx_files_folder ON files(folder_id);
CREATE INDEX IF NOT EXISTS idx_files_starred ON files(owner_id, is_starred) WHERE is_starred = true;
CREATE INDEX IF NOT EXISTS idx_files_trashed ON files(owner_id, is_trashed) WHERE is_trashed = true;
CREATE INDEX IF NOT EXISTS idx_files_client ON files(client_id) WHERE client_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_files_name ON files(name);
CREATE INDEX IF NOT EXISTS idx_files_mime ON files(mime_type);
CREATE INDEX IF NOT EXISTS idx_files_created ON files(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_files_accessed ON files(last_accessed_at DESC NULLS LAST);

-- File versions indexes
CREATE INDEX IF NOT EXISTS idx_file_versions_file ON file_versions(file_id);

-- File shares indexes
CREATE INDEX IF NOT EXISTS idx_file_shares_token ON file_shares(share_token);
CREATE INDEX IF NOT EXISTS idx_file_shares_file ON file_shares(file_id) WHERE file_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_file_shares_folder ON file_shares(folder_id) WHERE folder_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_file_shares_active ON file_shares(is_active) WHERE is_active = true;

-- Folder permissions indexes
CREATE INDEX IF NOT EXISTS idx_folder_permissions_folder ON folder_permissions(folder_id);
CREATE INDEX IF NOT EXISTS idx_folder_permissions_user ON folder_permissions(user_id);

-- Storage quotas indexes
CREATE INDEX IF NOT EXISTS idx_storage_quotas_user ON storage_quotas(user_id);

-- File activity indexes
CREATE INDEX IF NOT EXISTS idx_file_activity_file ON file_activity(file_id) WHERE file_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_file_activity_folder ON file_activity(folder_id) WHERE folder_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_file_activity_user ON file_activity(user_id);
CREATE INDEX IF NOT EXISTS idx_file_activity_created ON file_activity(created_at DESC);

-- =====================================================
-- ROW LEVEL SECURITY POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE files ENABLE ROW LEVEL SECURITY;
ALTER TABLE file_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE file_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE folder_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage_quotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE file_activity ENABLE ROW LEVEL SECURITY;

-- FOLDERS POLICIES
CREATE POLICY "Users can view own folders" ON folders
  FOR SELECT USING (owner_id = auth.uid());

CREATE POLICY "Users can view team/repository folders" ON folders
  FOR SELECT USING (folder_type IN ('team', 'repository'));

CREATE POLICY "Users can view folders they have permission to" ON folders
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM folder_permissions
      WHERE folder_permissions.folder_id = folders.id
      AND folder_permissions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create own folders" ON folders
  FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update own folders" ON folders
  FOR UPDATE USING (owner_id = auth.uid());

CREATE POLICY "Admins can update team folders" ON folders
  FOR UPDATE USING (
    folder_type IN ('team', 'repository')
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Users can delete own folders" ON folders
  FOR DELETE USING (owner_id = auth.uid());

-- FILES POLICIES
CREATE POLICY "Users can view own files" ON files
  FOR SELECT USING (owner_id = auth.uid());

CREATE POLICY "Users can view files in permitted folders" ON files
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM folder_permissions
      WHERE folder_permissions.folder_id = files.folder_id
      AND folder_permissions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create files in own folders" ON files
  FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update own files" ON files
  FOR UPDATE USING (owner_id = auth.uid());

CREATE POLICY "Users can delete own files" ON files
  FOR DELETE USING (owner_id = auth.uid());

-- FILE VERSIONS POLICIES
CREATE POLICY "Users can view versions of own files" ON file_versions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM files WHERE files.id = file_versions.file_id AND files.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can create versions of own files" ON file_versions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM files WHERE files.id = file_versions.file_id AND files.owner_id = auth.uid()
    )
  );

-- FILE SHARES POLICIES
CREATE POLICY "Users can view own shares" ON file_shares
  FOR SELECT USING (created_by = auth.uid());

CREATE POLICY "Anyone can view share by token" ON file_shares
  FOR SELECT USING (is_active = true);

CREATE POLICY "Users can create shares for own files" ON file_shares
  FOR INSERT WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update own shares" ON file_shares
  FOR UPDATE USING (created_by = auth.uid());

CREATE POLICY "Users can delete own shares" ON file_shares
  FOR DELETE USING (created_by = auth.uid());

-- FOLDER PERMISSIONS POLICIES
CREATE POLICY "Users can view permissions for folders they own" ON folder_permissions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM folders WHERE folders.id = folder_permissions.folder_id AND folders.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can view their own permissions" ON folder_permissions
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Folder owners can manage permissions" ON folder_permissions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM folders WHERE folders.id = folder_permissions.folder_id AND folders.owner_id = auth.uid()
    )
  );

-- STORAGE QUOTAS POLICIES
CREATE POLICY "Users can view own quota" ON storage_quotas
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update own quota" ON storage_quotas
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can insert own quota" ON storage_quotas
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- FILE ACTIVITY POLICIES
CREATE POLICY "Users can view activity for own files" ON file_activity
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can create activity records" ON file_activity
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- =====================================================
-- FUNCTIONS AND TRIGGERS
-- =====================================================

-- Function to increment storage usage
CREATE OR REPLACE FUNCTION increment_storage_usage(p_user_id UUID, p_bytes BIGINT)
RETURNS void AS $$
BEGIN
  UPDATE storage_quotas
  SET
    used_bytes = used_bytes + p_bytes,
    file_count = file_count + 1,
    updated_at = NOW()
  WHERE user_id = p_user_id;

  -- Create quota record if doesn't exist
  IF NOT FOUND THEN
    INSERT INTO storage_quotas (user_id, quota_bytes, used_bytes, file_count)
    VALUES (p_user_id, 26843545600, p_bytes, 1);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to decrement storage usage
CREATE OR REPLACE FUNCTION decrement_storage_usage(p_user_id UUID, p_bytes BIGINT)
RETURNS void AS $$
BEGIN
  UPDATE storage_quotas
  SET
    used_bytes = GREATEST(0, used_bytes - p_bytes),
    file_count = GREATEST(0, file_count - 1),
    updated_at = NOW()
  WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to recalculate storage usage
CREATE OR REPLACE FUNCTION recalculate_storage_usage(p_user_id UUID)
RETURNS void AS $$
DECLARE
  v_used_bytes BIGINT;
  v_file_count INTEGER;
BEGIN
  SELECT
    COALESCE(SUM(size_bytes), 0),
    COUNT(*)
  INTO v_used_bytes, v_file_count
  FROM files
  WHERE owner_id = p_user_id AND is_trashed = false;

  UPDATE storage_quotas
  SET
    used_bytes = v_used_bytes,
    file_count = v_file_count,
    last_calculated_at = NOW(),
    updated_at = NOW()
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    INSERT INTO storage_quotas (user_id, quota_bytes, used_bytes, file_count, last_calculated_at)
    VALUES (p_user_id, 26843545600, v_used_bytes, v_file_count, NOW());
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update storage quota on file insert
CREATE OR REPLACE FUNCTION on_file_insert()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM increment_storage_usage(NEW.owner_id, NEW.size_bytes);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER trigger_file_insert
  AFTER INSERT ON files
  FOR EACH ROW
  EXECUTE FUNCTION on_file_insert();

-- Trigger to update storage quota on file delete
CREATE OR REPLACE FUNCTION on_file_delete()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM decrement_storage_usage(OLD.owner_id, OLD.size_bytes);
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER trigger_file_delete
  AFTER DELETE ON files
  FOR EACH ROW
  EXECUTE FUNCTION on_file_delete();

-- Trigger to update storage quota on file size change
CREATE OR REPLACE FUNCTION on_file_update()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.size_bytes != NEW.size_bytes THEN
    UPDATE storage_quotas
    SET
      used_bytes = used_bytes - OLD.size_bytes + NEW.size_bytes,
      updated_at = NOW()
    WHERE user_id = NEW.owner_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER trigger_file_update
  AFTER UPDATE ON files
  FOR EACH ROW
  EXECUTE FUNCTION on_file_update();

-- Function to auto-create storage quota for new users
CREATE OR REPLACE FUNCTION auto_create_storage_quota()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO storage_quotas (user_id, quota_bytes, used_bytes, file_count)
  VALUES (NEW.id, 26843545600, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on user_profiles to auto-create storage quota
DROP TRIGGER IF EXISTS trigger_auto_create_storage_quota ON user_profiles;
CREATE TRIGGER trigger_auto_create_storage_quota
  AFTER INSERT ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_storage_quota();

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER update_folders_updated_at
  BEFORE UPDATE ON folders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_files_updated_at
  BEFORE UPDATE ON files
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- INITIALIZE STORAGE QUOTAS FOR EXISTING USERS
-- =====================================================

-- Create storage quotas for all existing users who don't have one
INSERT INTO storage_quotas (user_id, quota_bytes, used_bytes, file_count)
SELECT id, 26843545600, 0, 0
FROM user_profiles
WHERE id NOT IN (SELECT user_id FROM storage_quotas)
ON CONFLICT (user_id) DO NOTHING;

-- =====================================================
-- REALTIME SUBSCRIPTIONS
-- =====================================================

-- Enable realtime for files and folders
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'files'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE files;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'folders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE folders;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'storage_quotas'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE storage_quotas;
  END IF;
END $$;

-- =====================================================
-- STORAGE BUCKET CONFIGURATION
-- =====================================================

-- Create the 'files' storage bucket for user file uploads
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'files',
  'files',
  false, -- Private bucket - files accessed via signed URLs
  1073741824, -- 1GB max file size per upload
  ARRAY[
    -- Images
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/bmp', 'image/tiff',
    -- Documents
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.oasis.opendocument.text',
    'text/plain', 'text/markdown', 'text/rtf', 'text/csv',
    -- Spreadsheets
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.oasis.opendocument.spreadsheet',
    -- Presentations
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.oasis.opendocument.presentation',
    -- Video
    'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'video/x-msvideo',
    -- Audio
    'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/mp4',
    -- Archives
    'application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed', 'application/gzip', 'application/x-tar',
    -- Code/Data
    'application/json', 'application/xml', 'text/html', 'text/css', 'text/javascript', 'application/javascript'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- =====================================================
-- STORAGE BUCKET POLICIES
-- =====================================================

-- Policy: Users can upload files to their own folder
CREATE POLICY "Users can upload files to own folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'files'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Users can view their own files
CREATE POLICY "Users can view own files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'files'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Users can update their own files
CREATE POLICY "Users can update own files"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'files'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Users can delete their own files
CREATE POLICY "Users can delete own files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'files'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Users can access files shared with them via file_shares
CREATE POLICY "Users can access shared files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'files'
  AND EXISTS (
    SELECT 1 FROM file_shares fs
    JOIN files f ON fs.file_id = f.id
    WHERE f.storage_path = name
    AND fs.is_active = true
    AND (fs.expires_at IS NULL OR fs.expires_at > NOW())
  )
);

-- =====================================================
-- SUMMARY
-- =====================================================
-- File Storage System Migration Complete
-- - 7 database tables created
-- - RLS policies for all tables
-- - Automatic storage quota tracking via triggers
-- - 25GB storage quota per user
-- - Private 'files' storage bucket with 1GB file limit
-- - Support for common file types
-- =====================================================
