import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://cyygkhwujcrbhzgjqipj.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN5eWdraHd1amNyYmh6Z2pxaXBqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDc0MDk4NywiZXhwIjoyMDgwMzE2OTg3fQ.A307u4qstiXj_AWbLxaD1mhP9DUD_ImMWNYqKU1N7JI';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setupStorageBucket() {
  try {
    console.log('\n🚀 Setting up Supabase storage bucket...\n');

    const { data: buckets, error: listError } = await supabase.storage.listBuckets();

    if (listError) {
      console.error('❌ Failed to list buckets:', listError.message);
      process.exit(1);
    }

    const filesBucket = buckets.find(b => b.name === 'files');

    if (filesBucket) {
      console.log('✅ Storage bucket "files" already exists');
      console.log(`   ID: ${filesBucket.id}`);
      console.log(`   Public: ${filesBucket.public}`);
    } else {
      const { data: newBucket, error: createError } = await supabase.storage.createBucket('files', {
        public: false,
        fileSizeLimit: 104857600,
      });

      if (createError) {
        console.error('❌ Failed to create bucket:', createError.message);
        process.exit(1);
      }

      console.log('✅ Created storage bucket "files"');
    }

    console.log('\n✅ Storage bucket setup complete!\n');

  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
    process.exit(1);
  }
}

setupStorageBucket();
