import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, "..", ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
});

async function createStoragePolicies() {
  console.log("Creating storage policies for 'files' bucket...\n");

  const policies = [
    {
      name: "Allow authenticated uploads",
      operation: "INSERT",
      definition: "bucket_id = 'files'",
    },
    {
      name: "Allow authenticated reads",
      operation: "SELECT",
      definition: "bucket_id = 'files'",
    },
    {
      name: "Allow authenticated updates",
      operation: "UPDATE",
      definition: "bucket_id = 'files'",
    },
    {
      name: "Allow authenticated deletes",
      operation: "DELETE",
      definition: "bucket_id = 'files'",
    },
  ];

  // Execute each policy creation via raw SQL
  for (const policy of policies) {
    const isCheck = policy.operation === "INSERT";
    const clause = isCheck ? "WITH CHECK" : "USING";

    const sql = `
      DROP POLICY IF EXISTS "${policy.name}" ON storage.objects;
      CREATE POLICY "${policy.name}"
      ON storage.objects FOR ${policy.operation}
      TO authenticated
      ${clause} (${policy.definition});
    `;

    const { error } = await supabase.rpc("exec_sql", { sql_query: sql });

    if (error) {
      // Try alternative approach - direct execution might not be supported
      console.log(`   Note: ${policy.name} - needs manual creation`);
    } else {
      console.log(`   ✓ Created: ${policy.name}`);
    }
  }

  console.log("\n========================================");
  console.log("If policies weren't created automatically,");
  console.log("run this SQL in Supabase SQL Editor:");
  console.log("========================================\n");

  console.log(`
-- Drop existing policies (if any)
DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated reads" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated updates" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated deletes" ON storage.objects;

-- Create storage policies for the files bucket
CREATE POLICY "Allow authenticated uploads"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'files');

CREATE POLICY "Allow authenticated reads"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'files');

CREATE POLICY "Allow authenticated updates"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'files');

CREATE POLICY "Allow authenticated deletes"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'files');
`);
}

createStoragePolicies().catch(console.error);
