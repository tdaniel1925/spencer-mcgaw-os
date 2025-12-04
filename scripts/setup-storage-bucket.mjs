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

async function setupStorageBucket() {
  console.log("Setting up storage bucket...\n");

  // 1. Create the bucket
  console.log("1. Creating 'files' bucket...");
  const { data: bucketData, error: bucketError } = await supabase.storage.createBucket("files", {
    public: false,
    fileSizeLimit: 52428800, // 50MB
  });

  if (bucketError) {
    if (bucketError.message.includes("already exists")) {
      console.log("   ✓ Bucket 'files' already exists\n");
    } else {
      console.error("   ✗ Error creating bucket:", bucketError.message);
      return;
    }
  } else {
    console.log("   ✓ Bucket 'files' created successfully\n");
  }

  // 2. Note about policies
  console.log("2. Storage policies need to be set up in the Supabase Dashboard:");
  console.log("   Go to: Storage → files bucket → Policies tab\n");
  console.log("   Or run this SQL in the SQL Editor:\n");

  const policySql = `
-- Storage policies for the files bucket
-- Run this in Supabase SQL Editor

-- Allow authenticated users to upload files
CREATE POLICY "Allow authenticated uploads"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'files');

-- Allow authenticated users to read files
CREATE POLICY "Allow authenticated reads"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'files');

-- Allow authenticated users to update files
CREATE POLICY "Allow authenticated updates"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'files');

-- Allow authenticated users to delete files
CREATE POLICY "Allow authenticated deletes"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'files');
`;

  console.log(policySql);
  console.log("\n✓ Storage bucket setup complete!");
  console.log("\nNext steps:");
  console.log("1. Copy the SQL above and run it in Supabase SQL Editor");
  console.log("2. Or manually create policies in Storage → files → Policies");
}

setupStorageBucket().catch(console.error);
