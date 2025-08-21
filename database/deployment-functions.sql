-- =====================================================
-- MENAL KIDS SYSTEM - PRODUCTION DATABASE FUNCTIONS
-- =====================================================
-- This file contains all essential database functions and procedures
-- for the production system
-- =====================================================

-- =====================================================
-- INVENTORY MANAGEMENT FUNCTIONS
-- =====================================================

-- Function to update inventory quantity
CREATE OR REPLACE FUNCTION update_inventory_quantity(
    p_product_id UUID,
    p_variation_id UUID DEFAULT NULL,
    p_branch_id VARCHAR(50),
    p_quantity_change INTEGER,
    p_movement_type VARCHAR(20),
    p_user_id UUID,
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
    p_customer_name VARCHAR(255) DEFAULT NULL,
    p_customer_phone VARCHAR(20) DEFAULT NULL,
    p_customer_email VARCHAR(255) DEFAULT NULL,
    p_payment_method VARCHAR(50) DEFAULT 'cash',
    p_items JSON
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
            v_product_id, v_variation_id, p_branch_id, 
            -v_quantity, 'out', p_user_id, 'sale', v_sale_id,
            'Sale transaction'
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
            v_product_id, v_variation_id, p_from_branch_id, 
            -v_quantity, 'transfer', p_user_id, 'transfer', v_transfer_id,
            'Transfer out'
        );
        
        -- Update destination branch inventory (add stock)
        PERFORM update_inventory_quantity(
            v_product_id, v_variation_id, p_to_branch_id, 
            v_quantity, 'transfer', p_user_id, 'transfer', v_transfer_id,
            'Transfer in'
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
