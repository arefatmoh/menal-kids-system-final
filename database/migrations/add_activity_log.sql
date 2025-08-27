-- Activity Log schema and functions (Step 1)
-- Idempotent creation of base table and helper functions

-- Extensions (if not already enabled)
DO $$
BEGIN
  -- gen_random_uuid() (pgcrypto) or use uuid-ossp depending on environment
  PERFORM 1 FROM pg_extension WHERE extname = 'pgcrypto';
  IF NOT FOUND THEN
    BEGIN
      CREATE EXTENSION IF NOT EXISTS pgcrypto;
    EXCEPTION WHEN OTHERS THEN
      -- Ignore if lack of permission; fallback will use uuid_generate_v4 if available
      NULL;
    END;
  END IF;
END$$;

-- Base table
CREATE TABLE IF NOT EXISTS activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN (
    'sell','stock_add','stock_reduce','product_create','product_update','expense_add','transfer','refund','restore','edit_correction'
  )),
  title TEXT,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed','reversed')),

  branch_id UUID,
  user_id UUID,

  related_entity_type TEXT,
  related_entity_id UUID,

  delta JSONB,      -- concise summary of changes (e.g., stock deltas, amounts)
  metadata JSONB,   -- extra info (client, payment method, etc.)

  parent_activity_id UUID,  -- for restores/edits referencing original activity
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS activities_created_at_idx ON activities (created_at DESC);
CREATE INDEX IF NOT EXISTS activities_type_idx ON activities (type);
CREATE INDEX IF NOT EXISTS activities_branch_idx ON activities (branch_id);
CREATE INDEX IF NOT EXISTS activities_user_idx ON activities (user_id);
CREATE INDEX IF NOT EXISTS activities_related_idx ON activities (related_entity_type, related_entity_id);

-- get_recent_activities: returns the last N activities with simple filters
DROP FUNCTION IF EXISTS get_recent_activities(INT, TEXT, UUID, UUID) CASCADE;
CREATE OR REPLACE FUNCTION get_recent_activities(
  p_limit INT DEFAULT 100,
  p_type TEXT DEFAULT NULL,
  p_branch_id UUID DEFAULT NULL,
  p_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  type TEXT,
  title TEXT,
  description TEXT,
  status TEXT,
  branch_id UUID,
  user_id UUID,
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

-- get_activity_detail: returns a full row for a given activity id
DROP FUNCTION IF EXISTS get_activity_detail(UUID) CASCADE;
CREATE OR REPLACE FUNCTION get_activity_detail(p_id UUID)
RETURNS activities AS $$
DECLARE
  rec activities;
BEGIN
  SELECT * INTO rec FROM activities WHERE id = p_id;
  RETURN rec;
END;
$$ LANGUAGE plpgsql STABLE;

-- restore_activity: idempotent status flip and a matching 'restore' record
-- NOTE: Business-specific side effects (restock, refund, inverse transfer) will be added in step 3.
DROP FUNCTION IF EXISTS restore_activity(UUID, UUID, TEXT) CASCADE;
CREATE OR REPLACE FUNCTION restore_activity(
  p_activity_id UUID,
  p_actor_id UUID,
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

  -- Already reversed? idempotent behavior
  IF v_activity.status = 'reversed' THEN
    RETURN QUERY SELECT false, v_activity.id, NULL::UUID, 'Activity already reversed';
    RETURN;
  END IF;

  -- In a full implementation, side effects per type occur here (restock, refund, etc.)
  -- For step 1, we only log the restore and flip status safely.

  PERFORM 1;
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


