import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env.local manually
const envPath = join(__dirname, '..', '.env.local');
const envContent = readFileSync(envPath, 'utf-8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) {
    envVars[match[1].trim()] = match[2].trim();
  }
});

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = envVars.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
  console.log('URL:', supabaseUrl);
  console.log('Key:', supabaseServiceKey ? 'Present' : 'Missing');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createPermissionOverridesTable() {
  console.log('Creating user_permission_overrides table...');
  console.log('Using Supabase URL:', supabaseUrl);

  // Try to query the table first to see if it exists
  const { data: existingData, error: checkError } = await supabase
    .from('user_permission_overrides')
    .select('id')
    .limit(1);

  if (!checkError) {
    console.log('Table already exists!');
    return;
  }

  console.log('Table does not exist, creating via Supabase Dashboard SQL...');
  console.log('\nPlease run the following SQL in your Supabase Dashboard (SQL Editor):\n');
  console.log(`
CREATE TABLE IF NOT EXISTS user_permission_overrides (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL,
  permission text NOT NULL,
  granted boolean NOT NULL DEFAULT true,
  granted_by uuid REFERENCES user_profiles(id),
  reason text,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, permission)
);

CREATE INDEX IF NOT EXISTS idx_permission_overrides_user ON user_permission_overrides(user_id);
CREATE INDEX IF NOT EXISTS idx_permission_overrides_permission ON user_permission_overrides(permission);

-- Enable RLS
ALTER TABLE user_permission_overrides ENABLE ROW LEVEL SECURITY;

-- Policy: Admins and owners can view all permission overrides
CREATE POLICY "Admins can view all permission overrides"
  ON user_permission_overrides FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );

-- Policy: Users can view their own permission overrides
CREATE POLICY "Users can view own permission overrides"
  ON user_permission_overrides FOR SELECT
  USING (user_id = auth.uid());

-- Policy: Only owners can manage permission overrides
CREATE POLICY "Owners can manage permission overrides"
  ON user_permission_overrides FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'owner'
    )
  );
  `);
}

createPermissionOverridesTable().catch(console.error);
