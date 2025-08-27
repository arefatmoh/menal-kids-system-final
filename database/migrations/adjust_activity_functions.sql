-- Adjust activity functions to accept TEXT identifiers for branch_id and user_id

-- Replace get_recent_activities to use TEXT for IDs and compare via ::text
DROP FUNCTION IF EXISTS get_recent_activities(INT, TEXT, UUID, UUID) CASCADE;
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
    AND (p_branch_id IS NULL OR a.branch_id::text = p_branch_id)
    AND (p_user_id IS NULL OR a.user_id::text = p_user_id)
  ORDER BY a.created_at DESC
  LIMIT COALESCE(NULLIF(p_limit, 0), 100);
END;
$$ LANGUAGE plpgsql STABLE;


