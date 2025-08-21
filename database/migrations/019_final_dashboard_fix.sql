-- Final dashboard fix - drop all conflicting functions first, then recreate them

-- Drop all existing functions that have conflicts
DROP FUNCTION IF EXISTS get_recent_activities(VARCHAR(50), INTEGER);
DROP FUNCTION IF EXISTS get_top_selling_today(VARCHAR(50));
DROP FUNCTION IF EXISTS get_top_selling_week(VARCHAR(50));
DROP FUNCTION IF EXISTS get_low_stock_products(VARCHAR(50), INTEGER);
DROP FUNCTION IF EXISTS get_high_value_inventory(VARCHAR(50), INTEGER);

-- Now recreate all functions with correct types
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
        
        -- Product creation activities (without category for now)
        SELECT 
            'product_created'::VARCHAR as activity_type,
            ('New Product: ' || p.name || ' (SKU: ' || p.sku || ')')::TEXT as description,
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

-- Create all dashboard analytics functions
CREATE OR REPLACE FUNCTION get_top_selling_today(p_branch_id VARCHAR(50) DEFAULT NULL)
RETURNS TABLE (
    product_name VARCHAR,
    quantity_sold INTEGER,
    total_amount NUMERIC,
    variation_info VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.name::VARCHAR as product_name,
        SUM(si.quantity)::INTEGER as quantity_sold,
        SUM(si.quantity * si.unit_price) as total_amount,
        (CASE 
            WHEN pv.color IS NOT NULL OR pv.size IS NOT NULL 
            THEN COALESCE(pv.color, '') || CASE WHEN pv.color IS NOT NULL AND pv.size IS NOT NULL THEN ', ' ELSE '' END || COALESCE(pv.size, '')
            ELSE 'Standard'
        END)::VARCHAR as variation_info
    FROM sales s
    JOIN sale_items si ON s.id = si.sale_id
    JOIN products p ON si.product_id = p.id
    LEFT JOIN product_variations pv ON si.variation_id = pv.id
    WHERE DATE(s.created_at) = CURRENT_DATE
        AND (p_branch_id IS NULL OR s.branch_id = p_branch_id)
    GROUP BY p.id, p.name, pv.color, pv.size
    ORDER BY quantity_sold DESC
    LIMIT 7;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_top_selling_week(p_branch_id VARCHAR(50) DEFAULT NULL)
RETURNS TABLE (
    product_name VARCHAR,
    quantity_sold INTEGER,
    total_amount NUMERIC,
    variation_info VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.name::VARCHAR as product_name,
        SUM(si.quantity)::INTEGER as quantity_sold,
        SUM(si.quantity * si.unit_price) as total_amount,
        (CASE 
            WHEN pv.color IS NOT NULL OR pv.size IS NOT NULL 
            THEN COALESCE(pv.color, '') || CASE WHEN pv.color IS NOT NULL AND pv.size IS NOT NULL THEN ', ' ELSE '' END || COALESCE(pv.size, '')
            ELSE 'Standard'
        END)::VARCHAR as variation_info
    FROM sales s
    JOIN sale_items si ON s.id = si.sale_id
    JOIN products p ON si.product_id = p.id
    LEFT JOIN product_variations pv ON si.variation_id = pv.id
    WHERE s.created_at >= CURRENT_DATE - INTERVAL '7 days'
        AND (p_branch_id IS NULL OR s.branch_id = p_branch_id)
    GROUP BY p.id, p.name, pv.color, pv.size
    ORDER BY quantity_sold DESC
    LIMIT 7;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_low_stock_products(p_branch_id VARCHAR(50) DEFAULT NULL, p_threshold INTEGER DEFAULT 10)
RETURNS TABLE (
    product_name VARCHAR,
    current_quantity INTEGER,
    variation_info VARCHAR,
    category_info VARCHAR,
    last_restock_date TIMESTAMP,
    days_since_restock INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.name::VARCHAR as product_name,
        i.quantity::INTEGER as current_quantity,
        (CASE 
            WHEN pv.color IS NOT NULL OR pv.size IS NOT NULL 
            THEN COALESCE(pv.color, '') || CASE WHEN pv.color IS NOT NULL AND pv.size IS NOT NULL THEN ', ' ELSE '' END || COALESCE(pv.size, '')
            ELSE 'Standard'
        END)::VARCHAR as variation_info,
        COALESCE(c.name, 'No Category')::VARCHAR as category_info,
        (SELECT MAX(created_at) FROM stock_movements sm2 
         WHERE sm2.product_id = i.product_id 
         AND sm2.variation_id = i.variation_id 
         AND sm2.branch_id = i.branch_id 
         AND sm2.movement_type = 'in') as last_restock_date,
        EXTRACT(DAY FROM (CURRENT_DATE - (SELECT MAX(created_at) FROM stock_movements sm2 
         WHERE sm2.product_id = i.product_id 
         AND sm2.variation_id = i.variation_id 
         AND sm2.branch_id = i.branch_id 
         AND sm2.movement_type = 'in')))::INTEGER as days_since_restock
    FROM inventory i
    JOIN products p ON i.product_id = p.id
    LEFT JOIN product_variations pv ON i.variation_id = pv.id
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE i.quantity <= p_threshold
        AND (p_branch_id IS NULL OR i.branch_id = p_branch_id)
    ORDER BY i.quantity ASC, days_since_restock DESC
    LIMIT 7;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_recent_product_updates(p_branch_id VARCHAR(50) DEFAULT NULL, p_limit INTEGER DEFAULT 7)
RETURNS TABLE (
    product_name VARCHAR,
    update_type VARCHAR,
    updated_at TIMESTAMP,
    variation_info VARCHAR,
    category_info VARCHAR,
    change_details TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.name::VARCHAR as product_name,
        'Product Updated'::VARCHAR as update_type,
        p.updated_at,
        (CASE 
            WHEN pv.color IS NOT NULL OR pv.size IS NOT NULL 
            THEN COALESCE(pv.color, '') || CASE WHEN pv.color IS NOT NULL AND pv.size IS NOT NULL THEN ', ' ELSE '' END || COALESCE(pv.size, '')
            ELSE 'Standard'
        END)::VARCHAR as variation_info,
        COALESCE(c.name, 'No Category')::VARCHAR as category_info,
        ('Last updated: ' || p.updated_at::DATE)::TEXT as change_details
    FROM products p
    LEFT JOIN product_variations pv ON pv.product_id = p.id
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.updated_at >= CURRENT_DATE - INTERVAL '30 days'
        AND p.updated_at IS NOT NULL
        AND p.updated_at != p.created_at
    ORDER BY p.updated_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;
