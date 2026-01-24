-- Add RPC functions for atomic quota management
-- Run this migration against your Supabase database

-- Function 1: Check and reserve quota atomically
-- This prevents race conditions where multiple uploads could exceed quota
CREATE OR REPLACE FUNCTION check_and_reserve_quota(
  p_user_id UUID,
  p_bytes BIGINT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_used BIGINT;
  v_quota_limit BIGINT;
BEGIN
  -- Get current quota usage with row lock
  SELECT used_bytes, quota_bytes
  INTO v_current_used, v_quota_limit
  FROM storage_quotas
  WHERE user_id = p_user_id
  FOR UPDATE;

  -- If no quota record exists, create one with default 10GB limit
  IF NOT FOUND THEN
    INSERT INTO storage_quotas (user_id, used_bytes, file_count, quota_bytes)
    VALUES (p_user_id, 0, 0, 10737418240) -- 10GB default
    RETURNING used_bytes, quota_bytes INTO v_current_used, v_quota_limit;
  END IF;

  -- Check if adding this file would exceed quota
  IF (v_current_used + p_bytes) > v_quota_limit THEN
    RETURN FALSE; -- Quota would be exceeded
  END IF;

  -- Reserve the quota by incrementing used_bytes
  UPDATE storage_quotas
  SET
    used_bytes = used_bytes + p_bytes,
    file_count = file_count + 1,
    updated_at = NOW()
  WHERE user_id = p_user_id;

  RETURN TRUE; -- Quota reserved successfully
END;
$$;

-- Function 2: Increment or decrement storage usage
-- Used for rollbacks and quota adjustments
CREATE OR REPLACE FUNCTION increment_storage_usage(
  p_user_id UUID,
  p_bytes BIGINT -- Can be negative for decrements
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update or insert quota record
  INSERT INTO storage_quotas (user_id, used_bytes, file_count, quota_bytes)
  VALUES (p_user_id, GREATEST(0, p_bytes), CASE WHEN p_bytes > 0 THEN 1 ELSE 0 END, 10737418240)
  ON CONFLICT (user_id)
  DO UPDATE SET
    used_bytes = GREATEST(0, storage_quotas.used_bytes + p_bytes),
    file_count = CASE
      WHEN p_bytes > 0 THEN storage_quotas.file_count + 1
      WHEN p_bytes < 0 THEN GREATEST(0, storage_quotas.file_count - 1)
      ELSE storage_quotas.file_count
    END,
    updated_at = NOW();
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION check_and_reserve_quota(UUID, BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_storage_usage(UUID, BIGINT) TO authenticated;

-- Add helpful comments
COMMENT ON FUNCTION check_and_reserve_quota IS 'Atomically checks if user has enough quota and reserves it if available. Returns TRUE if quota reserved, FALSE if would exceed limit.';
COMMENT ON FUNCTION increment_storage_usage IS 'Increments (positive) or decrements (negative) a users storage usage. Creates quota record if it doesnt exist.';
