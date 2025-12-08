import pg from "pg";

const { Client } = pg;

const client = new Client({
  connectionString:
    "postgresql://postgres:ttandSellaBella1234@db.cyygkhwujcrbhzgjqipj.supabase.co:5432/postgres",
  ssl: { rejectUnauthorized: false },
});

async function createKanbanColumnsTable() {
  await client.connect();

  try {
    console.log("Creating kanban_columns table...");

    // Create the kanban_columns table
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.kanban_columns (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID,
        code TEXT NOT NULL,
        label TEXT NOT NULL,
        icon TEXT DEFAULT 'circle',
        color TEXT DEFAULT 'gray',
        sort_order INTEGER DEFAULT 0,
        is_default BOOLEAN DEFAULT false,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now(),
        UNIQUE(organization_id, code)
      );
    `);
    console.log("Created kanban_columns table");

    // Enable RLS
    await client.query(`
      ALTER TABLE public.kanban_columns ENABLE ROW LEVEL SECURITY;
    `);
    console.log("Enabled RLS on kanban_columns");

    // Create policy
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_policies WHERE tablename = 'kanban_columns' AND policyname = 'Enable all for authenticated users'
        ) THEN
          CREATE POLICY "Enable all for authenticated users" ON public.kanban_columns
            FOR ALL USING (true) WITH CHECK (true);
        END IF;
      END $$;
    `);
    console.log("Created RLS policy");

    // Insert default columns if none exist
    const { rows } = await client.query(`SELECT COUNT(*) FROM public.kanban_columns`);
    if (parseInt(rows[0].count) === 0) {
      console.log("Inserting default columns...");
      await client.query(`
        INSERT INTO public.kanban_columns (code, label, icon, color, sort_order, is_default) VALUES
        ('open', 'To Do', 'circle', 'gray', 0, true),
        ('in_progress', 'In Progress', 'play-circle', 'blue', 1, true),
        ('review', 'Review', 'eye', 'orange', 2, true),
        ('completed', 'Done', 'check-circle', 'green', 3, true);
      `);
      console.log("Inserted default columns");
    }

    // Verify
    const result = await client.query(`
      SELECT * FROM public.kanban_columns ORDER BY sort_order;
    `);
    console.log("Kanban columns:", result.rows);

    console.log("\nKanban columns table created successfully!");

  } catch (error) {
    console.error("Error:", error);
    throw error;
  } finally {
    await client.end();
  }
}

createKanbanColumnsTable().catch(console.error);
