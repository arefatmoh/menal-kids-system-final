-- Enhance recent activities function to include all system activities

-- Function to get recent activities for dashboard (enhanced version)
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
            ('Transfer ' || t.status || ' from ' || fb.name || ' to ' || tb.name || ' - ' || COALESCE(t.notes, 'No notes'))::TEXT as description,
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
        
        UNION ALL
        
        -- Product creation activities
        SELECT 
            'product_created'::VARCHAR as activity_type,
            ('New product added: ' || p.name || ' (SKU: ' || p.sku || ')')::TEXT as description,
            'System'::VARCHAR as branch_name,
            u.full_name as user_name,
            p.created_at,
            p.id as reference_id
        FROM products p
        JOIN users u ON p.created_by = u.id
        WHERE p.created_at >= CURRENT_DATE - INTERVAL '7 days'
        
        UNION ALL
        
        -- Product variation activities
        SELECT 
            'variation_created'::VARCHAR as activity_type,
            ('Product variation added: ' || p.name || ' - ' || 
             COALESCE(pv.color, '') || CASE WHEN pv.color IS NOT NULL AND pv.size IS NOT NULL THEN ', ' ELSE '' END || 
             COALESCE(pv.size, '') || ' (SKU: ' || pv.sku || ')')::TEXT as description,
            'System'::VARCHAR as branch_name,
            u.full_name as user_name,
            pv.created_at,
            pv.id as reference_id
        FROM product_variations pv
        JOIN products p ON pv.product_id = p.id
        JOIN users u ON pv.created_by = u.id
        WHERE pv.created_at >= CURRENT_DATE - INTERVAL '7 days'
        
        UNION ALL
        
        -- Inventory adjustments
        SELECT 
            'inventory_adjusted'::VARCHAR as activity_type,
            ('Inventory adjusted: ' || p.name || ' - New quantity: ' || i.quantity)::TEXT as description,
            b.name as branch_name,
            'System'::VARCHAR as user_name,
            i.updated_at,
            i.id as reference_id
        FROM inventory i
        JOIN products p ON i.product_id = p.id
        JOIN branches b ON i.branch_id = b.id
        WHERE (p_branch_id IS NULL OR i.branch_id = p_branch_id)
            AND i.updated_at >= CURRENT_DATE - INTERVAL '7 days'
            AND i.updated_at != i.created_at
        
        UNION ALL
        
        -- User activities (login, etc.)
        SELECT 
            'user_activity'::VARCHAR as activity_type,
            ('User activity: ' || u.full_name || ' logged in')::TEXT as description,
            'System'::VARCHAR as branch_name,
            u.full_name as user_name,
            u.last_login as created_at,
            u.id as reference_id
        FROM users u
        WHERE u.last_login >= CURRENT_DATE - INTERVAL '7 days'
            AND u.last_login IS NOT NULL
    )
    ORDER BY created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;
