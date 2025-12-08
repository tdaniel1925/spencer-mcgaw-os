import pg from "pg";

const { Client } = pg;

const client = new Client({
  connectionString:
    "postgresql://postgres:ttandSellaBella1234@db.cyygkhwujcrbhzgjqipj.supabase.co:5432/postgres",
  ssl: { rejectUnauthorized: false },
});

async function setupUserProfilesSync() {
  await client.connect();

  try {
    console.log("Setting up user_profiles sync...");

    // Create or replace the function to handle new user signups
    await client.query(`
      CREATE OR REPLACE FUNCTION public.handle_new_user()
      RETURNS TRIGGER AS $$
      BEGIN
        INSERT INTO public.user_profiles (id, email, full_name, show_in_taskpool)
        VALUES (
          NEW.id,
          NEW.email,
          COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
          true
        )
        ON CONFLICT (id) DO UPDATE SET
          email = EXCLUDED.email,
          updated_at = now();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;
    `);
    console.log("Created handle_new_user function");

    // Drop existing trigger if exists and create new one
    await client.query(`
      DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
    `);

    await client.query(`
      CREATE TRIGGER on_auth_user_created
        AFTER INSERT ON auth.users
        FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
    `);
    console.log("Created trigger for new user signups");

    // Sync existing auth users to user_profiles
    console.log("Syncing existing users...");
    const result = await client.query(`
      INSERT INTO public.user_profiles (id, email, full_name, show_in_taskpool)
      SELECT
        id,
        email,
        COALESCE(raw_user_meta_data->>'full_name', split_part(email, '@', 1)),
        true
      FROM auth.users
      ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        updated_at = now()
      RETURNING id, email, full_name;
    `);
    console.log("Synced users:", result.rows);

    // Verify
    const profiles = await client.query('SELECT * FROM public.user_profiles');
    console.log("Current user_profiles:", profiles.rows);

  } catch (error) {
    console.error("Error:", error);
    throw error;
  } finally {
    await client.end();
  }
}

setupUserProfilesSync().catch(console.error);
