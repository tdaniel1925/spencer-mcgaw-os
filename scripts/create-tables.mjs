import pg from "pg";
const { Client } = pg;

const client = new Client({
  connectionString:
    "postgresql://postgres:ttandSellaBella1234@db.cyygkhwujcrbhzgjqipj.supabase.co:5432/postgres",
  ssl: { rejectUnauthorized: false },
});

async function createTables() {
  try {
    await client.connect();
    console.log("Connected to database");

    // Create email_training_feedback table
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.email_training_feedback (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        created_at TIMESTAMPTZ DEFAULT now(),
        email_message_id TEXT NOT NULL,
        sender_email TEXT NOT NULL,
        sender_domain TEXT NOT NULL,
        subject TEXT,
        original_classification TEXT NOT NULL,
        user_classification TEXT NOT NULL,
        original_category TEXT,
        created_by UUID REFERENCES auth.users(id)
      );
    `);
    console.log("Created email_training_feedback table");

    // Create email_sender_rules table
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.email_sender_rules (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now(),
        created_by UUID REFERENCES auth.users(id),
        rule_type TEXT NOT NULL,
        match_type TEXT NOT NULL,
        match_value TEXT NOT NULL,
        action TEXT NOT NULL,
        reason TEXT,
        is_active BOOLEAN DEFAULT true,
        UNIQUE(rule_type, match_type, match_value)
      );
    `);
    console.log("Created email_sender_rules table");

    // Create app_settings table
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.app_settings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        key TEXT NOT NULL UNIQUE,
        value JSONB,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now(),
        updated_by UUID REFERENCES auth.users(id)
      );
    `);
    console.log("Created app_settings table");

    // Create tasks table
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.tasks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now(),
        title TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        priority TEXT NOT NULL DEFAULT 'medium',
        due_date TIMESTAMPTZ,
        completed_at TIMESTAMPTZ,
        client_id UUID REFERENCES public.clients(id),
        client_name TEXT,
        assignee_id UUID REFERENCES auth.users(id),
        assignee_name TEXT,
        source TEXT DEFAULT 'manual',
        source_id TEXT,
        created_by UUID REFERENCES auth.users(id),
        tags TEXT[],
        estimated_minutes INTEGER,
        actual_minutes INTEGER
      );
    `);
    console.log("Created tasks table");

    // Create activity_log table for audit trail
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.activity_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        created_at TIMESTAMPTZ DEFAULT now(),
        user_id UUID REFERENCES auth.users(id),
        user_name TEXT,
        user_email TEXT,
        action TEXT NOT NULL,
        resource_type TEXT NOT NULL,
        resource_id TEXT,
        resource_name TEXT,
        details JSONB,
        ip_address TEXT,
        user_agent TEXT
      );
    `);
    console.log("Created activity_log table");

    // Enable RLS
    await client.query(`
      ALTER TABLE public.email_training_feedback ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.email_sender_rules ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
    `);
    console.log("Enabled RLS");

    // Drop existing policies
    const dropPolicies = [
      "DROP POLICY IF EXISTS \"Users can view all training feedback\" ON public.email_training_feedback",
      "DROP POLICY IF EXISTS \"Users can insert training feedback\" ON public.email_training_feedback",
      "DROP POLICY IF EXISTS \"Users can view all sender rules\" ON public.email_sender_rules",
      "DROP POLICY IF EXISTS \"Users can insert sender rules\" ON public.email_sender_rules",
      "DROP POLICY IF EXISTS \"Users can update sender rules\" ON public.email_sender_rules",
      "DROP POLICY IF EXISTS \"Users can view app settings\" ON public.app_settings",
      "DROP POLICY IF EXISTS \"Users can insert app settings\" ON public.app_settings",
      "DROP POLICY IF EXISTS \"Users can update app settings\" ON public.app_settings",
      "DROP POLICY IF EXISTS \"Users can delete app settings\" ON public.app_settings",
    ];

    for (const sql of dropPolicies) {
      await client.query(sql);
    }
    console.log("Dropped existing policies");

    // Create policies
    await client.query(`
      CREATE POLICY "Users can view all training feedback" ON public.email_training_feedback FOR SELECT TO authenticated USING (true);
    `);
    await client.query(`
      CREATE POLICY "Users can insert training feedback" ON public.email_training_feedback FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
    `);
    await client.query(`
      CREATE POLICY "Users can view all sender rules" ON public.email_sender_rules FOR SELECT TO authenticated USING (true);
    `);
    await client.query(`
      CREATE POLICY "Users can insert sender rules" ON public.email_sender_rules FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
    `);
    await client.query(`
      CREATE POLICY "Users can update sender rules" ON public.email_sender_rules FOR UPDATE TO authenticated USING (true);
    `);
    await client.query(`
      CREATE POLICY "Users can view app settings" ON public.app_settings FOR SELECT TO authenticated USING (true);
    `);
    await client.query(`
      CREATE POLICY "Users can insert app settings" ON public.app_settings FOR INSERT TO authenticated WITH CHECK (true);
    `);
    await client.query(`
      CREATE POLICY "Users can update app settings" ON public.app_settings FOR UPDATE TO authenticated USING (true);
    `);
    await client.query(`
      CREATE POLICY "Users can delete app settings" ON public.app_settings FOR DELETE TO authenticated USING (true);
    `);

    // Tasks policies
    await client.query(`
      CREATE POLICY "Users can view all tasks" ON public.tasks FOR SELECT TO authenticated USING (true);
    `);
    await client.query(`
      CREATE POLICY "Users can insert tasks" ON public.tasks FOR INSERT TO authenticated WITH CHECK (true);
    `);
    await client.query(`
      CREATE POLICY "Users can update tasks" ON public.tasks FOR UPDATE TO authenticated USING (true);
    `);
    await client.query(`
      CREATE POLICY "Users can delete tasks" ON public.tasks FOR DELETE TO authenticated USING (true);
    `);

    // Activity log policies
    await client.query(`
      CREATE POLICY "Users can view activity log" ON public.activity_log FOR SELECT TO authenticated USING (true);
    `);
    await client.query(`
      CREATE POLICY "Users can insert activity log" ON public.activity_log FOR INSERT TO authenticated WITH CHECK (true);
    `);
    console.log("Created RLS policies");

    // Create indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_email_training_feedback_sender_domain ON public.email_training_feedback(sender_domain);
      CREATE INDEX IF NOT EXISTS idx_email_training_feedback_sender_email ON public.email_training_feedback(sender_email);
      CREATE INDEX IF NOT EXISTS idx_email_sender_rules_match_value ON public.email_sender_rules(match_value);
      CREATE INDEX IF NOT EXISTS idx_email_sender_rules_action ON public.email_sender_rules(action);
      CREATE INDEX IF NOT EXISTS idx_app_settings_key ON public.app_settings(key);
      CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);
      CREATE INDEX IF NOT EXISTS idx_tasks_priority ON public.tasks(priority);
      CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON public.tasks(due_date);
      CREATE INDEX IF NOT EXISTS idx_tasks_client_id ON public.tasks(client_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_assignee_id ON public.tasks(assignee_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON public.tasks(created_at);
      CREATE INDEX IF NOT EXISTS idx_activity_log_user_id ON public.activity_log(user_id);
      CREATE INDEX IF NOT EXISTS idx_activity_log_resource_type ON public.activity_log(resource_type);
      CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON public.activity_log(created_at);
    `);
    console.log("Created indexes");

    console.log("All tables created successfully!");
  } catch (error) {
    console.error("Error creating tables:", error);
  } finally {
    await client.end();
  }
}

createTables();
