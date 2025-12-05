/**
 * Create tables for the intelligent email classification system
 *
 * Tables:
 * 1. email_assignment_rules - Smart rules for auto-assigning emails to users/columns
 * 2. email_user_actions - Track user actions for learning
 * 3. email_action_items - Extracted action items from emails
 * 4. email_client_matches - Cached client matches for emails
 * 5. email_classifications - Enhanced AI classification results
 */

import pg from "pg";
const { Client } = pg;

const client = new Client({
  connectionString:
    "postgresql://postgres:ttandSellaBella1234@db.cyygkhwujcrbhzgjqipj.supabase.co:5432/postgres",
  ssl: { rejectUnauthorized: false },
});

async function createTables() {
  await client.connect();
  console.log("Connected to database...");

  try {
    // 1. Email Assignment Rules Table
    console.log("Creating email_assignment_rules table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.email_assignment_rules (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        is_active BOOLEAN NOT NULL DEFAULT true,
        priority INTEGER NOT NULL DEFAULT 0,

        -- Conditions (JSONB for flexibility)
        conditions JSONB NOT NULL DEFAULT '[]',
        condition_operator VARCHAR(10) NOT NULL DEFAULT 'and',

        -- Actions
        assign_to_user_id UUID REFERENCES auth.users(id),
        assign_to_column VARCHAR(100),
        set_priority VARCHAR(20),
        add_tags TEXT[],
        auto_create_task BOOLEAN DEFAULT false,
        task_template_id UUID,

        -- Metadata
        created_by UUID REFERENCES auth.users(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

        -- Rule effectiveness tracking
        times_matched INTEGER DEFAULT 0,
        times_overridden INTEGER DEFAULT 0,
        last_matched_at TIMESTAMPTZ
      );

      CREATE INDEX IF NOT EXISTS idx_assignment_rules_active ON public.email_assignment_rules(is_active, priority DESC);
    `);

    // 2. Email User Actions Table (for learning)
    console.log("Creating email_user_actions table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.email_user_actions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES auth.users(id),
        email_message_id VARCHAR(500) NOT NULL,

        -- Email context
        sender_email VARCHAR(255),
        sender_domain VARCHAR(255),
        subject TEXT,
        ai_category VARCHAR(100),
        ai_priority VARCHAR(20),

        -- User action
        action_type VARCHAR(50) NOT NULL,
        action_value TEXT,

        -- Before/after state
        previous_column VARCHAR(100),
        previous_assignee UUID,
        new_column VARCHAR(100),
        new_assignee UUID,

        -- Timing
        time_to_action_ms INTEGER,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_user_actions_sender ON public.email_user_actions(sender_email, action_type);
      CREATE INDEX IF NOT EXISTS idx_user_actions_domain ON public.email_user_actions(sender_domain, action_type);
      CREATE INDEX IF NOT EXISTS idx_user_actions_category ON public.email_user_actions(ai_category, action_type);
      CREATE INDEX IF NOT EXISTS idx_user_actions_user ON public.email_user_actions(user_id, created_at DESC);
    `);

    // 3. Email Action Items Table
    console.log("Creating email_action_items table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.email_action_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email_message_id VARCHAR(500) NOT NULL,

        -- Action item details
        title VARCHAR(500) NOT NULL,
        description TEXT,
        action_type VARCHAR(50) NOT NULL,

        -- Extracted entities
        mentioned_date TIMESTAMPTZ,
        mentioned_amount DECIMAL(15,2),
        mentioned_document_type VARCHAR(100),
        mentioned_client_name VARCHAR(255),

        -- Status
        status VARCHAR(50) NOT NULL DEFAULT 'pending',
        priority VARCHAR(20) DEFAULT 'medium',

        -- Linking
        assigned_to_user_id UUID REFERENCES auth.users(id),
        created_task_id UUID REFERENCES public.tasks(id),
        linked_client_id UUID REFERENCES public.clients(id),

        -- AI metadata
        confidence DECIMAL(3,2) NOT NULL DEFAULT 0.5,
        extraction_method VARCHAR(50),

        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        completed_at TIMESTAMPTZ
      );

      CREATE INDEX IF NOT EXISTS idx_action_items_email ON public.email_action_items(email_message_id);
      CREATE INDEX IF NOT EXISTS idx_action_items_status ON public.email_action_items(status, priority);
    `);

    // 4. Email Client Matches Table
    console.log("Creating email_client_matches table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.email_client_matches (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email_message_id VARCHAR(500) NOT NULL,
        sender_email VARCHAR(255) NOT NULL,

        -- Match details
        matched_client_id UUID REFERENCES public.clients(id),
        match_type VARCHAR(50) NOT NULL,
        match_confidence DECIMAL(3,2) NOT NULL DEFAULT 0.5,
        match_reason TEXT,

        -- For ambiguous matches
        alternative_client_ids UUID[],

        -- Verification
        is_verified BOOLEAN DEFAULT false,
        verified_by UUID REFERENCES auth.users(id),
        verified_at TIMESTAMPTZ,

        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_client_matches_email ON public.email_client_matches(email_message_id);
      CREATE INDEX IF NOT EXISTS idx_client_matches_sender ON public.email_client_matches(sender_email);
    `);

    // 5. Email Classifications Table (enhanced AI results)
    console.log("Creating email_classifications table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.email_classifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email_message_id VARCHAR(500) NOT NULL UNIQUE,

        -- Basic classification
        category VARCHAR(100) NOT NULL,
        subcategory VARCHAR(100),
        is_business_relevant BOOLEAN NOT NULL DEFAULT true,

        -- Priority scoring (0-100)
        priority_score INTEGER NOT NULL DEFAULT 50,
        priority_factors JSONB,

        -- Sentiment and urgency
        sentiment VARCHAR(20),
        urgency VARCHAR(20),
        requires_response BOOLEAN DEFAULT true,
        response_deadline TIMESTAMPTZ,

        -- AI Summary
        summary TEXT,
        key_points TEXT[],

        -- Extracted entities
        extracted_dates TIMESTAMPTZ[],
        extracted_amounts DECIMAL(15,2)[],
        extracted_document_types TEXT[],
        extracted_names TEXT[],

        -- Assignment suggestion
        suggested_assignee_id UUID REFERENCES auth.users(id),
        suggested_column VARCHAR(100),
        assignment_reason TEXT,

        -- Draft response
        draft_response TEXT,
        draft_response_tone VARCHAR(50),

        -- AI metadata
        model_used VARCHAR(50),
        confidence DECIMAL(3,2) NOT NULL DEFAULT 0.5,
        processing_time_ms INTEGER,
        tokens_used INTEGER,

        -- Threading
        thread_id VARCHAR(500),
        thread_position INTEGER,

        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_classifications_category ON public.email_classifications(category, is_business_relevant);
      CREATE INDEX IF NOT EXISTS idx_classifications_priority ON public.email_classifications(priority_score DESC);
      CREATE INDEX IF NOT EXISTS idx_classifications_thread ON public.email_classifications(thread_id);
    `);

    // 6. User Kanban Columns Table (user-specific columns)
    console.log("Creating email_user_columns table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.email_user_columns (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES auth.users(id),

        column_id VARCHAR(100) NOT NULL,
        title VARCHAR(255) NOT NULL,
        color VARCHAR(50) NOT NULL DEFAULT 'bg-gray-500',
        icon VARCHAR(50),

        position INTEGER NOT NULL DEFAULT 0,
        is_default BOOLEAN DEFAULT false,
        is_visible BOOLEAN DEFAULT true,

        -- Auto-move rules
        auto_complete_after_days INTEGER,
        auto_archive_after_days INTEGER,

        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

        UNIQUE(user_id, column_id)
      );

      CREATE INDEX IF NOT EXISTS idx_user_columns_user ON public.email_user_columns(user_id, position);
    `);

    // 7. Email Task Templates Table
    console.log("Creating email_task_templates table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.email_task_templates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        description TEXT,

        -- Template fields
        task_title_template VARCHAR(500) NOT NULL,
        task_description_template TEXT,
        default_priority VARCHAR(20) DEFAULT 'medium',
        default_due_days INTEGER,

        -- Trigger conditions
        trigger_categories TEXT[],
        trigger_keywords TEXT[],

        is_active BOOLEAN DEFAULT true,
        created_by UUID REFERENCES auth.users(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // 8. Email Response Templates Table
    console.log("Creating email_response_templates table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.email_response_templates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        description TEXT,

        -- Template content
        subject_template VARCHAR(500),
        body_template TEXT NOT NULL,

        -- When to suggest
        trigger_categories TEXT[],
        trigger_keywords TEXT[],
        tone VARCHAR(50) DEFAULT 'professional',

        -- Usage tracking
        times_used INTEGER DEFAULT 0,
        times_modified INTEGER DEFAULT 0,

        is_active BOOLEAN DEFAULT true,
        created_by UUID REFERENCES auth.users(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // Enable realtime for key tables
    console.log("Enabling realtime...");
    try {
      await client.query(`ALTER PUBLICATION supabase_realtime ADD TABLE public.email_action_items;`);
    } catch (e) {
      console.log("email_action_items realtime may already be enabled");
    }
    try {
      await client.query(`ALTER PUBLICATION supabase_realtime ADD TABLE public.email_classifications;`);
    } catch (e) {
      console.log("email_classifications realtime may already be enabled");
    }

    // Enable RLS on all new tables
    console.log("Enabling RLS...");
    await client.query(`
      ALTER TABLE public.email_assignment_rules ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.email_user_actions ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.email_action_items ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.email_client_matches ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.email_classifications ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.email_user_columns ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.email_task_templates ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.email_response_templates ENABLE ROW LEVEL SECURITY;
    `);

    // Create RLS policies for authenticated users
    console.log("Creating RLS policies...");
    const tables = [
      'email_assignment_rules',
      'email_user_actions',
      'email_action_items',
      'email_client_matches',
      'email_classifications',
      'email_user_columns',
      'email_task_templates',
      'email_response_templates'
    ];

    for (const table of tables) {
      try {
        await client.query(`
          CREATE POLICY "Authenticated users can view ${table}" ON public.${table}
            FOR SELECT TO authenticated USING (true);
        `);
        await client.query(`
          CREATE POLICY "Authenticated users can insert ${table}" ON public.${table}
            FOR INSERT TO authenticated WITH CHECK (true);
        `);
        await client.query(`
          CREATE POLICY "Authenticated users can update ${table}" ON public.${table}
            FOR UPDATE TO authenticated USING (true);
        `);
        await client.query(`
          CREATE POLICY "Authenticated users can delete ${table}" ON public.${table}
            FOR DELETE TO authenticated USING (true);
        `);
      } catch (e) {
        console.log(`Policies for ${table} may already exist`);
      }
    }

    console.log("All tables created successfully!");

  } catch (error) {
    console.error("Error creating tables:", error);
    throw error;
  } finally {
    await client.end();
  }
}

createTables();
