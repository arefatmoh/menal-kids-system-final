-- Fix stock movement duplication and recent activities duplicates

-- Update the recent activities function to deduplicate stock movements
CREATE OR REPLACE FUNCTION get_recent_activities(p_branch_id VARCHAR(50) DEFAULT NULL, p_limit INTEGER DEFAULT 10)
RETURNS TABLE (
    activity_type VARCHAR,
    description TEXT,
    branch_name VARCHAR,
    user_name VARCHAR,
    created_at TIMESTAMP,
    reference_id UUID
) AS $$
BEGIN
    RETURN QUERY
    (
        -- Sales activities
        SELECT 
            'sale'::VARCHAR as activity_type,
            ('Sale of ' || COALESCE(SUM(si.quantity), 0) || ' items for $' || s.total_amount)::TEXT as description,
            b.name as branch_name,
            u.full_name as user_name,
            s.created_at,
            s.id as reference_id
        FROM sales s
        JOIN branches b ON s.branch_id = b.id
        JOIN users u ON s.user_id = u.id
        LEFT JOIN sale_items si ON s.id = si.sale_id
        WHERE (p_branch_id IS NULL OR s.branch_id = p_branch_id)
        GROUP BY s.id, b.name, u.full_name, s.total_amount, s.created_at
        
        UNION ALL
        
        -- Stock movements activities (deduplicated)
        SELECT DISTINCT ON (sm.product_id, sm.branch_id, sm.movement_type, sm.quantity, DATE(sm.created_at))
            ('stock_' || sm.movement_type)::VARCHAR as activity_type,
            (CASE 
                WHEN sm.movement_type = 'in' THEN 'Stock added: '
                ELSE 'Stock removed: '
            END || sm.quantity || ' units of ' || p.name)::TEXT as description,
            b.name as branch_name,
            u.full_name as user_name,
            sm.created_at,
            sm.id as reference_id
        FROM stock_movements sm
        JOIN products p ON sm.product_id = p.id
        JOIN branches b ON sm.branch_id = b.id
        JOIN users u ON sm.user_id = u.id
        WHERE (p_branch_id IS NULL OR sm.branch_id = p_branch_id)
            AND sm.reference_type != 'sale' -- Exclude sales-related movements to avoid duplicates
        
        UNION ALL
        
        -- Transfer activities
        SELECT 
            ('transfer_' || t.status)::VARCHAR as activity_type,
            ('Transfer ' || t.status || ' from ' || fb.name || ' to ' || tb.name)::TEXT as description,
            CASE 
                WHEN p_branch_id = t.from_branch_id THEN fb.name
                ELSE tb.name
            END as branch_name,
            u.full_name as user_name,
            COALESCE(t.completed_at, t.approved_at, t.requested_at) as created_at,
            t.id as reference_id
        FROM transfers t
        JOIN branches fb ON t.from_branch_id = fb.id
        JOIN branches tb ON t.to_branch_id = tb.id
        JOIN users u ON t.requested_by = u.id
        WHERE (p_branch_id IS NULL OR t.from_branch_id = p_branch_id OR t.to_branch_id = p_branch_id)
    )
    ORDER BY created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Clean up any remaining duplicate stock movements from today
DELETE FROM stock_movements 
WHERE id IN (
  SELECT sm2.id 
  FROM stock_movements sm1
  JOIN stock_movements sm2 ON 
    sm1.product_id = sm2.product_id 
    AND sm1.branch_id = sm2.branch_id 
    AND sm1.movement_type = sm2.movement_type 
    AND sm1.quantity = sm2.quantity 
    AND sm1.reference_type = sm2.reference_type
    AND DATE(sm1.created_at) = DATE(sm2.created_at)
    AND sm1.id < sm2.id
    AND DATE(sm1.created_at) = CURRENT_DATE
);
