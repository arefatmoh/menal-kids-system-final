-- Migration: Update inventory table to allow NULL min/max stock levels and add purchase_price to products
-- This migration updates the database schema to support the new requirements

-- 1. Add purchase_price column to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS purchase_price DECIMAL(10,2);

-- 2. Drop existing constraint on min/max stock levels
ALTER TABLE inventory DROP CONSTRAINT IF EXISTS check_min_max_stock;

-- 3. Modify min_stock_level and max_stock_level columns to allow NULL
ALTER TABLE inventory ALTER COLUMN min_stock_level DROP DEFAULT;
ALTER TABLE inventory ALTER COLUMN max_stock_level DROP DEFAULT;

-- 4. Update existing records: set default values to NULL for products that want flexible stock management
-- (Keep existing values for products that already have specific min/max levels)
-- This is optional - you can run this if you want to reset all to NULL:
-- UPDATE inventory SET min_stock_level = NULL, max_stock_level = NULL;

-- 5. Add new constraint that handles NULL values
ALTER TABLE inventory ADD CONSTRAINT check_min_max_stock 
    CHECK (min_stock_level IS NULL OR max_stock_level IS NULL OR min_stock_level <= max_stock_level);

-- 6. Update the inventory status view to handle NULL values
DROP VIEW IF EXISTS v_inventory_status;
CREATE VIEW v_inventory_status AS
SELECT 
    i.id,
    i.product_id,
    i.branch_id,
    p.name as product_name,
    p.sku,
    p.color,
    p.size,
    p.price,
    b.name as branch_name,
    i.quantity,
    i.min_stock_level,
    i.max_stock_level,
    CASE 
        WHEN i.quantity = 0 THEN 'out_of_stock'
        WHEN i.min_stock_level IS NOT NULL AND i.quantity <= i.min_stock_level THEN 'low_stock'
        WHEN i.max_stock_level IS NOT NULL AND i.quantity >= i.max_stock_level THEN 'overstock'
        ELSE 'normal'
    END as stock_status,
    c.name as category_name,
    i.last_restocked,
    i.updated_at
FROM inventory i
JOIN products p ON i.product_id = p.id
JOIN branches b ON i.branch_id = b.id
JOIN categories c ON p.category_id = c.id
WHERE p.is_active = TRUE;

-- 7. Update the dashboard stats function to handle NULL values
CREATE OR REPLACE FUNCTION get_dashboard_stats(p_branch_id VARCHAR(50) DEFAULT NULL)
RETURNS TABLE (
    total_products BIGINT,
    low_stock_alerts BIGINT,
    out_of_stock_alerts BIGINT,
    stock_in_today BIGINT,
    stock_out_today BIGINT,
    total_sales_today NUMERIC,
    transactions_today BIGINT,
    active_alerts BIGINT,
    critical_alerts BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(DISTINCT p.id)::BIGINT as total_products,
        COUNT(DISTINCT i.id) FILTER (WHERE i.min_stock_level IS NOT NULL AND i.quantity <= i.min_stock_level AND i.quantity > 0)::BIGINT as low_stock_alerts,
        COUNT(DISTINCT i.id) FILTER (WHERE i.quantity = 0)::BIGINT as out_of_stock_alerts,
        COALESCE(SUM(sm.quantity) FILTER (WHERE sm.movement_type = 'in' AND DATE(sm.created_at) = CURRENT_DATE), 0)::BIGINT as stock_in_today,
        COALESCE(SUM(sm.quantity) FILTER (WHERE sm.movement_type = 'out' AND DATE(sm.created_at) = CURRENT_DATE), 0)::BIGINT as stock_out_today,
        COALESCE(SUM(s.total_amount) FILTER (WHERE DATE(s.created_at) = CURRENT_DATE), 0) as total_sales_today,
        COUNT(s.id) FILTER (WHERE DATE(s.created_at) = CURRENT_DATE)::BIGINT as transactions_today,
        COUNT(a.id) FILTER (WHERE a.status = 'active')::BIGINT as active_alerts,
        COUNT(a.id) FILTER (WHERE a.status = 'active' AND a.severity = 'critical')::BIGINT as critical_alerts
    FROM branches b
    LEFT JOIN inventory i ON b.id = i.branch_id
    LEFT JOIN products p ON i.product_id = p.id AND p.is_active = TRUE
    LEFT JOIN stock_movements sm ON b.id = sm.branch_id
    LEFT JOIN sales s ON b.id = s.branch_id
    LEFT JOIN alerts a ON (b.id = a.branch_id OR a.branch_id IS NULL)
    WHERE b.is_active = TRUE
        AND (p_branch_id IS NULL OR b.id = p_branch_id);
END;
$$ LANGUAGE plpgsql;

-- 8. Update the stock alerts function to handle NULL values
CREATE OR REPLACE FUNCTION check_stock_alerts()
RETURNS INTEGER AS $$
DECLARE
    alert_count INTEGER := 0;
    rec RECORD;
BEGIN
    -- Loop through all low stock items (only for products with defined min_stock_level)
    FOR rec IN 
        SELECT 
            i.product_id,
            i.branch_id,
            i.quantity,
            i.min_stock_level,
            p.name as product_name,
            b.name as branch_name
        FROM inventory i
        JOIN products p ON i.product_id = p.id
        JOIN branches b ON i.branch_id = b.id
        WHERE i.min_stock_level IS NOT NULL 
            AND i.quantity <= i.min_stock_level 
            AND p.is_active = TRUE
            AND b.is_active = TRUE
    LOOP
        -- Check if alert already exists
        IF NOT EXISTS (
            SELECT 1 FROM alerts 
            WHERE type = 'inventory' 
                AND branch_id = rec.branch_id
                AND category = rec.product_id::TEXT
                AND status = 'active'
        ) THEN
            -- Create new alert
            INSERT INTO alerts (
                type, severity, title, message, branch_id, category,
                threshold_value, current_value, action_required
            ) VALUES (
                'inventory',
                CASE 
                    WHEN rec.quantity = 0 THEN 'critical'
                    WHEN rec.quantity <= rec.min_stock_level * 0.5 THEN 'high'
                    ELSE 'medium'
                END,
                CASE 
                    WHEN rec.quantity = 0 THEN 'Out of Stock'
                    ELSE 'Low Stock Alert'
                END,
                rec.product_name || ' is ' || 
                CASE 
                    WHEN rec.quantity = 0 THEN 'out of stock'
                    ELSE 'running low (' || rec.quantity || ' remaining)'
                END || ' at ' || rec.branch_name,
                rec.branch_id,
                rec.product_id::TEXT,
                rec.min_stock_level,
                rec.quantity,
                TRUE
            );
            
            alert_count := alert_count + 1;
        END IF;
    END LOOP;
    
    -- Also check for out of stock items (regardless of min_stock_level)
    FOR rec IN 
        SELECT 
            i.product_id,
            i.branch_id,
            i.quantity,
            p.name as product_name,
            b.name as branch_name
        FROM inventory i
        JOIN products p ON i.product_id = p.id
        JOIN branches b ON i.branch_id = b.id
        WHERE i.quantity = 0 
            AND p.is_active = TRUE
            AND b.is_active = TRUE
            AND NOT EXISTS (
                SELECT 1 FROM alerts 
                WHERE type = 'inventory' 
                    AND branch_id = i.branch_id
                    AND category = i.product_id::TEXT
                    AND status = 'active'
            )
    LOOP
        -- Create out of stock alert
        INSERT INTO alerts (
            type, severity, title, message, branch_id, category,
            threshold_value, current_value, action_required
        ) VALUES (
            'inventory',
            'critical',
            'Out of Stock',
            rec.product_name || ' is out of stock at ' || rec.branch_name,
            rec.branch_id,
            rec.product_id::TEXT,
            0,
            0,
            TRUE
        );
        
        alert_count := alert_count + 1;
    END LOOP;
    
    RETURN alert_count;
END;
$$ LANGUAGE plpgsql;

COMMIT;