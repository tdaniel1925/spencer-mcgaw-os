import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://cyygkhwujcrbhzgjqipj.supabase.co";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Note: This script requires the service role key to create buckets
// Run with: SUPABASE_SERVICE_ROLE_KEY=your_key node scripts/setup-storage-bucket.mjs
// Or manually create the bucket in Supabase dashboard

async function setupStorageBucket() {
  if (!supabaseServiceKey) {
    console.log(`
===============================================
MANUAL SETUP REQUIRED
===============================================

To create the storage bucket, go to your Supabase dashboard:

1. Navigate to: https://supabase.com/dashboard/project/cyygkhwujcrbhzgjqipj/storage/buckets

2. Click "New bucket"

3. Create a bucket with these settings:
   - Name: files
   - Public: OFF (unchecked)
   - File size limit: 50MB (or higher as needed)
   - Allowed MIME types: Leave empty to allow all

4. After creating, go to "Policies" tab and add these policies:

   SELECT (read files):
   - Policy name: "Users can read own files"
   - Target roles: authenticated
   - Policy: (bucket_id = 'files' AND auth.uid()::text = (storage.foldername(name))[1])

   INSERT (upload files):
   - Policy name: "Users can upload files"
   - Target roles: authenticated
   - Policy: (bucket_id = 'files' AND auth.uid()::text = (storage.foldername(name))[1])

   UPDATE (update files):
   - Policy name: "Users can update own files"
   - Target roles: authenticated
   - Policy: (bucket_id = 'files' AND auth.uid()::text = (storage.foldername(name))[1])

   DELETE (delete files):
   - Policy name: "Users can delete own files"
   - Target roles: authenticated
   - Policy: (bucket_id = 'files' AND auth.uid()::text = (storage.foldername(name))[1])

===============================================
    `);
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  try {
    // Check if bucket exists
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();

    if (listError) {
      console.error("Error listing buckets:", listError);
      return;
    }

    const existingBucket = buckets?.find(b => b.name === "files");

    if (existingBucket) {
      console.log("✓ 'files' bucket already exists");
    } else {
      // Create the bucket
      const { error: createError } = await supabase.storage.createBucket("files", {
        public: false,
        fileSizeLimit: 52428800, // 50MB
        allowedMimeTypes: null, // Allow all
      });

      if (createError) {
        console.error("Error creating bucket:", createError);
        return;
      }

      console.log("✓ Created 'files' bucket");
    }

    console.log(`
Storage bucket setup complete!

The bucket uses path-based access control:
- Files are stored at: {user_id}/{folder_id}/{file_id}-{filename}
- Users can only access files in their own path

Storage policies should allow authenticated users to:
- Read files in their path
- Upload files to their path
- Update files in their path
- Delete files in their path
    `);

  } catch (error) {
    console.error("Error setting up storage:", error);
  }
}

setupStorageBucket();
