-- =====================================================
-- FIX USER CREATION TRIGGER
-- =====================================================
-- This migration fixes the handle_new_user trigger that
-- automatically creates user_profiles when auth users are created.
-- =====================================================

-- Drop existing trigger and function if they exist
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Create improved handle_new_user function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (
    id,
    email,
    full_name,
    role,
    is_active,
    show_in_taskpool,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    'staff',
    true,
    true,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, user_profiles.full_name),
    updated_at = NOW();

  RETURN NEW;
EXCEPTION
  WHEN others THEN
    -- Log the error but don't fail user creation
    RAISE WARNING 'Error in handle_new_user trigger: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON public.user_profiles TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE ON public.user_profiles TO authenticated;

-- Ensure user_profiles has all required columns with defaults
DO $$
BEGIN
  -- Add show_in_taskpool if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'show_in_taskpool'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN show_in_taskpool BOOLEAN DEFAULT true;
  END IF;

  -- Add department if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'department'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN department TEXT;
  END IF;

  -- Add job_title if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'job_title'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN job_title TEXT;
  END IF;

  -- Add last_login if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'last_login'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN last_login TIMESTAMPTZ;
  END IF;
END $$;

-- =====================================================
-- SUMMARY
-- =====================================================
-- This migration:
-- 1. Recreates the handle_new_user trigger with error handling
-- 2. Uses ON CONFLICT to handle duplicate inserts gracefully
-- 3. Adds missing columns to user_profiles if needed
-- 4. Grants proper permissions
-- =====================================================
