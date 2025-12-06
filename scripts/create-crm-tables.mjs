import pg from "pg";

const { Pool } = pg;

const pool = new Pool({
  host: "db.cyygkhwujcrbhzgjqipj.supabase.co",
  port: 5432,
  database: "postgres",
  user: "postgres",
  password: process.env.SUPABASE_DB_PASSWORD || "ttandSellaBella1234",
  ssl: { rejectUnauthorized: false },
});

async function createCRMTables() {
  const client = await pool.connect();

  try {
    console.log("Creating CRM tables...\n");

    // 1. Enhance clients table with new columns
    console.log("1. Enhancing clients table...");
    await client.query(`
      -- Add new columns to clients table if they don't exist
      DO $$
      BEGIN
        -- Client type
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clients' AND column_name = 'client_type') THEN
          ALTER TABLE clients ADD COLUMN client_type TEXT DEFAULT 'individual';
        END IF;

        -- Business structure
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clients' AND column_name = 'business_structure') THEN
          ALTER TABLE clients ADD COLUMN business_structure TEXT;
        END IF;

        -- Industry
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clients' AND column_name = 'industry') THEN
          ALTER TABLE clients ADD COLUMN industry TEXT;
        END IF;

        -- EIN/TIN (encrypted)
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clients' AND column_name = 'ein_tin') THEN
          ALTER TABLE clients ADD COLUMN ein_tin TEXT;
        END IF;

        -- Fiscal year end
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clients' AND column_name = 'fiscal_year_end') THEN
          ALTER TABLE clients ADD COLUMN fiscal_year_end DATE;
        END IF;

        -- Acquisition source
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clients' AND column_name = 'acquisition_source') THEN
          ALTER TABLE clients ADD COLUMN acquisition_source TEXT;
        END IF;

        -- Referred by
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clients' AND column_name = 'referred_by_client_id') THEN
          ALTER TABLE clients ADD COLUMN referred_by_client_id UUID REFERENCES clients(id);
        END IF;

        -- Primary contact
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clients' AND column_name = 'primary_contact_id') THEN
          ALTER TABLE clients ADD COLUMN primary_contact_id UUID;
        END IF;

        -- Assigned accountant
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clients' AND column_name = 'assigned_accountant_id') THEN
          ALTER TABLE clients ADD COLUMN assigned_accountant_id UUID;
        END IF;

        -- Billing rate
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clients' AND column_name = 'billing_rate') THEN
          ALTER TABLE clients ADD COLUMN billing_rate DECIMAL(10,2);
        END IF;

        -- Retainer amount
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clients' AND column_name = 'retainer_amount') THEN
          ALTER TABLE clients ADD COLUMN retainer_amount DECIMAL(10,2);
        END IF;

        -- Tags
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clients' AND column_name = 'tags') THEN
          ALTER TABLE clients ADD COLUMN tags TEXT[];
        END IF;

        -- Client since date
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clients' AND column_name = 'client_since') THEN
          ALTER TABLE clients ADD COLUMN client_since DATE;
        END IF;

        -- Website
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clients' AND column_name = 'website') THEN
          ALTER TABLE clients ADD COLUMN website TEXT;
        END IF;
      END $$;
    `);
    console.log("   ✓ Clients table enhanced\n");

    // 2. Create client_contacts table
    console.log("2. Creating client_contacts table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS client_contacts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        title TEXT,
        email TEXT,
        phone TEXT,
        mobile TEXT,
        is_primary BOOLEAN DEFAULT false,
        is_authorized_signer BOOLEAN DEFAULT false,
        receives_tax_docs BOOLEAN DEFAULT true,
        receives_invoices BOOLEAN DEFAULT false,
        birthday DATE,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Create index for faster lookups
      CREATE INDEX IF NOT EXISTS idx_client_contacts_client_id ON client_contacts(client_id);
      CREATE INDEX IF NOT EXISTS idx_client_contacts_email ON client_contacts(email);
    `);
    console.log("   ✓ client_contacts table created\n");

    // 3. Create client_notes table
    console.log("3. Creating client_notes table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS client_notes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
        contact_id UUID REFERENCES client_contacts(id) ON DELETE SET NULL,
        user_id UUID NOT NULL,
        note_type TEXT NOT NULL DEFAULT 'general',
        subject TEXT,
        content TEXT NOT NULL,
        is_pinned BOOLEAN DEFAULT false,
        is_private BOOLEAN DEFAULT false,
        follow_up_date DATE,
        follow_up_assigned_to UUID,
        follow_up_completed BOOLEAN DEFAULT false,
        attachments JSONB DEFAULT '[]',
        mentioned_users UUID[],
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Create indexes
      CREATE INDEX IF NOT EXISTS idx_client_notes_client_id ON client_notes(client_id);
      CREATE INDEX IF NOT EXISTS idx_client_notes_user_id ON client_notes(user_id);
      CREATE INDEX IF NOT EXISTS idx_client_notes_created_at ON client_notes(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_client_notes_is_pinned ON client_notes(is_pinned) WHERE is_pinned = true;
      CREATE INDEX IF NOT EXISTS idx_client_notes_follow_up ON client_notes(follow_up_date) WHERE follow_up_date IS NOT NULL;
    `);
    console.log("   ✓ client_notes table created\n");

    // 4. Create client_services table
    console.log("4. Creating client_services table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS client_services (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
        service_type TEXT NOT NULL,
        service_name TEXT NOT NULL,
        description TEXT,
        frequency TEXT DEFAULT 'one_time',
        status TEXT DEFAULT 'active',
        start_date DATE,
        end_date DATE,
        fee_type TEXT DEFAULT 'fixed',
        fee_amount DECIMAL(10,2),
        assigned_to UUID,
        tax_year INTEGER,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Create indexes
      CREATE INDEX IF NOT EXISTS idx_client_services_client_id ON client_services(client_id);
      CREATE INDEX IF NOT EXISTS idx_client_services_status ON client_services(status);
      CREATE INDEX IF NOT EXISTS idx_client_services_tax_year ON client_services(tax_year);
    `);
    console.log("   ✓ client_services table created\n");

    // 5. Create client_tax_filings table
    console.log("5. Creating client_tax_filings table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS client_tax_filings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
        tax_year INTEGER NOT NULL,
        filing_type TEXT NOT NULL,
        status TEXT DEFAULT 'not_started',
        due_date DATE,
        extended_due_date DATE,
        filed_date DATE,
        accepted_date DATE,
        refund_amount DECIMAL(12,2),
        amount_owed DECIMAL(12,2),
        preparer_id UUID,
        reviewer_id UUID,
        notes TEXT,
        efile_status TEXT,
        efile_confirmation TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(client_id, tax_year, filing_type)
      );

      -- Create indexes
      CREATE INDEX IF NOT EXISTS idx_client_tax_filings_client_id ON client_tax_filings(client_id);
      CREATE INDEX IF NOT EXISTS idx_client_tax_filings_tax_year ON client_tax_filings(tax_year);
      CREATE INDEX IF NOT EXISTS idx_client_tax_filings_status ON client_tax_filings(status);
      CREATE INDEX IF NOT EXISTS idx_client_tax_filings_due_date ON client_tax_filings(due_date);
    `);
    console.log("   ✓ client_tax_filings table created\n");

    // 6. Create client_document_requests table
    console.log("6. Creating client_document_requests table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS client_document_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
        tax_filing_id UUID REFERENCES client_tax_filings(id) ON DELETE SET NULL,
        service_id UUID REFERENCES client_services(id) ON DELETE SET NULL,
        document_type TEXT NOT NULL,
        description TEXT,
        status TEXT DEFAULT 'requested',
        requested_date DATE DEFAULT CURRENT_DATE,
        received_date DATE,
        file_id UUID,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Create indexes
      CREATE INDEX IF NOT EXISTS idx_client_document_requests_client_id ON client_document_requests(client_id);
      CREATE INDEX IF NOT EXISTS idx_client_document_requests_status ON client_document_requests(status);
    `);
    console.log("   ✓ client_document_requests table created\n");

    // 7. Create client_deadlines table
    console.log("7. Creating client_deadlines table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS client_deadlines (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
        deadline_type TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        due_date DATE NOT NULL,
        reminder_days INTEGER[] DEFAULT '{7, 3, 1}',
        status TEXT DEFAULT 'upcoming',
        assigned_to UUID,
        tax_year INTEGER,
        linked_filing_id UUID REFERENCES client_tax_filings(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Create indexes
      CREATE INDEX IF NOT EXISTS idx_client_deadlines_client_id ON client_deadlines(client_id);
      CREATE INDEX IF NOT EXISTS idx_client_deadlines_due_date ON client_deadlines(due_date);
      CREATE INDEX IF NOT EXISTS idx_client_deadlines_status ON client_deadlines(status);
    `);
    console.log("   ✓ client_deadlines table created\n");

    // 8. Create client_communications table
    console.log("8. Creating client_communications table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS client_communications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
        contact_id UUID REFERENCES client_contacts(id) ON DELETE SET NULL,
        communication_type TEXT NOT NULL,
        subject TEXT,
        summary TEXT,
        email_message_id TEXT,
        call_id TEXT,
        duration_minutes INTEGER,
        user_id UUID,
        direction TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Create indexes
      CREATE INDEX IF NOT EXISTS idx_client_communications_client_id ON client_communications(client_id);
      CREATE INDEX IF NOT EXISTS idx_client_communications_created_at ON client_communications(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_client_communications_type ON client_communications(communication_type);
    `);
    console.log("   ✓ client_communications table created\n");

    // 9. Create client_relationships table (for referrals and related entities)
    console.log("9. Creating client_relationships table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS client_relationships (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
        related_client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
        relationship_type TEXT NOT NULL,
        description TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(client_id, related_client_id, relationship_type)
      );

      -- Create indexes
      CREATE INDEX IF NOT EXISTS idx_client_relationships_client_id ON client_relationships(client_id);
      CREATE INDEX IF NOT EXISTS idx_client_relationships_related_id ON client_relationships(related_client_id);
    `);
    console.log("   ✓ client_relationships table created\n");

    // 10. Create client_financial_summary table
    console.log("10. Creating client_financial_summary table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS client_financial_summary (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
        tax_year INTEGER NOT NULL,
        gross_income DECIMAL(14,2),
        adjusted_gross_income DECIMAL(14,2),
        total_deductions DECIMAL(14,2),
        taxable_income DECIMAL(14,2),
        total_tax DECIMAL(14,2),
        refund_amount DECIMAL(14,2),
        amount_owed DECIMAL(14,2),
        effective_tax_rate DECIMAL(5,2),
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(client_id, tax_year)
      );

      -- Create indexes
      CREATE INDEX IF NOT EXISTS idx_client_financial_summary_client_id ON client_financial_summary(client_id);
      CREATE INDEX IF NOT EXISTS idx_client_financial_summary_tax_year ON client_financial_summary(tax_year);
    `);
    console.log("   ✓ client_financial_summary table created\n");

    // 11. Enable RLS on all new tables
    console.log("11. Enabling Row Level Security...");
    const tables = [
      'client_contacts',
      'client_notes',
      'client_services',
      'client_tax_filings',
      'client_document_requests',
      'client_deadlines',
      'client_communications',
      'client_relationships',
      'client_financial_summary'
    ];

    for (const table of tables) {
      await client.query(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`);

      // Create permissive policy for authenticated users
      await client.query(`
        DROP POLICY IF EXISTS "${table}_policy" ON ${table};
        CREATE POLICY "${table}_policy" ON ${table}
          FOR ALL
          TO authenticated
          USING (true)
          WITH CHECK (true);
      `);
    }
    console.log("   ✓ RLS enabled on all tables\n");

    // 12. Create updated_at trigger function
    console.log("12. Creating updated_at trigger...");
    await client.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);

    // Add triggers to tables with updated_at
    const tablesWithUpdatedAt = [
      'client_contacts',
      'client_notes',
      'client_services',
      'client_tax_filings',
      'client_document_requests',
      'client_deadlines',
      'client_financial_summary'
    ];

    for (const table of tablesWithUpdatedAt) {
      await client.query(`
        DROP TRIGGER IF EXISTS update_${table}_updated_at ON ${table};
        CREATE TRIGGER update_${table}_updated_at
          BEFORE UPDATE ON ${table}
          FOR EACH ROW
          EXECUTE FUNCTION update_updated_at_column();
      `);
    }
    console.log("   ✓ Updated_at triggers created\n");

    console.log("========================================");
    console.log("All CRM tables created successfully!");
    console.log("========================================\n");

    // Print summary
    console.log("Tables created/modified:");
    console.log("  - clients (enhanced with new columns)");
    console.log("  - client_contacts");
    console.log("  - client_notes");
    console.log("  - client_services");
    console.log("  - client_tax_filings");
    console.log("  - client_document_requests");
    console.log("  - client_deadlines");
    console.log("  - client_communications");
    console.log("  - client_relationships");
    console.log("  - client_financial_summary");

  } catch (error) {
    console.error("Error creating CRM tables:", error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

createCRMTables();
