-- Enhance recent activities function with better descriptions and more details

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
        -- Sales activities with detailed product information
        SELECT 
            'sale'::VARCHAR as activity_type,
            ('Sale: ' || 
             COALESCE(
               (SELECT STRING_AGG(p.name || CASE WHEN pv.color IS NOT NULL OR pv.size IS NOT NULL 
                 THEN ' (' || COALESCE(pv.color, '') || CASE WHEN pv.color IS NOT NULL AND pv.size IS NOT NULL THEN ', ' ELSE '' END || COALESCE(pv.size, '') || ')'
                 ELSE '' END, ', ' ORDER BY si.quantity DESC)
                FROM sale_items si 
                JOIN products p ON si.product_id = p.id 
                LEFT JOIN product_variations pv ON si.variation_id = pv.id 
                WHERE si.sale_id = s.id), 
               'Unknown products'
             ) || ' - Total: $' || s.total_amount)::TEXT as description,
            b.name as branch_name,
            u.full_name as user_name,
            s.created_at,
            s.id as reference_id
        FROM sales s
        JOIN branches b ON s.branch_id = b.id
        JOIN users u ON s.user_id = u.id
        WHERE (p_branch_id IS NULL OR s.branch_id = p_branch_id)
        
        UNION ALL
        
        -- Stock movements activities (deduplicated) with product details
        SELECT DISTINCT ON (sm.product_id, sm.branch_id, sm.movement_type, sm.quantity, DATE(sm.created_at))
            ('stock_' || sm.movement_type)::VARCHAR as activity_type,
            (CASE 
                WHEN sm.movement_type = 'in' THEN 'Stock Added: '
                ELSE 'Stock Removed: '
            END || sm.quantity || ' units of ' || p.name || 
            CASE WHEN pv.color IS NOT NULL OR pv.size IS NOT NULL 
              THEN ' (' || COALESCE(pv.color, '') || CASE WHEN pv.color IS NOT NULL AND pv.size IS NOT NULL THEN ', ' ELSE '' END || COALESCE(pv.size, '') || ')'
              ELSE '' END)::TEXT as description,
            b.name as branch_name,
            u.full_name as user_name,
            sm.created_at,
            sm.id as reference_id
        FROM stock_movements sm
        JOIN products p ON sm.product_id = p.id
        LEFT JOIN product_variations pv ON sm.variation_id = pv.id
        JOIN branches b ON sm.branch_id = b.id
        JOIN users u ON sm.user_id = u.id
        WHERE (p_branch_id IS NULL OR sm.branch_id = p_branch_id)
            AND sm.reference_type != 'sale' -- Exclude sales-related movements to avoid duplicates
        
        UNION ALL
        
        -- Transfer activities with enhanced details
        SELECT 
            ('transfer_' || t.status)::VARCHAR as activity_type,
            ('Transfer ' || t.status || ': ' || 
             (SELECT STRING_AGG(p.name || ' (' || COALESCE(pv.color, '') || CASE WHEN pv.color IS NOT NULL AND pv.size IS NOT NULL THEN ', ' ELSE '' END || COALESCE(pv.size, '') || ')', ', ')
              FROM transfer_items ti 
              JOIN products p ON ti.product_id = p.id 
              LEFT JOIN product_variations pv ON ti.variation_id = pv.id 
              WHERE ti.transfer_id = t.id) || 
             ' from ' || fb.name || ' to ' || tb.name || 
             CASE WHEN t.notes IS NOT NULL AND t.notes != '' THEN ' - ' || t.notes ELSE '' END)::TEXT as description,
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
        
        -- Product creation activities with category info
        SELECT 
            'product_created'::VARCHAR as activity_type,
            ('New Product: ' || p.name || ' (SKU: ' || p.sku || ')' ||
             CASE WHEN p.category IS NOT NULL THEN ' - Category: ' || p.category ELSE '' END)::TEXT as description,
            'System'::VARCHAR as branch_name,
            COALESCE(u.full_name, 'System')::VARCHAR as user_name,
            p.created_at,
            p.id as reference_id
        FROM products p
        LEFT JOIN users u ON p.created_by = u.id
        WHERE p.created_at >= CURRENT_DATE - INTERVAL '7 days'
            AND p.created_at IS NOT NULL
        
        UNION ALL
        
        -- Product variation activities with detailed specs
        SELECT 
            'variation_created'::VARCHAR as activity_type,
            ('New Variation: ' || p.name || ' - ' || 
             COALESCE(pv.color, '') || CASE WHEN pv.color IS NOT NULL AND pv.size IS NOT NULL THEN ', ' ELSE '' END || 
             COALESCE(pv.size, '') || ' (SKU: ' || pv.sku || ')' ||
             CASE WHEN pv.price IS NOT NULL THEN ' - Price: $' || pv.price ELSE '' END)::TEXT as description,
            'System'::VARCHAR as branch_name,
            COALESCE(u.full_name, 'System')::VARCHAR as user_name,
            pv.created_at,
            pv.id as reference_id
        FROM product_variations pv
        JOIN products p ON pv.product_id = p.id
        LEFT JOIN users u ON pv.created_by = u.id
        WHERE pv.created_at >= CURRENT_DATE - INTERVAL '7 days'
            AND pv.created_at IS NOT NULL
        
        UNION ALL
        
        -- Inventory adjustments with before/after quantities
        SELECT 
            'inventory_adjusted'::VARCHAR as activity_type,
            ('Inventory Update: ' || p.name || ' - New quantity: ' || i.quantity ||
             CASE WHEN pv.color IS NOT NULL OR pv.size IS NOT NULL 
               THEN ' (' || COALESCE(pv.color, '') || CASE WHEN pv.color IS NOT NULL AND pv.size IS NOT NULL THEN ', ' ELSE '' END || COALESCE(pv.size, '') || ')'
               ELSE '' END)::TEXT as description,
            b.name as branch_name,
            'System'::VARCHAR as user_name,
            i.updated_at,
            i.id as reference_id
        FROM inventory i
        JOIN products p ON i.product_id = p.id
        LEFT JOIN product_variations pv ON i.variation_id = pv.id
        JOIN branches b ON i.branch_id = b.id
        WHERE (p_branch_id IS NULL OR i.branch_id = p_branch_id)
            AND i.updated_at >= CURRENT_DATE - INTERVAL '7 days'
            AND i.updated_at IS NOT NULL
            AND i.updated_at != i.created_at
    )
    ORDER BY created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;
