import pg from "pg";
const { Client } = pg;

const client = new Client({
  connectionString:
    "postgresql://postgres:ttandSellaBella1234@db.cyygkhwujcrbhzgjqipj.supabase.co:5432/postgres",
  ssl: { rejectUnauthorized: false },
});

async function createFileStorageTables() {
  try {
    await client.connect();
    console.log("Connected to database");

    // Create folders table
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.folders (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        slug TEXT NOT NULL,
        description TEXT,
        parent_id UUID REFERENCES public.folders(id) ON DELETE CASCADE,
        owner_id UUID REFERENCES auth.users(id),
        folder_type TEXT NOT NULL DEFAULT 'personal' CHECK (folder_type IN ('personal', 'team', 'repository', 'client')),
        client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
        is_root BOOLEAN DEFAULT false,
        color TEXT,
        icon TEXT,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now(),
        created_by UUID REFERENCES auth.users(id),
        UNIQUE(parent_id, slug, owner_id)
      );
    `);
    console.log("Created folders table");

    // Create files table
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.files (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        original_name TEXT NOT NULL,
        description TEXT,
        folder_id UUID REFERENCES public.folders(id) ON DELETE CASCADE,
        owner_id UUID REFERENCES auth.users(id),
        storage_path TEXT NOT NULL,
        storage_bucket TEXT NOT NULL DEFAULT 'files',
        mime_type TEXT NOT NULL,
        size_bytes BIGINT NOT NULL,
        file_extension TEXT,
        checksum TEXT,
        is_starred BOOLEAN DEFAULT false,
        is_trashed BOOLEAN DEFAULT false,
        trashed_at TIMESTAMPTZ,
        client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
        version INTEGER DEFAULT 1,
        current_version_id UUID,
        thumbnail_path TEXT,
        preview_generated BOOLEAN DEFAULT false,
        metadata JSONB DEFAULT '{}',
        tags TEXT[],
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now(),
        created_by UUID REFERENCES auth.users(id),
        last_accessed_at TIMESTAMPTZ
      );
    `);
    console.log("Created files table");

    // Create file versions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.file_versions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        file_id UUID NOT NULL REFERENCES public.files(id) ON DELETE CASCADE,
        version_number INTEGER NOT NULL,
        storage_path TEXT NOT NULL,
        storage_bucket TEXT NOT NULL DEFAULT 'files',
        size_bytes BIGINT NOT NULL,
        checksum TEXT,
        change_summary TEXT,
        created_at TIMESTAMPTZ DEFAULT now(),
        created_by UUID REFERENCES auth.users(id),
        UNIQUE(file_id, version_number)
      );
    `);
    console.log("Created file_versions table");

    // Create folder permissions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.folder_permissions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        folder_id UUID NOT NULL REFERENCES public.folders(id) ON DELETE CASCADE,
        user_id UUID REFERENCES auth.users(id),
        role TEXT,
        permission TEXT NOT NULL CHECK (permission IN ('view', 'edit', 'admin')),
        inherited BOOLEAN DEFAULT false,
        granted_by UUID REFERENCES auth.users(id),
        created_at TIMESTAMPTZ DEFAULT now(),
        expires_at TIMESTAMPTZ,
        UNIQUE(folder_id, user_id)
      );
    `);
    console.log("Created folder_permissions table");

    // Create file shares table (for public/expiring links)
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.file_shares (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        file_id UUID REFERENCES public.files(id) ON DELETE CASCADE,
        folder_id UUID REFERENCES public.folders(id) ON DELETE CASCADE,
        share_token TEXT NOT NULL UNIQUE,
        share_type TEXT NOT NULL CHECK (share_type IN ('link', 'email', 'internal')),
        permission TEXT NOT NULL DEFAULT 'view' CHECK (permission IN ('view', 'download', 'edit')),
        password_hash TEXT,
        max_downloads INTEGER,
        download_count INTEGER DEFAULT 0,
        expires_at TIMESTAMPTZ,
        created_by UUID REFERENCES auth.users(id),
        created_at TIMESTAMPTZ DEFAULT now(),
        last_accessed_at TIMESTAMPTZ,
        recipient_email TEXT,
        message TEXT,
        is_active BOOLEAN DEFAULT true,
        CHECK (file_id IS NOT NULL OR folder_id IS NOT NULL)
      );
    `);
    console.log("Created file_shares table");

    // Create storage quotas table
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.storage_quotas (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID UNIQUE REFERENCES auth.users(id),
        quota_bytes BIGINT NOT NULL DEFAULT 10737418240,
        used_bytes BIGINT NOT NULL DEFAULT 0,
        file_count INTEGER DEFAULT 0,
        last_calculated_at TIMESTAMPTZ DEFAULT now(),
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      );
    `);
    console.log("Created storage_quotas table");

    // Create file activity log
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.file_activity (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        file_id UUID REFERENCES public.files(id) ON DELETE SET NULL,
        folder_id UUID REFERENCES public.folders(id) ON DELETE SET NULL,
        user_id UUID REFERENCES auth.users(id),
        action TEXT NOT NULL,
        details JSONB DEFAULT '{}',
        ip_address TEXT,
        user_agent TEXT,
        created_at TIMESTAMPTZ DEFAULT now()
      );
    `);
    console.log("Created file_activity table");

    // Enable RLS
    await client.query(`
      ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.file_versions ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.folder_permissions ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.file_shares ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.storage_quotas ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.file_activity ENABLE ROW LEVEL SECURITY;
    `);
    console.log("Enabled RLS on all tables");

    // Drop existing policies if they exist
    const tables = ['folders', 'files', 'file_versions', 'folder_permissions', 'file_shares', 'storage_quotas', 'file_activity'];
    for (const table of tables) {
      await client.query(`
        DROP POLICY IF EXISTS "Users can view ${table}" ON public.${table};
        DROP POLICY IF EXISTS "Users can insert ${table}" ON public.${table};
        DROP POLICY IF EXISTS "Users can update ${table}" ON public.${table};
        DROP POLICY IF EXISTS "Users can delete ${table}" ON public.${table};
      `);
    }
    console.log("Dropped existing policies");

    // Create RLS policies for folders
    await client.query(`
      CREATE POLICY "Users can view folders" ON public.folders FOR SELECT TO authenticated
      USING (
        owner_id = auth.uid() OR
        folder_type = 'team' OR
        EXISTS (
          SELECT 1 FROM public.folder_permissions fp
          WHERE fp.folder_id = folders.id AND fp.user_id = auth.uid()
        )
      );
    `);
    await client.query(`
      CREATE POLICY "Users can insert folders" ON public.folders FOR INSERT TO authenticated
      WITH CHECK (auth.uid() = owner_id OR auth.uid() = created_by);
    `);
    await client.query(`
      CREATE POLICY "Users can update folders" ON public.folders FOR UPDATE TO authenticated
      USING (
        owner_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM public.folder_permissions fp
          WHERE fp.folder_id = folders.id AND fp.user_id = auth.uid() AND fp.permission IN ('edit', 'admin')
        )
      );
    `);
    await client.query(`
      CREATE POLICY "Users can delete folders" ON public.folders FOR DELETE TO authenticated
      USING (
        owner_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM public.folder_permissions fp
          WHERE fp.folder_id = folders.id AND fp.user_id = auth.uid() AND fp.permission = 'admin'
        )
      );
    `);
    console.log("Created folder policies");

    // Create RLS policies for files
    await client.query(`
      CREATE POLICY "Users can view files" ON public.files FOR SELECT TO authenticated
      USING (
        owner_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM public.folders f
          WHERE f.id = files.folder_id AND (
            f.folder_type = 'team' OR
            f.owner_id = auth.uid() OR
            EXISTS (
              SELECT 1 FROM public.folder_permissions fp
              WHERE fp.folder_id = f.id AND fp.user_id = auth.uid()
            )
          )
        )
      );
    `);
    await client.query(`
      CREATE POLICY "Users can insert files" ON public.files FOR INSERT TO authenticated
      WITH CHECK (auth.uid() = owner_id OR auth.uid() = created_by);
    `);
    await client.query(`
      CREATE POLICY "Users can update files" ON public.files FOR UPDATE TO authenticated
      USING (
        owner_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM public.folders f
          WHERE f.id = files.folder_id AND (
            f.owner_id = auth.uid() OR
            EXISTS (
              SELECT 1 FROM public.folder_permissions fp
              WHERE fp.folder_id = f.id AND fp.user_id = auth.uid() AND fp.permission IN ('edit', 'admin')
            )
          )
        )
      );
    `);
    await client.query(`
      CREATE POLICY "Users can delete files" ON public.files FOR DELETE TO authenticated
      USING (
        owner_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM public.folders f
          WHERE f.id = files.folder_id AND (
            f.owner_id = auth.uid() OR
            EXISTS (
              SELECT 1 FROM public.folder_permissions fp
              WHERE fp.folder_id = f.id AND fp.user_id = auth.uid() AND fp.permission = 'admin'
            )
          )
        )
      );
    `);
    console.log("Created file policies");

    // Create policies for other tables
    await client.query(`
      CREATE POLICY "Users can view file_versions" ON public.file_versions FOR SELECT TO authenticated USING (true);
      CREATE POLICY "Users can insert file_versions" ON public.file_versions FOR INSERT TO authenticated WITH CHECK (true);
    `);
    await client.query(`
      CREATE POLICY "Users can view folder_permissions" ON public.folder_permissions FOR SELECT TO authenticated USING (true);
      CREATE POLICY "Users can insert folder_permissions" ON public.folder_permissions FOR INSERT TO authenticated WITH CHECK (true);
      CREATE POLICY "Users can update folder_permissions" ON public.folder_permissions FOR UPDATE TO authenticated USING (true);
      CREATE POLICY "Users can delete folder_permissions" ON public.folder_permissions FOR DELETE TO authenticated USING (true);
    `);
    await client.query(`
      CREATE POLICY "Users can view file_shares" ON public.file_shares FOR SELECT TO authenticated USING (true);
      CREATE POLICY "Users can insert file_shares" ON public.file_shares FOR INSERT TO authenticated WITH CHECK (true);
      CREATE POLICY "Users can update file_shares" ON public.file_shares FOR UPDATE TO authenticated USING (true);
      CREATE POLICY "Users can delete file_shares" ON public.file_shares FOR DELETE TO authenticated USING (true);
    `);
    await client.query(`
      CREATE POLICY "Users can view storage_quotas" ON public.storage_quotas FOR SELECT TO authenticated USING (user_id = auth.uid());
      CREATE POLICY "Users can insert storage_quotas" ON public.storage_quotas FOR INSERT TO authenticated WITH CHECK (true);
      CREATE POLICY "Users can update storage_quotas" ON public.storage_quotas FOR UPDATE TO authenticated USING (true);
    `);
    await client.query(`
      CREATE POLICY "Users can view file_activity" ON public.file_activity FOR SELECT TO authenticated USING (true);
      CREATE POLICY "Users can insert file_activity" ON public.file_activity FOR INSERT TO authenticated WITH CHECK (true);
    `);
    console.log("Created remaining policies");

    // Create indexes for performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_folders_parent_id ON public.folders(parent_id);
      CREATE INDEX IF NOT EXISTS idx_folders_owner_id ON public.folders(owner_id);
      CREATE INDEX IF NOT EXISTS idx_folders_folder_type ON public.folders(folder_type);
      CREATE INDEX IF NOT EXISTS idx_folders_client_id ON public.folders(client_id);
      CREATE INDEX IF NOT EXISTS idx_files_folder_id ON public.files(folder_id);
      CREATE INDEX IF NOT EXISTS idx_files_owner_id ON public.files(owner_id);
      CREATE INDEX IF NOT EXISTS idx_files_client_id ON public.files(client_id);
      CREATE INDEX IF NOT EXISTS idx_files_is_trashed ON public.files(is_trashed);
      CREATE INDEX IF NOT EXISTS idx_files_mime_type ON public.files(mime_type);
      CREATE INDEX IF NOT EXISTS idx_files_created_at ON public.files(created_at);
      CREATE INDEX IF NOT EXISTS idx_files_name ON public.files(name);
      CREATE INDEX IF NOT EXISTS idx_file_versions_file_id ON public.file_versions(file_id);
      CREATE INDEX IF NOT EXISTS idx_folder_permissions_folder_id ON public.folder_permissions(folder_id);
      CREATE INDEX IF NOT EXISTS idx_folder_permissions_user_id ON public.folder_permissions(user_id);
      CREATE INDEX IF NOT EXISTS idx_file_shares_share_token ON public.file_shares(share_token);
      CREATE INDEX IF NOT EXISTS idx_file_shares_file_id ON public.file_shares(file_id);
      CREATE INDEX IF NOT EXISTS idx_file_activity_file_id ON public.file_activity(file_id);
      CREATE INDEX IF NOT EXISTS idx_file_activity_user_id ON public.file_activity(user_id);
      CREATE INDEX IF NOT EXISTS idx_file_activity_created_at ON public.file_activity(created_at);
    `);
    console.log("Created indexes");

    // Enable realtime for file-related tables
    await client.query(`ALTER TABLE public.folders REPLICA IDENTITY FULL;`);
    await client.query(`ALTER TABLE public.files REPLICA IDENTITY FULL;`);

    // Check if tables are already in publication
    const pubCheck = await client.query(`
      SELECT tablename FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename IN ('folders', 'files');
    `);
    const existingTables = pubCheck.rows.map(r => r.tablename);

    if (!existingTables.includes('folders')) {
      await client.query(`ALTER PUBLICATION supabase_realtime ADD TABLE public.folders;`);
    }
    if (!existingTables.includes('files')) {
      await client.query(`ALTER PUBLICATION supabase_realtime ADD TABLE public.files;`);
    }
    console.log("Enabled realtime for folders and files tables");

    console.log("\n✅ File storage tables created successfully!");
    console.log("Tables: folders, files, file_versions, folder_permissions, file_shares, storage_quotas, file_activity");

  } catch (error) {
    console.error("Error creating tables:", error);
  } finally {
    await client.end();
  }
}

createFileStorageTables();
