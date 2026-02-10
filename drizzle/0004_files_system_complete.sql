-- Files System Complete Migration
-- Creates all tables and functions needed for the files feature

-- ============================================================================
-- ENUMS
-- ============================================================================

-- Create enums if they don't exist
DO $$ BEGIN
  CREATE TYPE folder_type AS ENUM ('personal', 'team', 'shared', 'repository', 'client');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE share_type AS ENUM ('link', 'email', 'user');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE share_permission AS ENUM ('view', 'download', 'edit', 'comment');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE permission_level AS ENUM ('view', 'edit', 'admin', 'owner');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- TABLES
-- ============================================================================

-- Folders table
CREATE TABLE IF NOT EXISTS "folders" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" VARCHAR(255) NOT NULL,
  "slug" VARCHAR(255) NOT NULL,
  "description" TEXT,
  "parent_id" UUID,
  "owner_id" UUID REFERENCES "users"("id"),
  "folder_type" folder_type NOT NULL DEFAULT 'personal',
  "client_id" UUID REFERENCES "clients"("id"),
  "is_root" BOOLEAN NOT NULL DEFAULT false,
  "color" VARCHAR(20),
  "icon" VARCHAR(50),
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "created_by" UUID REFERENCES "users"("id")
);

-- Files table
CREATE TABLE IF NOT EXISTS "files" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" VARCHAR(500) NOT NULL,
  "original_name" VARCHAR(500) NOT NULL,
  "description" TEXT,
  "folder_id" UUID REFERENCES "folders"("id") ON DELETE CASCADE,
  "owner_id" UUID REFERENCES "users"("id"),
  "storage_path" TEXT NOT NULL,
  "storage_bucket" VARCHAR(100) NOT NULL DEFAULT 'files',
  "mime_type" VARCHAR(100) NOT NULL,
  "size_bytes" INTEGER NOT NULL,
  "file_extension" VARCHAR(20),
  "checksum" VARCHAR(64),
  "is_starred" BOOLEAN NOT NULL DEFAULT false,
  "is_trashed" BOOLEAN NOT NULL DEFAULT false,
  "trashed_at" TIMESTAMP,
  "client_id" UUID REFERENCES "clients"("id"),
  "version" INTEGER NOT NULL DEFAULT 1,
  "current_version_id" UUID,
  "thumbnail_path" TEXT,
  "preview_generated" BOOLEAN NOT NULL DEFAULT false,
  "metadata" JSONB DEFAULT '{}'::jsonb,
  "tags" JSONB DEFAULT '[]'::jsonb,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "created_by" UUID REFERENCES "users"("id"),
  "last_accessed_at" TIMESTAMP
);

-- File Versions table
CREATE TABLE IF NOT EXISTS "file_versions" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "file_id" UUID REFERENCES "files"("id") ON DELETE CASCADE NOT NULL,
  "version_number" INTEGER NOT NULL,
  "storage_path" TEXT NOT NULL,
  "storage_bucket" VARCHAR(100) NOT NULL,
  "size_bytes" INTEGER NOT NULL,
  "checksum" VARCHAR(64),
  "change_summary" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "created_by" UUID REFERENCES "users"("id")
);

-- File Shares table
CREATE TABLE IF NOT EXISTS "file_shares" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "file_id" UUID REFERENCES "files"("id") ON DELETE CASCADE,
  "folder_id" UUID REFERENCES "folders"("id") ON DELETE CASCADE,
  "share_token" VARCHAR(255) NOT NULL UNIQUE,
  "share_type" share_type NOT NULL DEFAULT 'link',
  "permission" share_permission NOT NULL DEFAULT 'view',
  "password_hash" TEXT,
  "max_downloads" INTEGER,
  "download_count" INTEGER NOT NULL DEFAULT 0,
  "expires_at" TIMESTAMP,
  "created_by" UUID REFERENCES "users"("id"),
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "last_accessed_at" TIMESTAMP,
  "recipient_email" VARCHAR(255),
  "message" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true
);

-- Folder Permissions table
CREATE TABLE IF NOT EXISTS "folder_permissions" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "folder_id" UUID REFERENCES "folders"("id") ON DELETE CASCADE NOT NULL,
  "user_id" UUID REFERENCES "users"("id") ON DELETE CASCADE,
  "role" VARCHAR(50),
  "permission" permission_level NOT NULL DEFAULT 'view',
  "inherited" BOOLEAN NOT NULL DEFAULT false,
  "granted_by" UUID REFERENCES "users"("id"),
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "expires_at" TIMESTAMP
);

-- Storage Quotas table
CREATE TABLE IF NOT EXISTS "storage_quotas" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID REFERENCES "users"("id") ON DELETE CASCADE NOT NULL UNIQUE,
  "quota_bytes" BIGINT NOT NULL DEFAULT 26843545600, -- 25 GB default
  "used_bytes" BIGINT NOT NULL DEFAULT 0,
  "file_count" INTEGER NOT NULL DEFAULT 0,
  "last_calculated_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- File Activity table
CREATE TABLE IF NOT EXISTS "file_activity" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "file_id" UUID REFERENCES "files"("id") ON DELETE CASCADE,
  "folder_id" UUID REFERENCES "folders"("id") ON DELETE CASCADE,
  "user_id" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "action" VARCHAR(50) NOT NULL,
  "details" JSONB DEFAULT '{}'::jsonb,
  "ip_address" VARCHAR(45),
  "user_agent" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Folders indexes
CREATE INDEX IF NOT EXISTS "idx_folders_owner_id" ON "folders"("owner_id");
CREATE INDEX IF NOT EXISTS "idx_folders_parent_id" ON "folders"("parent_id");
CREATE INDEX IF NOT EXISTS "idx_folders_client_id" ON "folders"("client_id");
CREATE INDEX IF NOT EXISTS "idx_folders_folder_type" ON "folders"("folder_type");

-- Files indexes
CREATE INDEX IF NOT EXISTS "idx_files_owner_id" ON "files"("owner_id");
CREATE INDEX IF NOT EXISTS "idx_files_folder_id" ON "files"("folder_id");
CREATE INDEX IF NOT EXISTS "idx_files_client_id" ON "files"("client_id");
CREATE INDEX IF NOT EXISTS "idx_files_is_starred" ON "files"("is_starred");
CREATE INDEX IF NOT EXISTS "idx_files_is_trashed" ON "files"("is_trashed");
CREATE INDEX IF NOT EXISTS "idx_files_created_at" ON "files"("created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_files_updated_at" ON "files"("updated_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_files_name_search" ON "files" USING gin(to_tsvector('english', "name"));

-- File versions indexes
CREATE INDEX IF NOT EXISTS "idx_file_versions_file_id" ON "file_versions"("file_id");
CREATE INDEX IF NOT EXISTS "idx_file_versions_created_at" ON "file_versions"("created_at" DESC);

-- File shares indexes
CREATE INDEX IF NOT EXISTS "idx_file_shares_file_id" ON "file_shares"("file_id");
CREATE INDEX IF NOT EXISTS "idx_file_shares_folder_id" ON "file_shares"("folder_id");
CREATE INDEX IF NOT EXISTS "idx_file_shares_share_token" ON "file_shares"("share_token");
CREATE INDEX IF NOT EXISTS "idx_file_shares_is_active" ON "file_shares"("is_active");
CREATE INDEX IF NOT EXISTS "idx_file_shares_expires_at" ON "file_shares"("expires_at");

-- Storage quotas indexes
CREATE INDEX IF NOT EXISTS "idx_storage_quotas_user_id" ON "storage_quotas"("user_id");

-- File activity indexes
CREATE INDEX IF NOT EXISTS "idx_file_activity_file_id" ON "file_activity"("file_id");
CREATE INDEX IF NOT EXISTS "idx_file_activity_folder_id" ON "file_activity"("folder_id");
CREATE INDEX IF NOT EXISTS "idx_file_activity_user_id" ON "file_activity"("user_id");
CREATE INDEX IF NOT EXISTS "idx_file_activity_created_at" ON "file_activity"("created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_file_activity_action" ON "file_activity"("action");

-- ============================================================================
-- RPC FUNCTIONS
-- ============================================================================

-- Function: check_and_reserve_quota
-- Atomically checks if user has enough quota and reserves space
CREATE OR REPLACE FUNCTION check_and_reserve_quota(
  p_user_id UUID,
  p_bytes BIGINT
) RETURNS BOOLEAN AS $$
DECLARE
  v_current_used BIGINT;
  v_quota BIGINT;
  v_new_used BIGINT;
BEGIN
  -- Get or create storage quota for user
  INSERT INTO storage_quotas (user_id, quota_bytes, used_bytes, file_count)
  VALUES (p_user_id, 26843545600, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;

  -- Lock the row to prevent race conditions
  SELECT used_bytes, quota_bytes
  INTO v_current_used, v_quota
  FROM storage_quotas
  WHERE user_id = p_user_id
  FOR UPDATE;

  -- Calculate new usage
  v_new_used := v_current_used + p_bytes;

  -- Check if quota would be exceeded
  IF v_new_used > v_quota THEN
    RETURN FALSE;
  END IF;

  -- Reserve the space (will be finalized when file record is created)
  UPDATE storage_quotas
  SET
    used_bytes = v_new_used,
    file_count = file_count + 1,
    updated_at = NOW()
  WHERE user_id = p_user_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function: release_quota
-- Releases reserved quota space (used when upload fails)
CREATE OR REPLACE FUNCTION release_quota(
  p_user_id UUID,
  p_bytes BIGINT
) RETURNS VOID AS $$
BEGIN
  UPDATE storage_quotas
  SET
    used_bytes = GREATEST(0, used_bytes - p_bytes),
    file_count = GREATEST(0, file_count - 1),
    updated_at = NOW()
  WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- Function: recalculate_quota
-- Recalculates user's storage usage from actual files
CREATE OR REPLACE FUNCTION recalculate_quota(p_user_id UUID) RETURNS VOID AS $$
DECLARE
  v_total_bytes BIGINT;
  v_file_count INTEGER;
BEGIN
  -- Calculate actual usage from non-trashed files
  SELECT
    COALESCE(SUM(size_bytes), 0),
    COUNT(*)
  INTO v_total_bytes, v_file_count
  FROM files
  WHERE owner_id = p_user_id
    AND is_trashed = false;

  -- Update quota
  UPDATE storage_quotas
  SET
    used_bytes = v_total_bytes,
    file_count = v_file_count,
    last_calculated_at = NOW(),
    updated_at = NOW()
  WHERE user_id = p_user_id;

  -- Create if doesn't exist
  IF NOT FOUND THEN
    INSERT INTO storage_quotas (user_id, used_bytes, file_count, quota_bytes)
    VALUES (p_user_id, v_total_bytes, v_file_count, 26843545600);
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function: cleanup_expired_shares
-- Deactivates expired share links
CREATE OR REPLACE FUNCTION cleanup_expired_shares() RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE file_shares
  SET is_active = false
  WHERE is_active = true
    AND expires_at IS NOT NULL
    AND expires_at < NOW();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Trigger: Update folders.updated_at on changes
CREATE OR REPLACE FUNCTION update_folders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS folders_updated_at ON folders;
CREATE TRIGGER folders_updated_at
  BEFORE UPDATE ON folders
  FOR EACH ROW
  EXECUTE FUNCTION update_folders_updated_at();

-- Trigger: Update files.updated_at on changes
CREATE OR REPLACE FUNCTION update_files_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS files_updated_at ON files;
CREATE TRIGGER files_updated_at
  BEFORE UPDATE ON files
  FOR EACH ROW
  EXECUTE FUNCTION update_files_updated_at();

-- ============================================================================
-- INITIAL DATA
-- ============================================================================

-- Create root folders for existing users
INSERT INTO folders (name, slug, owner_id, folder_type, is_root, created_by)
SELECT
  'My Files',
  'my-files',
  id,
  'personal',
  true,
  id
FROM users
WHERE NOT EXISTS (
  SELECT 1 FROM folders WHERE owner_id = users.id AND is_root = true
)
ON CONFLICT DO NOTHING;

-- Initialize storage quotas for existing users
INSERT INTO storage_quotas (user_id, quota_bytes, used_bytes, file_count)
SELECT
  id,
  26843545600, -- 25 GB
  0,
  0
FROM users
WHERE NOT EXISTS (
  SELECT 1 FROM storage_quotas WHERE user_id = users.id
)
ON CONFLICT (user_id) DO NOTHING;
