import pg from "pg";

const { Pool } = pg;

const pool = new Pool({
  host: "db.cyygkhwujcrbhzgjqipj.supabase.co",
  port: 5432,
  database: "postgres",
  user: "postgres",
  password: "ttandSellaBella1234",
  ssl: { rejectUnauthorized: false },
});

async function createCRMTables() {
  const client = await pool.connect();

  try {
    console.log("🏗️  Creating Accounting CRM with Project Tracking tables...\n");

    // ========================================
    // ENUMS
    // ========================================
    console.log("Creating enums...");

    // Entity type enum (individual, corporation, partnership, trust, nonprofit)
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE entity_type AS ENUM (
          'individual',
          'corporation',
          's_corporation',
          'partnership',
          'llc',
          'trust',
          'estate',
          'nonprofit'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    console.log("  ✓ entity_type enum");

    // Project status enum
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE project_status AS ENUM (
          'not_started',
          'in_progress',
          'awaiting_client',
          'under_review',
          'ready_to_file',
          'completed',
          'on_hold',
          'cancelled'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    console.log("  ✓ project_status enum");

    // Project type enum (engagement types)
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE project_type AS ENUM (
          'tax_1040',
          'tax_1120',
          'tax_1120s',
          'tax_1065',
          'tax_1041',
          'tax_990',
          'tax_5500',
          'bookkeeping_monthly',
          'bookkeeping_quarterly',
          'payroll',
          'advisory',
          'audit',
          'review',
          'compilation',
          'other'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    console.log("  ✓ project_type enum");

    // Project task type enum
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE project_task_type AS ENUM (
          'firm_task',
          'client_task',
          'review_task',
          'approval_task',
          'milestone'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    console.log("  ✓ project_task_type enum");

    // ========================================
    // ADD COLUMNS TO EXISTING CLIENTS TABLE
    // ========================================
    console.log("\nUpdating clients table with entity fields...");

    // Add entity_type column
    await client.query(`
      ALTER TABLE clients
      ADD COLUMN IF NOT EXISTS entity_type entity_type DEFAULT 'individual';
    `);
    console.log("  ✓ Added entity_type column");

    // Add EIN/Tax ID fields
    await client.query(`
      ALTER TABLE clients
      ADD COLUMN IF NOT EXISTS ein varchar(20),
      ADD COLUMN IF NOT EXISTS ssn_last4 varchar(4),
      ADD COLUMN IF NOT EXISTS state_id varchar(50),
      ADD COLUMN IF NOT EXISTS fiscal_year_end varchar(10) DEFAULT '12/31',
      ADD COLUMN IF NOT EXISTS date_incorporated timestamp,
      ADD COLUMN IF NOT EXISTS state_of_incorporation varchar(50);
    `);
    console.log("  ✓ Added entity identification fields");

    // Add business details
    await client.query(`
      ALTER TABLE clients
      ADD COLUMN IF NOT EXISTS industry varchar(100),
      ADD COLUMN IF NOT EXISTS website varchar(255),
      ADD COLUMN IF NOT EXISTS annual_revenue varchar(50);
    `);
    console.log("  ✓ Added business detail fields");

    // ========================================
    // CONTACTS TABLE (People related to entities)
    // ========================================
    console.log("\nCreating contacts table...");

    await client.query(`
      CREATE TABLE IF NOT EXISTS contacts (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
        first_name varchar(100) NOT NULL,
        last_name varchar(100) NOT NULL,
        email varchar(255),
        phone varchar(20),
        mobile varchar(20),
        role varchar(100), -- e.g., 'Owner', 'CFO', 'Spouse', 'Authorized Signer'
        is_primary boolean DEFAULT false,
        title varchar(100),
        notes text,
        created_at timestamp DEFAULT now(),
        updated_at timestamp DEFAULT now()
      );
    `);
    console.log("  ✓ contacts table created");

    // ========================================
    // PROJECT TEMPLATES TABLE
    // ========================================
    console.log("\nCreating project_templates table...");

    await client.query(`
      CREATE TABLE IF NOT EXISTS project_templates (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name varchar(255) NOT NULL,
        project_type project_type NOT NULL,
        description text,
        default_days_to_complete integer DEFAULT 30,
        is_active boolean DEFAULT true,
        created_by uuid REFERENCES users(id),
        created_at timestamp DEFAULT now(),
        updated_at timestamp DEFAULT now()
      );
    `);
    console.log("  ✓ project_templates table created");

    // ========================================
    // PROJECT TEMPLATE TASKS TABLE
    // ========================================
    console.log("\nCreating project_template_tasks table...");

    await client.query(`
      CREATE TABLE IF NOT EXISTS project_template_tasks (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        template_id uuid REFERENCES project_templates(id) ON DELETE CASCADE,
        title varchar(500) NOT NULL,
        description text,
        task_type project_task_type DEFAULT 'firm_task',
        sort_order integer NOT NULL DEFAULT 0,
        estimated_hours numeric(5,2),
        days_from_start integer DEFAULT 0, -- Relative due date
        depends_on_task_id uuid REFERENCES project_template_tasks(id),
        is_required boolean DEFAULT true,
        default_assignee_role varchar(50), -- 'preparer', 'reviewer', 'partner', 'client'
        created_at timestamp DEFAULT now()
      );
    `);
    console.log("  ✓ project_template_tasks table created");

    // ========================================
    // PROJECTS TABLE (Engagements)
    // ========================================
    console.log("\nCreating projects table...");

    await client.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        client_id uuid REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
        template_id uuid REFERENCES project_templates(id),
        name varchar(255) NOT NULL,
        project_type project_type NOT NULL,
        status project_status DEFAULT 'not_started',

        -- Period/Year tracking
        tax_year integer,
        period_start date,
        period_end date,

        -- Deadlines
        due_date date,
        extension_date date,
        internal_deadline date,

        -- Assignment
        assigned_to uuid REFERENCES users(id),
        reviewer_id uuid REFERENCES users(id),
        partner_id uuid REFERENCES users(id),

        -- Progress
        progress_percent integer DEFAULT 0,

        -- Dates
        started_at timestamp,
        completed_at timestamp,

        -- Notes and metadata
        notes text,
        metadata jsonb DEFAULT '{}',

        -- Recurring
        is_recurring boolean DEFAULT false,
        recurrence_pattern varchar(50), -- 'annual', 'quarterly', 'monthly'
        parent_project_id uuid REFERENCES projects(id), -- For recurring instances

        created_by uuid REFERENCES users(id),
        created_at timestamp DEFAULT now(),
        updated_at timestamp DEFAULT now()
      );
    `);
    console.log("  ✓ projects table created");

    // ========================================
    // PROJECT TASKS TABLE
    // ========================================
    console.log("\nCreating project_tasks table...");

    await client.query(`
      CREATE TABLE IF NOT EXISTS project_tasks (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id uuid REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
        template_task_id uuid REFERENCES project_template_tasks(id),

        title varchar(500) NOT NULL,
        description text,
        task_type project_task_type DEFAULT 'firm_task',

        status task_status DEFAULT 'pending',
        sort_order integer DEFAULT 0,

        -- Assignment
        assigned_to uuid REFERENCES users(id),

        -- Timing
        due_date timestamp,
        estimated_hours numeric(5,2),
        actual_hours numeric(5,2),

        -- Dependencies
        depends_on_task_id uuid REFERENCES project_tasks(id),

        -- Completion
        completed_at timestamp,
        completed_by uuid REFERENCES users(id),

        -- Notes
        notes text,

        created_at timestamp DEFAULT now(),
        updated_at timestamp DEFAULT now()
      );
    `);
    console.log("  ✓ project_tasks table created");

    // ========================================
    // PROJECT NOTES TABLE (Activity/Comments)
    // ========================================
    console.log("\nCreating project_notes table...");

    await client.query(`
      CREATE TABLE IF NOT EXISTS project_notes (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id uuid REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
        project_task_id uuid REFERENCES project_tasks(id) ON DELETE CASCADE,
        user_id uuid REFERENCES users(id),
        content text NOT NULL,
        is_internal boolean DEFAULT true, -- false = visible to client
        created_at timestamp DEFAULT now(),
        updated_at timestamp DEFAULT now()
      );
    `);
    console.log("  ✓ project_notes table created");

    // ========================================
    // PROJECT DOCUMENTS LINKING TABLE
    // ========================================
    console.log("\nCreating project_documents table...");

    await client.query(`
      CREATE TABLE IF NOT EXISTS project_documents (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id uuid REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
        document_id uuid REFERENCES documents(id) ON DELETE CASCADE NOT NULL,
        is_required boolean DEFAULT false,
        status varchar(50) DEFAULT 'pending', -- 'pending', 'received', 'reviewed', 'approved'
        notes text,
        created_at timestamp DEFAULT now(),
        UNIQUE(project_id, document_id)
      );
    `);
    console.log("  ✓ project_documents table created");

    // ========================================
    // ADD PROJECT REFERENCE TO EXISTING TABLES
    // ========================================
    console.log("\nAdding project references to existing tables...");

    // Add project_id to tasks table
    await client.query(`
      ALTER TABLE tasks
      ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES projects(id) ON DELETE SET NULL;
    `);
    console.log("  ✓ Added project_id to tasks table");

    // Add project_id to calls table
    await client.query(`
      ALTER TABLE calls
      ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES projects(id) ON DELETE SET NULL;
    `);
    console.log("  ✓ Added project_id to calls table");

    // Add project_id to activity_logs table
    await client.query(`
      ALTER TABLE activity_logs
      ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES projects(id) ON DELETE SET NULL;
    `);
    console.log("  ✓ Added project_id to activity_logs table");

    // ========================================
    // INDEXES
    // ========================================
    console.log("\nCreating indexes...");

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_projects_client_id ON projects(client_id);
      CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
      CREATE INDEX IF NOT EXISTS idx_projects_due_date ON projects(due_date);
      CREATE INDEX IF NOT EXISTS idx_projects_assigned_to ON projects(assigned_to);
      CREATE INDEX IF NOT EXISTS idx_project_tasks_project_id ON project_tasks(project_id);
      CREATE INDEX IF NOT EXISTS idx_project_tasks_status ON project_tasks(status);
      CREATE INDEX IF NOT EXISTS idx_project_tasks_assigned_to ON project_tasks(assigned_to);
      CREATE INDEX IF NOT EXISTS idx_contacts_client_id ON contacts(client_id);
      CREATE INDEX IF NOT EXISTS idx_project_notes_project_id ON project_notes(project_id);
    `);
    console.log("  ✓ Indexes created");

    // ========================================
    // SEED DEFAULT PROJECT TEMPLATES
    // ========================================
    console.log("\nSeeding default project templates...");

    // Check if templates exist
    const existingTemplates = await client.query(`
      SELECT COUNT(*) as count FROM project_templates;
    `);

    if (parseInt(existingTemplates.rows[0].count) === 0) {
      // Insert 1040 Individual Tax Return template
      const tax1040 = await client.query(`
        INSERT INTO project_templates (name, project_type, description, default_days_to_complete)
        VALUES ('Individual Tax Return (1040)', 'tax_1040', 'Standard individual income tax return preparation', 21)
        RETURNING id;
      `);
      const tax1040Id = tax1040.rows[0].id;

      // Insert 1040 template tasks
      await client.query(`
        INSERT INTO project_template_tasks (template_id, title, task_type, sort_order, days_from_start, default_assignee_role) VALUES
        ('${tax1040Id}', 'Send engagement letter', 'firm_task', 1, 0, 'preparer'),
        ('${tax1040Id}', 'Client signs engagement letter', 'client_task', 2, 3, 'client'),
        ('${tax1040Id}', 'Request tax documents', 'firm_task', 3, 3, 'preparer'),
        ('${tax1040Id}', 'Client provides tax documents', 'client_task', 4, 10, 'client'),
        ('${tax1040Id}', 'Review documents for completeness', 'firm_task', 5, 11, 'preparer'),
        ('${tax1040Id}', 'Enter data and prepare return', 'firm_task', 6, 14, 'preparer'),
        ('${tax1040Id}', 'Manager review', 'review_task', 7, 17, 'reviewer'),
        ('${tax1040Id}', 'Make review corrections', 'firm_task', 8, 18, 'preparer'),
        ('${tax1040Id}', 'Send to client for review', 'firm_task', 9, 19, 'preparer'),
        ('${tax1040Id}', 'Client approves return', 'client_task', 10, 20, 'client'),
        ('${tax1040Id}', 'E-file return', 'firm_task', 11, 21, 'preparer'),
        ('${tax1040Id}', 'Confirm acceptance', 'firm_task', 12, 21, 'preparer');
      `);
      console.log("  ✓ Individual Tax Return (1040) template seeded");

      // Insert 1120/1120S Business Tax Return template
      const taxBusiness = await client.query(`
        INSERT INTO project_templates (name, project_type, description, default_days_to_complete)
        VALUES ('Business Tax Return (1120/1120S)', 'tax_1120', 'Corporate or S-Corp tax return preparation', 28)
        RETURNING id;
      `);
      const taxBusinessId = taxBusiness.rows[0].id;

      await client.query(`
        INSERT INTO project_template_tasks (template_id, title, task_type, sort_order, days_from_start, default_assignee_role) VALUES
        ('${taxBusinessId}', 'Send engagement letter', 'firm_task', 1, 0, 'preparer'),
        ('${taxBusinessId}', 'Client signs engagement letter', 'client_task', 2, 3, 'client'),
        ('${taxBusinessId}', 'Confirm books are closed', 'client_task', 3, 5, 'client'),
        ('${taxBusinessId}', 'Request supporting documents', 'firm_task', 4, 5, 'preparer'),
        ('${taxBusinessId}', 'Client provides documents', 'client_task', 5, 12, 'client'),
        ('${taxBusinessId}', 'Review financial statements', 'firm_task', 6, 14, 'preparer'),
        ('${taxBusinessId}', 'Prepare book-to-tax adjustments', 'firm_task', 7, 16, 'preparer'),
        ('${taxBusinessId}', 'Enter data into tax software', 'firm_task', 8, 18, 'preparer'),
        ('${taxBusinessId}', 'Prepare depreciation schedule', 'firm_task', 9, 20, 'preparer'),
        ('${taxBusinessId}', 'Complete initial draft', 'firm_task', 10, 22, 'preparer'),
        ('${taxBusinessId}', 'Manager review', 'review_task', 11, 24, 'reviewer'),
        ('${taxBusinessId}', 'Partner review', 'approval_task', 12, 25, 'partner'),
        ('${taxBusinessId}', 'Make review corrections', 'firm_task', 13, 26, 'preparer'),
        ('${taxBusinessId}', 'Send to client for approval', 'firm_task', 14, 27, 'preparer'),
        ('${taxBusinessId}', 'Client approves return', 'client_task', 15, 28, 'client'),
        ('${taxBusinessId}', 'E-file and confirm acceptance', 'firm_task', 16, 28, 'preparer');
      `);
      console.log("  ✓ Business Tax Return (1120/1120S) template seeded");

      // Insert Monthly Bookkeeping template
      const bookkeeping = await client.query(`
        INSERT INTO project_templates (name, project_type, description, default_days_to_complete)
        VALUES ('Monthly Bookkeeping', 'bookkeeping_monthly', 'Monthly bookkeeping and reconciliation', 15)
        RETURNING id;
      `);
      const bookkeepingId = bookkeeping.rows[0].id;

      await client.query(`
        INSERT INTO project_template_tasks (template_id, title, task_type, sort_order, days_from_start, default_assignee_role) VALUES
        ('${bookkeepingId}', 'Request bank/credit card statements', 'firm_task', 1, 0, 'preparer'),
        ('${bookkeepingId}', 'Client provides statements', 'client_task', 2, 5, 'client'),
        ('${bookkeepingId}', 'Download transactions', 'firm_task', 3, 6, 'preparer'),
        ('${bookkeepingId}', 'Categorize transactions', 'firm_task', 4, 8, 'preparer'),
        ('${bookkeepingId}', 'Reconcile bank accounts', 'firm_task', 5, 10, 'preparer'),
        ('${bookkeepingId}', 'Reconcile credit cards', 'firm_task', 6, 11, 'preparer'),
        ('${bookkeepingId}', 'Review AR aging', 'firm_task', 7, 12, 'preparer'),
        ('${bookkeepingId}', 'Review AP aging', 'firm_task', 8, 12, 'preparer'),
        ('${bookkeepingId}', 'Prepare month-end entries', 'firm_task', 9, 13, 'preparer'),
        ('${bookkeepingId}', 'Generate financial statements', 'firm_task', 10, 14, 'preparer'),
        ('${bookkeepingId}', 'Manager review', 'review_task', 11, 14, 'reviewer'),
        ('${bookkeepingId}', 'Send financials to client', 'firm_task', 12, 15, 'preparer');
      `);
      console.log("  ✓ Monthly Bookkeeping template seeded");

      // Insert Partnership Return template
      const partnership = await client.query(`
        INSERT INTO project_templates (name, project_type, description, default_days_to_complete)
        VALUES ('Partnership Return (1065)', 'tax_1065', 'Partnership tax return with K-1 preparation', 28)
        RETURNING id;
      `);
      const partnershipId = partnership.rows[0].id;

      await client.query(`
        INSERT INTO project_template_tasks (template_id, title, task_type, sort_order, days_from_start, default_assignee_role) VALUES
        ('${partnershipId}', 'Send engagement letter', 'firm_task', 1, 0, 'preparer'),
        ('${partnershipId}', 'Client signs engagement letter', 'client_task', 2, 3, 'client'),
        ('${partnershipId}', 'Confirm books are closed', 'client_task', 3, 5, 'client'),
        ('${partnershipId}', 'Request supporting documents', 'firm_task', 4, 5, 'preparer'),
        ('${partnershipId}', 'Client provides documents', 'client_task', 5, 12, 'client'),
        ('${partnershipId}', 'Review partner capital accounts', 'firm_task', 6, 14, 'preparer'),
        ('${partnershipId}', 'Prepare book-to-tax adjustments', 'firm_task', 7, 16, 'preparer'),
        ('${partnershipId}', 'Enter data into tax software', 'firm_task', 8, 18, 'preparer'),
        ('${partnershipId}', 'Prepare K-1s', 'firm_task', 9, 20, 'preparer'),
        ('${partnershipId}', 'Manager review', 'review_task', 10, 24, 'reviewer'),
        ('${partnershipId}', 'Partner review', 'approval_task', 11, 25, 'partner'),
        ('${partnershipId}', 'Send K-1s to partners', 'firm_task', 12, 26, 'preparer'),
        ('${partnershipId}', 'E-file and confirm acceptance', 'firm_task', 13, 28, 'preparer');
      `);
      console.log("  ✓ Partnership Return (1065) template seeded");
    } else {
      console.log("  ⏭️  Templates already exist, skipping seed");
    }

    console.log("\n✅ CRM and Project Tracking tables created successfully!");
    console.log("\nNew tables created:");
    console.log("  - contacts (people related to clients/entities)");
    console.log("  - project_templates (reusable workflow templates)");
    console.log("  - project_template_tasks (tasks in templates)");
    console.log("  - projects (client engagements)");
    console.log("  - project_tasks (tasks within projects)");
    console.log("  - project_notes (comments/activity)");
    console.log("  - project_documents (document linking)");
    console.log("\nEnhanced tables:");
    console.log("  - clients (added entity_type, EIN, etc.)");
    console.log("  - tasks (added project_id)");
    console.log("  - calls (added project_id)");
    console.log("  - activity_logs (added project_id)");

  } catch (error) {
    console.error("Error creating CRM tables:", error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

createCRMTables();
