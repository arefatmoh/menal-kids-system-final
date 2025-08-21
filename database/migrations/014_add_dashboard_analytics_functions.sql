-- Add dashboard analytics functions for real data

-- Function to get top selling products for today
CREATE OR REPLACE FUNCTION get_top_selling_today(p_branch_id VARCHAR(50) DEFAULT NULL)
RETURNS TABLE (
    product_name VARCHAR,
    quantity_sold INTEGER,
    total_amount NUMERIC,
    variation_info TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.name as product_name,
        SUM(si.quantity)::INTEGER as quantity_sold,
        SUM(si.quantity * si.unit_price) as total_amount,
        CASE 
            WHEN pv.color IS NOT NULL OR pv.size IS NOT NULL 
            THEN COALESCE(pv.color, '') || CASE WHEN pv.color IS NOT NULL AND pv.size IS NOT NULL THEN ', ' ELSE '' END || COALESCE(pv.size, '')
            ELSE 'Standard'
        END as variation_info
    FROM sales s
    JOIN sale_items si ON s.id = si.sale_id
    JOIN products p ON si.product_id = p.id
    LEFT JOIN product_variations pv ON si.variation_id = pv.id
    WHERE DATE(s.created_at) = CURRENT_DATE
        AND (p_branch_id IS NULL OR s.branch_id = p_branch_id)
    GROUP BY p.id, p.name, pv.color, pv.size
    ORDER BY quantity_sold DESC
    LIMIT 5;
END;
$$ LANGUAGE plpgsql;

-- Function to get top selling products for this week
CREATE OR REPLACE FUNCTION get_top_selling_week(p_branch_id VARCHAR(50) DEFAULT NULL)
RETURNS TABLE (
    product_name VARCHAR,
    quantity_sold INTEGER,
    total_amount NUMERIC,
    variation_info TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.name as product_name,
        SUM(si.quantity)::INTEGER as quantity_sold,
        SUM(si.quantity * si.unit_price) as total_amount,
        CASE 
            WHEN pv.color IS NOT NULL OR pv.size IS NOT NULL 
            THEN COALESCE(pv.color, '') || CASE WHEN pv.color IS NOT NULL AND pv.size IS NOT NULL THEN ', ' ELSE '' END || COALESCE(pv.size, '')
            ELSE 'Standard'
        END as variation_info
    FROM sales s
    JOIN sale_items si ON s.id = si.sale_id
    JOIN products p ON si.product_id = p.id
    LEFT JOIN product_variations pv ON si.variation_id = pv.id
    WHERE s.created_at >= CURRENT_DATE - INTERVAL '7 days'
        AND (p_branch_id IS NULL OR s.branch_id = p_branch_id)
    GROUP BY p.id, p.name, pv.color, pv.size
    ORDER BY quantity_sold DESC
    LIMIT 5;
END;
$$ LANGUAGE plpgsql;

-- Function to get low stock products with more details
CREATE OR REPLACE FUNCTION get_low_stock_products(p_branch_id VARCHAR(50) DEFAULT NULL, p_threshold INTEGER DEFAULT 10)
RETURNS TABLE (
    product_name VARCHAR,
    current_quantity INTEGER,
    variation_info TEXT,
    category VARCHAR,
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
        p.category,
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
    WHERE i.quantity <= p_threshold
        AND (p_branch_id IS NULL OR i.branch_id = p_branch_id)
    ORDER BY i.quantity ASC, days_since_restock DESC
    LIMIT 10;
END;
$$ LANGUAGE plpgsql;

-- Function to get high value inventory (most expensive items in stock)
CREATE OR REPLACE FUNCTION get_high_value_inventory(p_branch_id VARCHAR(50) DEFAULT NULL, p_limit INTEGER DEFAULT 5)
RETURNS TABLE (
    product_name VARCHAR,
    current_quantity INTEGER,
    unit_value NUMERIC,
    total_value NUMERIC,
    variation_info TEXT,
    category VARCHAR
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
        p.category
    FROM inventory i
    JOIN products p ON i.product_id = p.id
    LEFT JOIN product_variations pv ON i.variation_id = pv.id
    WHERE i.quantity > 0
        AND (p_branch_id IS NULL OR i.branch_id = p_branch_id)
        AND COALESCE(pv.price, p.price) > 0
    ORDER BY total_value DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;
