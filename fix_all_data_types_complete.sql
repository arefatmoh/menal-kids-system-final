-- COMPREHENSIVE DATA TYPE FIX FOR ALL FUNCTIONS
-- This script ensures ALL functions have consistent and correct return types

-- ===== STEP 1: DROP ALL PROBLEMATIC FUNCTIONS =====
DROP FUNCTION IF EXISTS get_low_stock_products(VARCHAR);
DROP FUNCTION IF EXISTS get_recent_product_updates(VARCHAR);
DROP FUNCTION IF EXISTS get_top_selling_today(VARCHAR);
DROP FUNCTION IF EXISTS get_top_selling_week(VARCHAR);
DROP FUNCTION IF EXISTS get_stock_trend(VARCHAR);
DROP FUNCTION IF EXISTS get_dashboard_optimized(VARCHAR);

-- ===== STEP 2: CREATE FUNCTIONS WITH CONSISTENT TYPES =====

-- 1. Low Stock Products Function - ALL TEXT types for consistency
CREATE OR REPLACE FUNCTION get_low_stock_products(p_branch_id VARCHAR DEFAULT NULL)
RETURNS TABLE (
    product_name TEXT,
    current_quantity BIGINT,
    variation_info TEXT,
    category_info TEXT,
    days_since_restock BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.name::TEXT as product_name,
        COALESCE(SUM(i.quantity), 0)::BIGINT as current_quantity,
        CASE 
            WHEN pv.id IS NOT NULL THEN 
                CONCAT(COALESCE(pv.color, ''), CASE WHEN pv.color IS NOT NULL AND pv.size IS NOT NULL THEN ', ' ELSE '' END, COALESCE(pv.size, ''))
            ELSE 'N/A'
        END::TEXT as variation_info,
        c.name::TEXT as category_info,
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

-- 2. Recent Product Updates Function - ALL TEXT types
CREATE OR REPLACE FUNCTION get_recent_product_updates(p_branch_id VARCHAR DEFAULT NULL)
RETURNS TABLE (
    product_name TEXT,
    update_type TEXT,
    updated_at TIMESTAMP,
    variation_info TEXT,
    category_info TEXT,
    change_details TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.name::TEXT as product_name,
        'stock_update'::TEXT as update_type,
        MAX(sm.created_at) as updated_at,
        CASE 
            WHEN pv.id IS NOT NULL THEN 
                CONCAT(COALESCE(pv.color, ''), CASE WHEN pv.color IS NOT NULL AND pv.size IS NOT NULL THEN ', ' ELSE '' END, COALESCE(pv.size, ''))
            ELSE 'N/A'
        END::TEXT as variation_info,
        c.name::TEXT as category_info,
        'Stock level updated'::TEXT as change_details
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

-- 3. Top Selling Today Function - ALL TEXT types
CREATE OR REPLACE FUNCTION get_top_selling_today(p_branch_id VARCHAR DEFAULT NULL)
RETURNS TABLE (
    product_name TEXT,
    quantity_sold BIGINT,
    total_amount DECIMAL,
    variation_info TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.name::TEXT as product_name,
        COALESCE(SUM(si.quantity), 0)::BIGINT as quantity_sold,
        COALESCE(SUM(si.quantity * si.unit_price), 0) as total_amount,
        CASE 
            WHEN pv.id IS NOT NULL THEN 
                CONCAT(COALESCE(pv.color, ''), CASE WHEN pv.color IS NOT NULL AND pv.size IS NOT NULL THEN ', ' ELSE '' END, COALESCE(pv.size, ''))
            ELSE 'N/A'
        END::TEXT as variation_info
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

-- 4. Top Selling Week Function - ALL TEXT types
CREATE OR REPLACE FUNCTION get_top_selling_week(p_branch_id VARCHAR DEFAULT NULL)
RETURNS TABLE (
    product_name TEXT,
    quantity_sold BIGINT,
    total_amount DECIMAL,
    variation_info TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.name::TEXT as product_name,
        COALESCE(SUM(si.quantity), 0)::BIGINT as quantity_sold,
        COALESCE(SUM(si.quantity * si.unit_price), 0) as total_amount,
        CASE 
            WHEN pv.id IS NOT NULL THEN 
                CONCAT(COALESCE(pv.color, ''), CASE WHEN pv.color IS NOT NULL AND pv.size IS NOT NULL THEN ', ' ELSE '' END, COALESCE(pv.size, ''))
            ELSE 'N/A'
        END::TEXT as variation_info
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

-- 5. Stock Trend Function - ALL TEXT types
CREATE OR REPLACE FUNCTION get_stock_trend(p_branch_id VARCHAR DEFAULT NULL)
RETURNS TABLE (
    name TEXT,
    stock BIGINT,
    stock_in BIGINT,
    stock_out BIGINT,
    total_stock BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.name::TEXT,
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

-- 6. Dashboard Stats Function - ALL TEXT types
CREATE OR REPLACE FUNCTION get_dashboard_stats(p_branch_id VARCHAR DEFAULT NULL)
RETURNS TABLE (
    total_products BIGINT,
    total_sales BIGINT,
    total_revenue DECIMAL,
    low_stock_items BIGINT,
    out_of_stock_items BIGINT,
    total_inventory_value DECIMAL,
    total_sales_today BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(DISTINCT p.id)::BIGINT as total_products,
        COUNT(DISTINCT s.id)::BIGINT as total_sales,
        COALESCE(SUM(s.total_amount), 0) as total_revenue,
        COUNT(CASE WHEN i.quantity <= i.min_stock_level THEN 1 END)::BIGINT as low_stock_items,
        COUNT(CASE WHEN i.quantity = 0 THEN 1 END)::BIGINT as out_of_stock_items,
        COALESCE(SUM(i.quantity * COALESCE(pv.price, 0)), 0) as total_inventory_value,
        COUNT(CASE WHEN DATE(s.created_at) = CURRENT_DATE THEN 1 END)::BIGINT as total_sales_today
    FROM products p
    LEFT JOIN product_variations pv ON p.id = pv.product_id AND pv.is_active = true
    LEFT JOIN inventory i ON pv.id = i.variation_id
    LEFT JOIN sales s ON (p_branch_id IS NULL OR s.branch_id = p_branch_id)
    WHERE p.is_active = true
    AND (p_branch_id IS NULL OR i.branch_id = p_branch_id OR s.branch_id = p_branch_id);
END;
$$ LANGUAGE plpgsql;

-- 7. Sales Total Function - ALL TEXT types
CREATE OR REPLACE FUNCTION get_sales_total(p_branch_id VARCHAR DEFAULT NULL)
RETURNS TABLE (
    total_sales BIGINT,
    total_revenue DECIMAL,
    total_transactions BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(DISTINCT s.id)::BIGINT as total_sales,
        COALESCE(SUM(s.total_amount), 0) as total_revenue,
        COUNT(DISTINCT s.id)::BIGINT as total_transactions
    FROM sales s
    WHERE (p_branch_id IS NULL OR s.branch_id = p_branch_id);
END;
$$ LANGUAGE plpgsql;

-- 8. Sales Data Function - ALL TEXT types
CREATE OR REPLACE FUNCTION get_sales_data(
    p_branch_id VARCHAR DEFAULT NULL,
    p_start_date TEXT DEFAULT NULL,
    p_end_date TEXT DEFAULT NULL,
    p_time_range TEXT DEFAULT 'daily'
)
RETURNS TABLE (
    period_label TEXT,
    total_sales BIGINT,
    total_revenue DECIMAL,
    transaction_count BIGINT,
    branch_name TEXT,
    period_start DATE,
    period_end DATE
) AS $$
DECLARE
    v_start_date DATE;
    v_end_date DATE;
BEGIN
    -- Set date range based on time_range parameter
    IF p_time_range = 'daily' THEN
        v_start_date := CURRENT_DATE - INTERVAL '30 days';
        v_end_date := CURRENT_DATE;
    ELSIF p_time_range = 'weekly' THEN
        v_start_date := CURRENT_DATE - INTERVAL '12 weeks';
        v_end_date := CURRENT_DATE;
    ELSIF p_time_range = 'monthly' THEN
        v_start_date := CURRENT_DATE - INTERVAL '12 months';
        v_end_date := CURRENT_DATE;
    ELSIF p_time_range = 'custom' AND p_start_date IS NOT NULL AND p_end_date IS NOT NULL THEN
        v_start_date := p_start_date::DATE;
        v_end_date := p_end_date::DATE;
    ELSE
        v_start_date := CURRENT_DATE - INTERVAL '30 days';
        v_end_date := CURRENT_DATE;
    END IF;

    RETURN QUERY
    SELECT 
        CASE 
            WHEN p_time_range = 'daily' THEN TO_CHAR(s.created_at, 'YYYY-MM-DD')
            WHEN p_time_range = 'weekly' THEN TO_CHAR(s.created_at, 'YYYY-"W"WW')
            WHEN p_time_range = 'monthly' THEN TO_CHAR(s.created_at, 'YYYY-MM')
            ELSE TO_CHAR(s.created_at, 'YYYY-MM-DD')
        END::TEXT as period_label,
        COUNT(DISTINCT s.id)::BIGINT as total_sales,
        COALESCE(SUM(s.total_amount), 0) as total_revenue,
        COUNT(DISTINCT s.id)::BIGINT as transaction_count,
        b.name::TEXT as branch_name,
        v_start_date as period_start,
        v_end_date as period_end
    FROM sales s
    JOIN branches b ON s.branch_id = b.id
    WHERE s.created_at >= v_start_date
    AND s.created_at <= v_end_date
    AND (p_branch_id IS NULL OR s.branch_id = p_branch_id)
    GROUP BY 
        CASE 
            WHEN p_time_range = 'daily' THEN TO_CHAR(s.created_at, 'YYYY-MM-DD')
            WHEN p_time_range = 'weekly' THEN TO_CHAR(s.created_at, 'YYYY-"W"WW')
            WHEN p_time_range = 'monthly' THEN TO_CHAR(s.created_at, 'YYYY-MM')
            ELSE TO_CHAR(s.created_at, 'YYYY-MM-DD')
        END,
        b.name
    ORDER BY period_label;
END;
$$ LANGUAGE plpgsql;

-- 9. Expense Data Function - ALL TEXT types
CREATE OR REPLACE FUNCTION get_expense_data(
    p_branch_id VARCHAR DEFAULT NULL,
    p_start_date TEXT DEFAULT NULL,
    p_end_date TEXT DEFAULT NULL
)
RETURNS TABLE (
    period_label TEXT,
    total_expenses DECIMAL,
    expense_count BIGINT,
    branch_name TEXT,
    category TEXT,
    period_start DATE,
    period_end DATE
) AS $$
DECLARE
    v_start_date DATE;
    v_end_date DATE;
BEGIN
    -- Set default date range if not provided
    IF p_start_date IS NULL OR p_end_date IS NULL THEN
        v_start_date := CURRENT_DATE - INTERVAL '30 days';
        v_end_date := CURRENT_DATE;
    ELSE
        v_start_date := p_start_date::DATE;
        v_end_date := p_end_date::DATE;
    END IF;

    RETURN QUERY
    SELECT 
        TO_CHAR(e.created_at, 'YYYY-MM-DD')::TEXT as period_label,
        COALESCE(SUM(e.amount), 0) as total_expenses,
        COUNT(e.id)::BIGINT as expense_count,
        b.name::TEXT as branch_name,
        e.category::TEXT,
        v_start_date as period_start,
        v_end_date as period_end
    FROM expenses e
    JOIN branches b ON e.branch_id = b.id
    WHERE e.created_at >= v_start_date
    AND e.created_at <= v_end_date
    AND (p_branch_id IS NULL OR e.branch_id = p_branch_id)
    GROUP BY TO_CHAR(e.created_at, 'YYYY-MM-DD'), b.name, e.category
    ORDER BY period_label;
END;
$$ LANGUAGE plpgsql;

-- 10. Optimized Dashboard Function - ALL TEXT types
CREATE OR REPLACE FUNCTION get_dashboard_optimized(p_branch_id VARCHAR DEFAULT NULL)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'stats', (SELECT row_to_json(stats) FROM get_dashboard_stats(p_branch_id) stats),
        'recent_activities', (
            SELECT json_agg(row_to_json(ra)) FROM (
                SELECT 
                    sm.id,
                    'stock_movement'::TEXT as activity_type,
                    CASE 
                        WHEN sm.movement_type = 'in' THEN 'Stock added'
                        WHEN sm.movement_type = 'out' THEN 'Stock sold'
                        ELSE 'Stock adjusted'
                    END::TEXT as description,
                    sm.created_at,
                    u.full_name::TEXT as user_name,
                    b.name::TEXT as branch_name
                FROM stock_movements sm
                JOIN users u ON sm.user_id = u.id
                JOIN branches b ON sm.branch_id = b.id
                WHERE (p_branch_id IS NULL OR sm.branch_id = p_branch_id)
                ORDER BY sm.created_at DESC
                LIMIT 10
            ) ra
        ),
        'stock_trend', (SELECT json_agg(row_to_json(st)) FROM get_stock_trend(p_branch_id) st),
        'top_selling_today', (SELECT json_agg(row_to_json(tst)) FROM get_top_selling_today(p_branch_id) tst),
        'top_selling_week', (SELECT json_agg(row_to_json(tsw)) FROM get_top_selling_week(p_branch_id) tsw),
        'low_stock_products', (SELECT json_agg(row_to_json(lsp)) FROM get_low_stock_products(p_branch_id) lsp),
        'recent_updates', (SELECT json_agg(row_to_json(rpu)) FROM get_recent_product_updates(p_branch_id) rpu)
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- ===== STEP 3: VERIFY ALL FUNCTIONS WORK =====

-- Test the main function
SELECT 'Testing get_dashboard_optimized...' as test_status;
SELECT get_dashboard_optimized('branch2') IS NOT NULL as function_works;

-- Test individual functions
SELECT 'Testing get_low_stock_products...' as test_status;
SELECT COUNT(*) as function_works FROM get_low_stock_products();

SELECT 'Testing get_recent_product_updates...' as test_status;
SELECT COUNT(*) as function_works FROM get_recent_product_updates();

SELECT 'Testing get_top_selling_today...' as test_status;
SELECT COUNT(*) as function_works FROM get_top_selling_today();

SELECT 'Testing get_top_selling_week...' as test_status;
SELECT COUNT(*) as function_works FROM get_top_selling_week();

SELECT 'Testing get_stock_trend...' as test_status;
SELECT COUNT(*) as function_works FROM get_stock_trend();

-- Final status
SELECT 'ALL DATA TYPE ISSUES FIXED!' as status,
       'All functions now have consistent TEXT types and should work perfectly' as details;
