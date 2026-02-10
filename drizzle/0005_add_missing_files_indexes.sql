-- Add missing indexes for files feature

-- Enable pg_trgm extension for fuzzy search (must be first)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Files table - missing indexes
CREATE INDEX IF NOT EXISTS "idx_files_updated_at" ON "files"("updated_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_files_is_starred" ON "files"("is_starred") WHERE "is_starred" = true;
CREATE INDEX IF NOT EXISTS "idx_files_name_trgm" ON "files" USING gin("name" gin_trgm_ops);

-- File versions - missing indexes  
CREATE INDEX IF NOT EXISTS "idx_file_versions_created_at" ON "file_versions"("created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_file_versions_version_number" ON "file_versions"("file_id", "version_number");

-- File shares - missing indexes
CREATE INDEX IF NOT EXISTS "idx_file_shares_folder_id" ON "file_shares"("folder_id");
CREATE INDEX IF NOT EXISTS "idx_file_shares_is_active" ON "file_shares"("is_active") WHERE "is_active" = true;
CREATE INDEX IF NOT EXISTS "idx_file_shares_expires_at" ON "file_shares"("expires_at") WHERE "expires_at" IS NOT NULL;

-- Storage quotas - missing index
CREATE INDEX IF NOT EXISTS "idx_storage_quotas_user_id" ON "storage_quotas"("user_id");

-- File activity - missing indexes
CREATE INDEX IF NOT EXISTS "idx_file_activity_folder_id" ON "file_activity"("folder_id");
CREATE INDEX IF NOT EXISTS "idx_file_activity_action" ON "file_activity"("action");
