-- Adjust activities schema to use TEXT identifiers for branch_id and user_id

-- Change column types where needed
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'activities' AND column_name = 'branch_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE activities ALTER COLUMN branch_id TYPE TEXT USING branch_id::text;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'activities' AND column_name = 'user_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE activities ALTER COLUMN user_id TYPE TEXT USING user_id::text;
  END IF;
END$$;

-- Update get_recent_activities return types and comparisons to TEXT
DROP FUNCTION IF EXISTS get_recent_activities(INT, TEXT, TEXT, TEXT) CASCADE;
CREATE OR REPLACE FUNCTION get_recent_activities(
  p_limit INT DEFAULT 100,
  p_type TEXT DEFAULT NULL,
  p_branch_id TEXT DEFAULT NULL,
  p_user_id TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  type TEXT,
  title TEXT,
  description TEXT,
  status TEXT,
  branch_id TEXT,
  user_id TEXT,
  related_entity_type TEXT,
  related_entity_id UUID,
  delta JSONB,
  metadata JSONB,
  parent_activity_id UUID,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT a.id, a.type, a.title, a.description, a.status,
         a.branch_id, a.user_id,
         a.related_entity_type, a.related_entity_id,
         a.delta, a.metadata, a.parent_activity_id,
         a.created_at
  FROM activities a
  WHERE (p_type IS NULL OR a.type = p_type)
    AND (p_branch_id IS NULL OR a.branch_id = p_branch_id)
    AND (p_user_id IS NULL OR a.user_id = p_user_id)
  ORDER BY a.created_at DESC
  LIMIT COALESCE(NULLIF(p_limit, 0), 100);
END;
$$ LANGUAGE plpgsql STABLE;

-- Update restore_activity to accept TEXT user_id and insert accordingly
DROP FUNCTION IF EXISTS restore_activity(UUID, UUID, TEXT) CASCADE;
CREATE OR REPLACE FUNCTION restore_activity(
  p_activity_id UUID,
  p_actor_id TEXT,
  p_reason TEXT DEFAULT 'User-initiated restore'
)
RETURNS TABLE (
  restored BOOLEAN,
  original_id UUID,
  restore_id UUID,
  message TEXT
) AS $$
DECLARE
  v_activity activities;
  v_restore_id UUID;
BEGIN
  SELECT * INTO v_activity FROM activities WHERE id = p_activity_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, p_activity_id, NULL::UUID, 'Activity not found';
    RETURN;
  END IF;

  IF v_activity.status = 'reversed' THEN
    RETURN QUERY SELECT false, v_activity.id, NULL::UUID, 'Activity already reversed';
    RETURN;
  END IF;

  UPDATE activities SET status = 'reversed' WHERE id = v_activity.id;

  INSERT INTO activities (
    type, title, description, status,
    branch_id, user_id,
    related_entity_type, related_entity_id,
    delta, metadata,
    parent_activity_id
  )
  VALUES (
    'restore',
    CONCAT('Restore: ', COALESCE(v_activity.title, v_activity.type)),
    p_reason,
    'completed',
    v_activity.branch_id,
    p_actor_id,
    v_activity.related_entity_type,
    v_activity.related_entity_id,
    jsonb_build_object('restored_activity_id', v_activity.id, 'original_type', v_activity.type),
    jsonb_build_object('reason', p_reason),
    v_activity.id
  )
  RETURNING id INTO v_restore_id;

  RETURN QUERY SELECT true, v_activity.id, v_restore_id, 'Restore logged';
END;
$$ LANGUAGE plpgsql VOLATILE;


