-- =====================================================
-- MENAL KIDS SYSTEM - PRODUCTION DATABASE FUNCTIONS
-- =====================================================
-- This file contains all essential database functions and procedures
-- for the production system
-- =====================================================

-- =====================================================
-- DASHBOARD FUNCTIONS
-- =====================================================

-- Function to get dashboard statistics for a specific branch or all branches
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
        -- Count active products available in branch inventory
        (
          SELECT COUNT(DISTINCT p.id)::BIGINT
          FROM products p
          JOIN inventory i ON i.product_id = p.id
          WHERE p.is_active = TRUE
            AND (p_branch_id IS NULL OR i.branch_id = p_branch_id)
        ) AS total_products,

        -- Low stock alerts from inventory
        (
          SELECT COUNT(DISTINCT i2.id)::BIGINT
          FROM inventory i2
          WHERE i2.min_stock_level IS NOT NULL
            AND i2.quantity <= i2.min_stock_level
            AND i2.quantity > 0
            AND (p_branch_id IS NULL OR i2.branch_id = p_branch_id)
        ) AS low_stock_alerts,

        -- Out of stock alerts from inventory
        (
          SELECT COUNT(DISTINCT i3.id)::BIGINT
          FROM inventory i3
          WHERE i3.quantity = 0
            AND (p_branch_id IS NULL OR i3.branch_id = p_branch_id)
        ) AS out_of_stock_alerts,

        -- Stock in today (sum of stock movements)
        (
          SELECT COALESCE(SUM(sm_in.quantity), 0)::BIGINT
          FROM stock_movements sm_in
          WHERE sm_in.movement_type = 'in'
            AND DATE(sm_in.created_at) = CURRENT_DATE
            AND (p_branch_id IS NULL OR sm_in.branch_id = p_branch_id)
        ) AS stock_in_today,

        -- Stock out today (sum of stock movements)
        (
          SELECT COALESCE(SUM(sm_out.quantity), 0)::BIGINT
          FROM stock_movements sm_out
          WHERE sm_out.movement_type = 'out'
            AND DATE(sm_out.created_at) = CURRENT_DATE
            AND (p_branch_id IS NULL OR sm_out.branch_id = p_branch_id)
        ) AS stock_out_today,

        -- Total sales amount today
        (
          SELECT COALESCE(SUM(s.total_amount), 0)
          FROM sales s
          WHERE DATE(s.created_at) = CURRENT_DATE
            AND (p_branch_id IS NULL OR s.branch_id = p_branch_id)
        ) AS total_sales_today,

        -- Number of sales transactions today
        (
          SELECT COUNT(s2.id)::BIGINT
          FROM sales s2
          WHERE DATE(s2.created_at) = CURRENT_DATE
            AND (p_branch_id IS NULL OR s2.branch_id = p_branch_id)
        ) AS transactions_today,

        -- Active alerts (including global alerts where branch_id is NULL)
        (
          SELECT COUNT(a.id)::BIGINT
          FROM alerts a
          WHERE a.status = 'active'
            AND (p_branch_id IS NULL OR a.branch_id = p_branch_id OR a.branch_id IS NULL)
        ) AS active_alerts,

        -- Critical alerts (including global alerts where branch_id is NULL)
        (
          SELECT COUNT(a2.id)::BIGINT
          FROM alerts a2
          WHERE a2.status = 'active'
            AND a2.severity = 'critical'
            AND (p_branch_id IS NULL OR a2.branch_id = p_branch_id OR a2.branch_id IS NULL)
        ) AS critical_alerts;
END;
$$ LANGUAGE plpgsql;

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
        (
            CASE 
                WHEN pv.color IS NOT NULL OR pv.size IS NOT NULL 
                THEN COALESCE(pv.color, '') || CASE WHEN pv.color IS NOT NULL AND pv.size IS NOT NULL THEN ', ' ELSE '' END || COALESCE(pv.size, '')
                ELSE 'Standard'
            END
        )::TEXT as variation_info
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
        (
            CASE 
                WHEN pv.color IS NOT NULL OR pv.size IS NOT NULL 
                THEN COALESCE(pv.color, '') || CASE WHEN pv.color IS NOT NULL AND pv.size IS NOT NULL THEN ', ' ELSE '' END || COALESCE(pv.size, '')
                ELSE 'Standard'
            END
        )::TEXT as variation_info
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
    category_info TEXT,
    last_restock_date TIMESTAMP,
    days_since_restock INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.name as product_name,
        i.quantity::INTEGER as current_quantity,
        (
            CASE 
                WHEN pv.color IS NOT NULL OR pv.size IS NOT NULL 
                THEN COALESCE(pv.color, '') || CASE WHEN pv.color IS NOT NULL AND pv.size IS NOT NULL THEN ', ' ELSE '' END || COALESCE(pv.size, '')
                ELSE 'Standard'
            END
        )::TEXT as variation_info,
        COALESCE(c.name, 'No Category')::TEXT as category_info,
        (SELECT MAX(created_at) FROM stock_movements sm2 
         WHERE sm2.product_id = i.product_id 
         AND sm2.variation_id IS NOT DISTINCT FROM i.variation_id 
         AND sm2.branch_id = i.branch_id 
         AND sm2.movement_type = 'in') as last_restock_date,
        EXTRACT(DAY FROM (CURRENT_DATE - (SELECT MAX(created_at) FROM stock_movements sm2 
         WHERE sm2.product_id = i.product_id 
         AND sm2.variation_id IS NOT DISTINCT FROM i.variation_id 
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

-- Function to get high value inventory (most expensive items in stock)
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
        COALESCE(pv.price, 0) as unit_value,
        (i.quantity * COALESCE(pv.price, 0)) as total_value,
        (
            CASE 
                WHEN pv.color IS NOT NULL OR pv.size IS NOT NULL 
                THEN COALESCE(pv.color, '') || CASE WHEN pv.color IS NOT NULL AND pv.size IS NOT NULL THEN ', ' ELSE '' END || COALESCE(pv.size, '')
                ELSE 'Standard'
            END
        )::TEXT as variation_info,
        COALESCE(c.name, 'No Category')::TEXT as category_info
    FROM inventory i
    JOIN products p ON i.product_id = p.id
    LEFT JOIN product_variations pv ON i.variation_id = pv.id
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE i.quantity > 0
        AND (p_branch_id IS NULL OR i.branch_id = p_branch_id)
        AND COALESCE(pv.price, 0) > 0
    ORDER BY total_value DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to get recent product updates
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

-- Function to get recent activities for dashboard
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
            COALESCE(t.transfer_date, t.created_at) as created_at,
            t.id as reference_id
        FROM transfers t
        JOIN branches fb ON t.from_branch_id = fb.id
        JOIN branches tb ON t.to_branch_id = tb.id
        JOIN users u ON t.user_id = u.id
        WHERE (p_branch_id IS NULL OR t.from_branch_id = p_branch_id OR t.to_branch_id = p_branch_id)
    )
    ORDER BY created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- INVENTORY MANAGEMENT FUNCTIONS
-- =====================================================

-- Function to update inventory quantity
CREATE OR REPLACE FUNCTION update_inventory_quantity(
    p_product_id UUID,
    p_branch_id VARCHAR(50),
    p_quantity_change INTEGER,
    p_movement_type VARCHAR(20),
    p_user_id UUID,
    p_variation_id UUID DEFAULT NULL,
    p_reference_type VARCHAR(50) DEFAULT NULL,
    p_reference_id UUID DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    v_current_quantity INTEGER;
    v_new_quantity INTEGER;
    v_inventory_id UUID;
BEGIN
    -- Find existing inventory record
    SELECT id, quantity INTO v_inventory_id, v_current_quantity
    FROM inventory
    WHERE product_id = p_product_id
      AND variation_id IS NOT DISTINCT FROM p_variation_id
      AND branch_id = p_branch_id;
    
    -- If no inventory record exists, create one
    IF v_inventory_id IS NULL THEN
        INSERT INTO inventory (product_id, variation_id, branch_id, quantity)
        VALUES (p_product_id, p_variation_id, p_branch_id, 0)
        RETURNING id INTO v_inventory_id;
        v_current_quantity := 0;
    END IF;
    
    -- Calculate new quantity
    v_new_quantity := v_current_quantity + p_quantity_change;
    
    -- Check if new quantity would be negative
    IF v_new_quantity < 0 THEN
        RAISE EXCEPTION 'Insufficient stock. Current: %, Requested change: %', v_current_quantity, p_quantity_change;
    END IF;
    
    -- Update inventory
    UPDATE inventory 
    SET quantity = v_new_quantity,
        updated_at = NOW()
    WHERE id = v_inventory_id;
    
    -- Record stock movement
    INSERT INTO stock_movements (
        product_id, variation_id, branch_id, user_id,
        movement_type, quantity, reference_type, reference_id, notes
    ) VALUES (
        p_product_id, p_variation_id, p_branch_id, p_user_id,
        p_movement_type, p_quantity_change, p_reference_type, p_reference_id, p_notes
    );
    
    RETURN TRUE;
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Failed to update inventory: %', SQLERRM;
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Function to get low stock alerts
CREATE OR REPLACE FUNCTION get_low_stock_alerts(p_branch_id VARCHAR(50) DEFAULT NULL)
RETURNS TABLE (
    product_name VARCHAR(255),
    sku VARCHAR(100),
    color VARCHAR(100),
    size VARCHAR(50),
    branch_name VARCHAR(255),
    current_quantity INTEGER,
    min_stock_level INTEGER,
    stock_status VARCHAR(20)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.name as product_name,
        COALESCE(pv.sku, p.sku) as sku,
        pv.color,
        pv.size,
        b.name as branch_name,
        i.quantity as current_quantity,
        i.min_stock_level,
        CASE 
            WHEN i.quantity = 0 THEN 'out_of_stock'
            WHEN i.quantity <= i.min_stock_level THEN 'low_stock'
            ELSE 'normal'
        END as stock_status
    FROM inventory i
    JOIN products p ON i.product_id = p.id
    LEFT JOIN product_variations pv ON i.variation_id = pv.id
    JOIN branches b ON i.branch_id = b.id
    WHERE (p_branch_id IS NULL OR i.branch_id = p_branch_id)
      AND i.quantity <= i.min_stock_level
      AND p.is_active = TRUE
    ORDER BY i.quantity ASC, p.name;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate inventory value
CREATE OR REPLACE FUNCTION calculate_inventory_value(p_branch_id VARCHAR(50) DEFAULT NULL)
RETURNS TABLE (
    branch_name VARCHAR(255),
    total_products INTEGER,
    total_variations INTEGER,
    total_quantity INTEGER,
    total_value DECIMAL(12,2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        b.name as branch_name,
        COUNT(DISTINCT i.product_id) as total_products,
        COUNT(DISTINCT i.variation_id) FILTER (WHERE i.variation_id IS NOT NULL) as total_variations,
        SUM(i.quantity) as total_quantity,
        SUM(
            COALESCE(pv.price, 0) * i.quantity
        ) as total_value
    FROM inventory i
    JOIN branches b ON i.branch_id = b.id
    JOIN products p ON i.product_id = p.id
    LEFT JOIN product_variations pv ON i.variation_id = pv.id
    WHERE (p_branch_id IS NULL OR i.branch_id = p_branch_id)
      AND p.is_active = TRUE
    GROUP BY b.id, b.name
    ORDER BY b.name;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- SALES MANAGEMENT FUNCTIONS
-- =====================================================

-- Function to create a sale with items
CREATE OR REPLACE FUNCTION create_sale(
    p_branch_id VARCHAR(50),
    p_user_id UUID,
    p_items JSON,
    p_customer_name VARCHAR(255) DEFAULT NULL,
    p_customer_phone VARCHAR(20) DEFAULT NULL,
    p_customer_email VARCHAR(255) DEFAULT NULL,
    p_payment_method VARCHAR(50) DEFAULT 'cash'
)
RETURNS UUID AS $$
DECLARE
    v_sale_id UUID;
    v_item JSON;
    v_total_amount DECIMAL(10,2) := 0;
    v_product_id UUID;
    v_variation_id UUID;
    v_quantity INTEGER;
    v_unit_price DECIMAL(10,2);
    v_item_total DECIMAL(10,2);
BEGIN
    -- Create sale record
    INSERT INTO sales (
        branch_id, user_id, customer_name, customer_phone, 
        customer_email, payment_method, total_amount
    ) VALUES (
        p_branch_id, p_user_id, p_customer_name, p_customer_phone,
        p_customer_email, p_payment_method, 0
    ) RETURNING id INTO v_sale_id;
    
    -- Process each item
    FOR v_item IN SELECT * FROM json_array_elements(p_items)
    LOOP
        v_product_id := (v_item->>'product_id')::UUID;
        v_variation_id := CASE WHEN v_item->>'variation_id' = 'null' THEN NULL ELSE (v_item->>'variation_id')::UUID END;
        v_quantity := (v_item->>'quantity')::INTEGER;
        v_unit_price := (v_item->>'unit_price')::DECIMAL(10,2);
        v_item_total := v_quantity * v_unit_price;
        
        -- Add sale item
        INSERT INTO sale_items (
            sale_id, product_id, variation_id, quantity, unit_price, total_price
        ) VALUES (
            v_sale_id, v_product_id, v_variation_id, v_quantity, v_unit_price, v_item_total
        );
        
        -- Update inventory (reduce stock)
        PERFORM update_inventory_quantity(
            p_product_id := v_product_id,
            p_branch_id := p_branch_id,
            p_quantity_change := -v_quantity,
            p_movement_type := 'out',
            p_user_id := p_user_id,
            p_variation_id := v_variation_id,
            p_reference_type := 'sale',
            p_reference_id := v_sale_id,
            p_notes := 'Sale transaction'
        );
        
        v_total_amount := v_total_amount + v_item_total;
    END LOOP;
    
    -- Update sale total
    UPDATE sales 
    SET total_amount = v_total_amount,
        updated_at = NOW()
    WHERE id = v_sale_id;
    
    RETURN v_sale_id;
EXCEPTION
    WHEN OTHERS THEN
        -- Rollback sale if any error occurs
        IF v_sale_id IS NOT NULL THEN
            DELETE FROM sales WHERE id = v_sale_id;
        END IF;
        RAISE EXCEPTION 'Failed to create sale: %', SQLERRM;
END;
$$ LANGUAGE plpgsql;

-- Function to get accurate sales total for today (for dashboard)
CREATE OR REPLACE FUNCTION get_today_sales_total(p_branch_id VARCHAR(50) DEFAULT NULL)
RETURNS NUMERIC AS $$
DECLARE
    total_sales NUMERIC;
BEGIN
    SELECT COALESCE(SUM(s.total_amount), 0) INTO total_sales
    FROM sales s
    WHERE DATE(s.created_at) = CURRENT_DATE
      AND (p_branch_id IS NULL OR s.branch_id = p_branch_id);
    
    RETURN total_sales;
END;
$$ LANGUAGE plpgsql;

-- Function to get sales summary
CREATE OR REPLACE FUNCTION get_sales_summary(
    p_branch_id VARCHAR(50) DEFAULT NULL,
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
    branch_name VARCHAR(255),
    total_sales INTEGER,
    total_amount DECIMAL(12,2),
    avg_sale_amount DECIMAL(10,2),
    total_items_sold INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        b.name as branch_name,
        COUNT(DISTINCT s.id) as total_sales,
        SUM(s.total_amount) as total_amount,
        AVG(s.total_amount) as avg_sale_amount,
        SUM(si.quantity) as total_items_sold
    FROM sales s
    JOIN branches b ON s.branch_id = b.id
    JOIN sale_items si ON s.id = si.sale_id
    WHERE (p_branch_id IS NULL OR s.branch_id = p_branch_id)
      AND (p_start_date IS NULL OR s.sale_date >= p_start_date)
      AND (p_end_date IS NULL OR s.sale_date <= p_end_date)
    GROUP BY b.id, b.name
    ORDER BY total_amount DESC;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- TRANSFER MANAGEMENT FUNCTIONS
-- =====================================================

-- Function to create a transfer
CREATE OR REPLACE FUNCTION create_transfer(
    p_from_branch_id VARCHAR(50),
    p_to_branch_id VARCHAR(50),
    p_user_id UUID,
    p_items JSON,
    p_notes TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_transfer_id UUID;
    v_item JSON;
    v_product_id UUID;
    v_variation_id UUID;
    v_quantity INTEGER;
BEGIN
    -- Validate branches are different
    IF p_from_branch_id = p_to_branch_id THEN
        RAISE EXCEPTION 'Cannot transfer to the same branch';
    END IF;
    
    -- Create transfer record
    INSERT INTO transfers (
        from_branch_id, to_branch_id, user_id, notes
    ) VALUES (
        p_from_branch_id, p_to_branch_id, p_user_id, p_notes
    ) RETURNING id INTO v_transfer_id;
    
    -- Process each item
    FOR v_item IN SELECT * FROM json_array_elements(p_items)
    LOOP
        v_product_id := (v_item->>'product_id')::UUID;
        v_variation_id := CASE WHEN v_item->>'variation_id' = 'null' THEN NULL ELSE (v_item->>'variation_id')::UUID END;
        v_quantity := (v_item->>'quantity')::INTEGER;
        
        -- Add transfer item
        INSERT INTO transfer_items (
            transfer_id, product_id, variation_id, quantity
        ) VALUES (
            v_transfer_id, v_product_id, v_variation_id, v_quantity
        );
        
        -- Update source branch inventory (reduce stock)
        PERFORM update_inventory_quantity(
            p_product_id := v_product_id,
            p_branch_id := p_from_branch_id,
            p_quantity_change := -v_quantity,
            p_movement_type := 'transfer',
            p_user_id := p_user_id,
            p_variation_id := v_variation_id,
            p_reference_type := 'transfer',
            p_reference_id := v_transfer_id,
            p_notes := 'Transfer out'
        );
        
        -- Update destination branch inventory (add stock)
        PERFORM update_inventory_quantity(
            p_product_id := v_product_id,
            p_branch_id := p_to_branch_id,
            p_quantity_change := v_quantity,
            p_movement_type := 'transfer',
            p_user_id := p_user_id,
            p_variation_id := v_variation_id,
            p_reference_type := 'transfer',
            p_reference_id := v_transfer_id,
            p_notes := 'Transfer in'
        );
    END LOOP;
    
    -- Update transfer status to completed
    UPDATE transfers 
    SET status = 'completed',
        transfer_date = NOW(),
        updated_at = NOW()
    WHERE id = v_transfer_id;
    
    RETURN v_transfer_id;
EXCEPTION
    WHEN OTHERS THEN
        -- Rollback transfer if any error occurs
        IF v_transfer_id IS NOT NULL THEN
            DELETE FROM transfers WHERE id = v_transfer_id;
        END IF;
        RAISE EXCEPTION 'Failed to create transfer: %', SQLERRM;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- UTILITY FUNCTIONS
-- =====================================================

-- Function to refresh materialized views
CREATE OR REPLACE FUNCTION refresh_materialized_views()
RETURNS VOID AS $$
BEGIN
    REFRESH MATERIALIZED VIEW mv_dashboard_stats;
END;
$$ LANGUAGE plpgsql;

-- Function to get system statistics
CREATE OR REPLACE FUNCTION get_system_stats()
RETURNS TABLE (
    metric_name VARCHAR(100),
    metric_value TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 'total_branches'::VARCHAR(100), COUNT(*)::TEXT FROM branches WHERE is_active = TRUE
    UNION ALL
    SELECT 'total_users'::VARCHAR(100), COUNT(*)::TEXT FROM users WHERE is_active = TRUE
    UNION ALL
    SELECT 'total_products'::VARCHAR(100), COUNT(*)::TEXT FROM products WHERE is_active = TRUE
    UNION ALL
    SELECT 'total_variations'::VARCHAR(100), COUNT(*)::TEXT FROM product_variations WHERE is_active = TRUE
    UNION ALL
    SELECT 'total_inventory_items'::VARCHAR(100), COUNT(*)::TEXT FROM inventory
    UNION ALL
    SELECT 'total_sales'::VARCHAR(100), COUNT(*)::TEXT FROM sales
    UNION ALL
    SELECT 'total_transfers'::VARCHAR(100), COUNT(*)::TEXT FROM transfers
    UNION ALL
    SELECT 'database_size'::VARCHAR(100), pg_size_pretty(pg_database_size(current_database()))::TEXT;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up old data (for maintenance)
CREATE OR REPLACE FUNCTION cleanup_old_data(p_days_to_keep INTEGER DEFAULT 365)
RETURNS TABLE (
    table_name VARCHAR(100),
    records_deleted INTEGER
) AS $$
DECLARE
    v_deleted_count INTEGER;
BEGIN
    -- Clean up old stock movements
    DELETE FROM stock_movements 
    WHERE created_at < NOW() - INTERVAL '1 day' * p_days_to_keep;
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    
    RETURN QUERY SELECT 'stock_movements'::VARCHAR(100), v_deleted_count;
    
    -- Clean up old alerts
    DELETE FROM alerts 
    WHERE created_at < NOW() - INTERVAL '1 day' * p_days_to_keep
      AND status = 'resolved';
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    
    RETURN QUERY SELECT 'alerts'::VARCHAR(100), v_deleted_count;
    
    -- Refresh materialized views after cleanup
    PERFORM refresh_materialized_views();
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- FUNCTION COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON FUNCTION update_inventory_quantity IS 'Updates inventory quantity and records stock movement';
COMMENT ON FUNCTION get_low_stock_alerts IS 'Returns low stock alerts for specified branch or all branches';
COMMENT ON FUNCTION calculate_inventory_value IS 'Calculates total inventory value by branch';
COMMENT ON FUNCTION create_sale IS 'Creates a sale with multiple items and updates inventory';
COMMENT ON FUNCTION get_sales_summary IS 'Returns sales summary statistics by branch and date range';
COMMENT ON FUNCTION create_transfer IS 'Creates a transfer between branches and updates inventory';
COMMENT ON FUNCTION refresh_materialized_views IS 'Refreshes all materialized views for updated statistics';
COMMENT ON FUNCTION get_system_stats IS 'Returns system-wide statistics and metrics';
COMMENT ON FUNCTION cleanup_old_data IS 'Cleans up old data for system maintenance';
