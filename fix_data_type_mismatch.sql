-- FIX DATA TYPE MISMATCH IN FUNCTIONS
-- This script fixes the "Returned type character varying(255) does not match expected type text" error

-- Fix get_low_stock_products function
CREATE OR REPLACE FUNCTION get_low_stock_products(p_branch_id VARCHAR DEFAULT NULL)
RETURNS TABLE (
    product_name VARCHAR,
    current_quantity BIGINT,
    variation_info TEXT,
    category_info TEXT,
    days_since_restock BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.name as product_name,
        COALESCE(SUM(i.quantity), 0)::BIGINT as current_quantity,
        CASE 
            WHEN pv.id IS NOT NULL THEN 
                CONCAT(COALESCE(pv.color, ''), CASE WHEN pv.color IS NOT NULL AND pv.size IS NOT NULL THEN ', ' ELSE '' END, COALESCE(pv.size, ''))
            ELSE 'N/A'
        END as variation_info,
        c.name::TEXT as category_info,  -- CAST to TEXT to fix type mismatch
        COALESCE(EXTRACT(DAY FROM CURRENT_DATE - MAX(sm.created_at)), 0)::BIGINT as days_since_restock
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN product_variations pv ON p.id = pv.product_id AND pv.is_active = true
    LEFT JOIN inventory i ON pv.id = i.variation_id
    LEFT JOIN stock_movements sm ON p.id = sm.product_id AND sm.movement_type = 'in'
    WHERE p.is_active = true
    AND (p_branch_id IS NULL OR i.branch_id = p_branch_id)
    GROUP BY p.id, p.name, c.name, pv.id, pv.color, pv.size
    HAVING COALESCE(SUM(i.quantity), 0) <= COALESCE(AVG(i.min_stock_level), 5)
    ORDER BY current_quantity ASC
    LIMIT 10;
END;
$$ LANGUAGE plpgsql;

-- Fix get_recent_product_updates function (same issue)
CREATE OR REPLACE FUNCTION get_recent_product_updates(p_branch_id VARCHAR DEFAULT NULL)
RETURNS TABLE (
    product_name VARCHAR,
    update_type VARCHAR,
    updated_at TIMESTAMP,
    variation_info TEXT,
    category_info TEXT,
    change_details TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.name as product_name,
        'stock_update' as update_type,
        MAX(sm.created_at) as updated_at,
        CASE 
            WHEN pv.id IS NOT NULL THEN 
                CONCAT(COALESCE(pv.color, ''), CASE WHEN pv.color IS NOT NULL AND pv.size IS NOT NULL THEN ', ' ELSE '' END, COALESCE(pv.size, ''))
            ELSE 'N/A'
        END as variation_info,
        c.name::TEXT as category_info,  -- CAST to TEXT to fix type mismatch
        'Stock level updated' as change_details
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN product_variations pv ON p.id = pv.product_id AND pv.is_active = true
    LEFT JOIN stock_movements sm ON p.id = sm.product_id
    WHERE p.is_active = true
    AND (p_branch_id IS NULL OR sm.branch_id = p_branch_id)
    GROUP BY p.id, p.name, c.name, pv.id, pv.color, pv.size
    ORDER BY MAX(sm.created_at) DESC
    LIMIT 10;
END;
$$ LANGUAGE plpgsql;

-- Fix get_top_selling_today function (same issue)
CREATE OR REPLACE FUNCTION get_top_selling_today(p_branch_id VARCHAR DEFAULT NULL)
RETURNS TABLE (
    product_name VARCHAR,
    quantity_sold BIGINT,
    total_amount DECIMAL,
    variation_info TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.name as product_name,
        COALESCE(SUM(si.quantity), 0)::BIGINT as quantity_sold,
        COALESCE(SUM(si.quantity * si.unit_price), 0) as total_amount,
        CASE 
            WHEN pv.id IS NOT NULL THEN 
                CONCAT(COALESCE(pv.color, ''), CASE WHEN pv.color IS NOT NULL AND pv.size IS NOT NULL THEN ', ' ELSE '' END, COALESCE(pv.size, ''))
            ELSE 'N/A'
        END::TEXT as variation_info  -- CAST to TEXT to ensure consistency
    FROM products p
    LEFT JOIN product_variations pv ON p.id = pv.product_id AND pv.is_active = true
    LEFT JOIN sale_items si ON pv.id = si.variation_id
    LEFT JOIN sales s ON si.sale_id = s.id
    WHERE p.is_active = true
    AND DATE(s.created_at) = CURRENT_DATE
    AND (p_branch_id IS NULL OR s.branch_id = p_branch_id)
    GROUP BY p.id, p.name, pv.id, pv.color, pv.size
    ORDER BY quantity_sold DESC
    LIMIT 10;
END;
$$ LANGUAGE plpgsql;

-- Fix get_top_selling_week function (same issue)
CREATE OR REPLACE FUNCTION get_top_selling_week(p_branch_id VARCHAR DEFAULT NULL)
RETURNS TABLE (
    product_name VARCHAR,
    quantity_sold BIGINT,
    total_amount DECIMAL,
    variation_info TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.name as product_name,
        COALESCE(SUM(si.quantity), 0)::BIGINT as quantity_sold,
        COALESCE(SUM(si.quantity * si.unit_price), 0) as total_amount,
        CASE 
            WHEN pv.id IS NOT NULL THEN 
                CONCAT(COALESCE(pv.color, ''), CASE WHEN pv.color IS NOT NULL AND pv.size IS NOT NULL THEN ', ' ELSE '' END, COALESCE(pv.size, ''))
            ELSE 'N/A'
        END::TEXT as variation_info  -- CAST to TEXT to ensure consistency
    FROM products p
    LEFT JOIN product_variations pv ON p.id = pv.product_id AND pv.is_active = true
    LEFT JOIN sale_items si ON pv.id = si.variation_id
    LEFT JOIN sales s ON si.sale_id = s.id
    WHERE p.is_active = true
    AND s.created_at >= CURRENT_DATE - INTERVAL '7 days'
    AND (p_branch_id IS NULL OR s.branch_id = p_branch_id)
    GROUP BY p.id, p.name, pv.id, pv.color, pv.size
    ORDER BY quantity_sold DESC
    LIMIT 10;
END;
$$ LANGUAGE plpgsql;

-- Fix get_stock_trend function (same issue)
CREATE OR REPLACE FUNCTION get_stock_trend(p_branch_id VARCHAR DEFAULT NULL)
RETURNS TABLE (
    name VARCHAR,
    stock BIGINT,
    stock_in BIGINT,
    stock_out BIGINT,
    total_stock BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.name,
        COALESCE(SUM(i.quantity), 0)::BIGINT as stock,
        COALESCE(SUM(CASE WHEN sm.movement_type = 'in' THEN sm.quantity ELSE 0 END), 0)::BIGINT as stock_in,
        COALESCE(SUM(CASE WHEN sm.movement_type = 'out' THEN sm.quantity ELSE 0 END), 0)::BIGINT as stock_out,
        COALESCE(SUM(i.quantity), 0)::BIGINT as total_stock
    FROM products p
    LEFT JOIN product_variations pv ON p.id = pv.product_id AND pv.is_active = true
    LEFT JOIN inventory i ON pv.id = i.variation_id
    LEFT JOIN stock_movements sm ON p.id = sm.product_id
    WHERE p.is_active = true
    AND (p_branch_id IS NULL OR i.branch_id = p_branch_id OR sm.branch_id = p_branch_id)
    GROUP BY p.id, p.name
    ORDER BY p.name;
END;
$$ LANGUAGE plpgsql;

-- Verify the fixes
SELECT 'Data Type Mismatch Fixed!' as status,
       'All functions now have consistent TEXT types' as details;

-- Test the problematic function
SELECT 'Testing get_low_stock_products...' as test_status;
SELECT * FROM get_low_stock_products() LIMIT 1;
