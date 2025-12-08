import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jklptmcosmwjqrwxmjbf.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImprbHB0bWNvc213anFyd3htamJmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0OTY3MjIwMiwiZXhwIjoyMDY1MjQ4MjAyfQ.x72daTdBBUfv8xLj8gqLaifFeg0I_xHuZ_ECrVMFrPE';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createTaskPoolTables() {
  console.log('Creating TaskPool tables...\n');

  // 1. Organizations table (for future multi-tenancy)
  console.log('Creating organizations table...');
  const { error: orgError } = await supabase.rpc('exec_sql', {
    sql: `
      CREATE TABLE IF NOT EXISTS organizations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        settings JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Insert default organization
      INSERT INTO organizations (id, name, slug)
      VALUES ('00000000-0000-0000-0000-000000000001', 'Spencer McGaw', 'spencer-mcgaw')
      ON CONFLICT (slug) DO NOTHING;
    `
  });

  if (orgError) {
    // Try direct SQL approach
    const { error } = await supabase.from('organizations').select('id').limit(1);
    if (error?.code === '42P01') {
      console.log('Table does not exist, creating via SQL...');
    }
  }

  // 2. Task Action Types table
  console.log('Creating task_action_types table...');
  const { error: actionTypesError } = await supabase.rpc('exec_sql', {
    sql: `
      CREATE TABLE IF NOT EXISTS task_action_types (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID REFERENCES organizations(id) DEFAULT '00000000-0000-0000-0000-000000000001',
        code TEXT NOT NULL,
        label TEXT NOT NULL,
        description TEXT,
        color TEXT DEFAULT '#6B7280',
        icon TEXT DEFAULT 'clipboard',
        sort_order INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(organization_id, code)
      );
    `
  });

  // 3. Tasks table
  console.log('Creating tasks table...');
  const { error: tasksError } = await supabase.rpc('exec_sql', {
    sql: `
      CREATE TABLE IF NOT EXISTS tasks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID REFERENCES organizations(id) DEFAULT '00000000-0000-0000-0000-000000000001',

        -- Core fields
        title TEXT NOT NULL,
        description TEXT,
        action_type_id UUID REFERENCES task_action_types(id),

        -- Source tracking
        source_type TEXT DEFAULT 'manual',
        source_email_id UUID,
        source_metadata JSONB DEFAULT '{}',

        -- Assignment
        client_id UUID REFERENCES client_contacts(id),
        assigned_to UUID REFERENCES auth.users(id),
        claimed_by UUID REFERENCES auth.users(id),
        claimed_at TIMESTAMPTZ,

        -- Status and priority
        status TEXT DEFAULT 'open',
        priority TEXT DEFAULT 'medium',

        -- Dates
        due_date DATE,
        completed_at TIMESTAMPTZ,

        -- AI fields
        ai_confidence DECIMAL(3,2),
        ai_extracted_data JSONB DEFAULT '{}',

        -- Routing
        next_action_type_id UUID REFERENCES task_action_types(id),
        routed_from_task_id UUID REFERENCES tasks(id),

        -- Timestamps
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        created_by UUID REFERENCES auth.users(id)
      );

      -- Indexes for common queries
      CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
      CREATE INDEX IF NOT EXISTS idx_tasks_action_type ON tasks(action_type_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_claimed_by ON tasks(claimed_by);
      CREATE INDEX IF NOT EXISTS idx_tasks_client_id ON tasks(client_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
      CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
    `
  });

  // 4. Task Notes table
  console.log('Creating task_notes table...');
  const { error: notesError } = await supabase.rpc('exec_sql', {
    sql: `
      CREATE TABLE IF NOT EXISTS task_notes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        created_by UUID REFERENCES auth.users(id),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_task_notes_task_id ON task_notes(task_id);
    `
  });

  // 5. Task Activity Log table
  console.log('Creating task_activity_log table...');
  const { error: activityError } = await supabase.rpc('exec_sql', {
    sql: `
      CREATE TABLE IF NOT EXISTS task_activity_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        action TEXT NOT NULL,
        details JSONB DEFAULT '{}',
        performed_by UUID REFERENCES auth.users(id),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_task_activity_task_id ON task_activity_log(task_id);
      CREATE INDEX IF NOT EXISTS idx_task_activity_action ON task_activity_log(action);
    `
  });

  // 6. Task Links table
  console.log('Creating task_links table...');
  const { error: linksError } = await supabase.rpc('exec_sql', {
    sql: `
      CREATE TABLE IF NOT EXISTS task_links (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        source_task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        target_task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        link_type TEXT NOT NULL DEFAULT 'related',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(source_task_id, target_task_id, link_type)
      );

      CREATE INDEX IF NOT EXISTS idx_task_links_source ON task_links(source_task_id);
      CREATE INDEX IF NOT EXISTS idx_task_links_target ON task_links(target_task_id);
    `
  });

  // 7. Task Attachments table
  console.log('Creating task_attachments table...');
  const { error: attachmentsError } = await supabase.rpc('exec_sql', {
    sql: `
      CREATE TABLE IF NOT EXISTS task_attachments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        file_name TEXT NOT NULL,
        file_path TEXT NOT NULL,
        file_size INTEGER,
        file_type TEXT,
        uploaded_by UUID REFERENCES auth.users(id),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_task_attachments_task_id ON task_attachments(task_id);
    `
  });

  console.log('\nTaskPool tables creation attempted. Running verification...\n');
}

async function insertDefaultActionTypes() {
  console.log('Inserting default action types...');

  const actionTypes = [
    { code: 'RESPOND', label: 'Respond', description: 'Reply to client communication', color: '#3B82F6', icon: 'message-square', sort_order: 1 },
    { code: 'PREPARE', label: 'Prepare', description: 'Create documents, proposals, or deliverables', color: '#8B5CF6', icon: 'file-text', sort_order: 2 },
    { code: 'REVIEW', label: 'Review', description: 'Check and approve work', color: '#F59E0B', icon: 'eye', sort_order: 3 },
    { code: 'REQUEST', label: 'Request', description: 'Ask for information or materials', color: '#10B981', icon: 'help-circle', sort_order: 4 },
    { code: 'FILE', label: 'File', description: 'Submit documents to external parties', color: '#EF4444', icon: 'send', sort_order: 5 },
    { code: 'SCHEDULE', label: 'Schedule', description: 'Arrange meetings or deadlines', color: '#EC4899', icon: 'calendar', sort_order: 6 },
    { code: 'PROCESS', label: 'Process', description: 'Handle administrative tasks', color: '#6B7280', icon: 'settings', sort_order: 7 },
  ];

  for (const actionType of actionTypes) {
    const { error } = await supabase
      .from('task_action_types')
      .upsert(
        { ...actionType, organization_id: '00000000-0000-0000-0000-000000000001' },
        { onConflict: 'organization_id,code' }
      );

    if (error) {
      console.log(`  - ${actionType.code}: Error - ${error.message}`);
    } else {
      console.log(`  - ${actionType.code}: OK`);
    }
  }
}

async function verifyTables() {
  console.log('\nVerifying tables...\n');

  const tables = [
    'organizations',
    'task_action_types',
    'tasks',
    'task_notes',
    'task_activity_log',
    'task_links',
    'task_attachments'
  ];

  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (error) {
      console.log(`  ${table}: ERROR - ${error.message}`);
    } else {
      console.log(`  ${table}: OK`);
    }
  }
}

// Main execution
async function main() {
  try {
    await createTaskPoolTables();
    await insertDefaultActionTypes();
    await verifyTables();
    console.log('\nTaskPool database setup complete!');
  } catch (error) {
    console.error('Error:', error);
  }
}

main();
