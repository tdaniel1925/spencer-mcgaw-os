import pg from "pg";

const { Client } = pg;

const client = new Client({
  connectionString:
    "postgresql://postgres:ttandSellaBella1234@db.cyygkhwujcrbhzgjqipj.supabase.co:5432/postgres",
  ssl: { rejectUnauthorized: false },
});

async function addShowInTaskpoolColumn() {
  await client.connect();

  try {
    // First, create the user_profiles table if it doesn't exist
    console.log("Creating user_profiles table if it doesn't exist...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.user_profiles (
        id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
        email TEXT NOT NULL,
        full_name TEXT,
        avatar_url TEXT,
        show_in_taskpool BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      );
    `);
    console.log("user_profiles table ready!");

    // Enable RLS
    await client.query(`
      ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
    `);

    // Create policy for authenticated users to read all profiles
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_policies
          WHERE tablename = 'user_profiles' AND policyname = 'Users can view all profiles'
        ) THEN
          CREATE POLICY "Users can view all profiles" ON public.user_profiles
            FOR SELECT USING (auth.role() = 'authenticated');
        END IF;
      END $$;
    `);

    // Create policy for users to update their own profile
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_policies
          WHERE tablename = 'user_profiles' AND policyname = 'Users can update own profile'
        ) THEN
          CREATE POLICY "Users can update own profile" ON public.user_profiles
            FOR UPDATE USING (auth.uid() = id);
        END IF;
      END $$;
    `);

    // Create admin policy
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_policies
          WHERE tablename = 'user_profiles' AND policyname = 'Admins can update all profiles'
        ) THEN
          CREATE POLICY "Admins can update all profiles" ON public.user_profiles
            FOR ALL USING (true);
        END IF;
      END $$;
    `);

    console.log("Adding show_in_taskpool column if it doesn't exist...");

    // Add column if table existed but column doesn't
    await client.query(`
      ALTER TABLE public.user_profiles
      ADD COLUMN IF NOT EXISTS show_in_taskpool BOOLEAN DEFAULT true;
    `);

    console.log("Column added successfully!");

    // Verify the column exists
    const result = await client.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'user_profiles' AND column_name = 'show_in_taskpool';
    `);

    console.log("Column info:", result.rows);

  } catch (error) {
    console.error("Error adding column:", error);
    throw error;
  } finally {
    await client.end();
  }
}

addShowInTaskpoolColumn().catch(console.error);
