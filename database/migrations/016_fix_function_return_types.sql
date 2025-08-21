-- Fix function return type conflicts by dropping and recreating functions

-- Drop existing functions that have conflicting return types
DROP FUNCTION IF EXISTS get_low_stock_products(VARCHAR(50), INTEGER);
DROP FUNCTION IF EXISTS get_high_value_inventory(VARCHAR(50), INTEGER);

-- Now recreate them with the correct return types
CREATE OR REPLACE FUNCTION get_low_stock_products(p_branch_id VARCHAR(50) DEFAULT NULL, p_threshold INTEGER DEFAULT 10)
RETURNS TABLE (
    product_name VARCHAR,
    current_quantity INTEGER,
    variation_info TEXT,
    category_info TEXT,
    last_restock_date TIMESTAMP,
    days_since_restock INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.name as product_name,
        i.quantity::INTEGER as current_quantity,
        CASE 
            WHEN pv.color IS NOT NULL OR pv.size IS NOT NULL 
            THEN COALESCE(pv.color, '') || CASE WHEN pv.color IS NOT NULL AND pv.size IS NOT NULL THEN ', ' ELSE '' END || COALESCE(pv.size, '')
            ELSE 'Standard'
        END as variation_info,
        COALESCE(c.name, 'No Category') as category_info,
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
    LIMIT 10;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_high_value_inventory(p_branch_id VARCHAR(50) DEFAULT NULL, p_limit INTEGER DEFAULT 5)
RETURNS TABLE (
    product_name VARCHAR,
    current_quantity INTEGER,
    unit_value NUMERIC,
    total_value NUMERIC,
    variation_info TEXT,
    category_info TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.name as product_name,
        i.quantity::INTEGER as current_quantity,
        COALESCE(pv.price, p.price) as unit_value,
        (i.quantity * COALESCE(pv.price, p.price)) as total_value,
        CASE 
            WHEN pv.color IS NOT NULL OR pv.size IS NOT NULL 
            THEN COALESCE(pv.color, '') || CASE WHEN pv.color IS NOT NULL AND pv.size IS NOT NULL THEN ', ' ELSE '' END || COALESCE(pv.size, '')
            ELSE 'Standard'
        END as variation_info,
        COALESCE(c.name, 'No Category') as category_info
    FROM inventory i
    JOIN products p ON i.product_id = p.id
    LEFT JOIN product_variations pv ON i.variation_id = pv.id
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE i.quantity > 0
        AND (p_branch_id IS NULL OR i.branch_id = p_branch_id)
        AND COALESCE(pv.price, p.price) > 0
    ORDER BY total_value DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;
