-- Fix All Duplicate Functions and Database Issues - Complete Solution
-- This script will clean up duplicates and create fresh, working functions

-- ===== STEP 1: DROP ALL EXISTING FUNCTIONS =====
-- This ensures we start with a clean slate

DO $$ 
DECLARE 
    func_name TEXT;
BEGIN
    -- Drop all functions that might be duplicated
    FOR func_name IN 
        SELECT routine_name 
        FROM information_schema.routines 
        WHERE routine_schema = 'public' 
        AND routine_name IN (
            'get_dashboard_stats',
            'get_stock_trend', 
            'get_top_selling_today',
            'get_top_selling_week',
            'get_low_stock_products',
            'get_recent_product_updates',
            'get_sales_total',
            'get_sales_data',
            'get_expense_data',
            'get_dashboard_optimized',
            'get_inventory_fast',
            'get_reports_fast',
            'get_stock_fast',
            'get_transfer_fast'
        )
    LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS ' || func_name || '(VARCHAR) CASCADE';
        EXECUTE 'DROP FUNCTION IF EXISTS ' || func_name || '(VARCHAR, INTEGER, INTEGER) CASCADE';
        EXECUTE 'DROP FUNCTION IF EXISTS ' || func_name || '(VARCHAR, INTEGER, INTEGER, TEXT, VARCHAR, BOOLEAN) CASCADE';
        EXECUTE 'DROP FUNCTION IF EXISTS ' || func_name || '(VARCHAR, DATE, DATE, VARCHAR) CASCADE';
        EXECUTE 'DROP FUNCTION IF EXISTS ' || func_name || '(VARCHAR, TEXT, TEXT) CASCADE';
        EXECUTE 'DROP FUNCTION IF EXISTS ' || func_name || '() CASCADE';
        EXECUTE 'DROP FUNCTION IF EXISTS ' || func_name || '(INTEGER, INTEGER, TEXT, VARCHAR, BOOLEAN) CASCADE';
        EXECUTE 'DROP FUNCTION IF EXISTS ' || func_name || '(INTEGER, INTEGER) CASCADE';
        EXECUTE 'DROP FUNCTION IF EXISTS ' || func_name || '(VARCHAR, INTEGER, INTEGER) CASCADE';
    END LOOP;
END $$;

-- ===== STEP 2: CREATE FRESH, CLEAN FUNCTIONS =====

-- 1. Dashboard Stats Function
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

-- 2. Stock Trend Function
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

-- 3. Top Selling Today Function
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
        END as variation_info
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

-- 4. Top Selling Week Function
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
        END as variation_info
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

-- 5. Low Stock Products Function
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
        c.name as category_info,
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

-- 6. Recent Product Updates Function
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
        c.name as category_info,
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

-- 7. Sales Total Function
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

-- 8. Sales Data Function
CREATE OR REPLACE FUNCTION get_sales_data(
    p_branch_id VARCHAR DEFAULT NULL,
    p_start_date TEXT DEFAULT NULL,
    p_end_date TEXT DEFAULT NULL,
    p_time_range VARCHAR DEFAULT 'daily'
)
RETURNS TABLE (
    period_label TEXT,
    total_sales BIGINT,
    total_revenue DECIMAL,
    transaction_count BIGINT,
    branch_name VARCHAR,
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
        END as period_label,
        COUNT(DISTINCT s.id)::BIGINT as total_sales,
        COALESCE(SUM(s.total_amount), 0) as total_revenue,
        COUNT(DISTINCT s.id)::BIGINT as transaction_count,
        b.name as branch_name,
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

-- 9. Expense Data Function
CREATE OR REPLACE FUNCTION get_expense_data(
    p_branch_id VARCHAR DEFAULT NULL,
    p_start_date TEXT DEFAULT NULL,
    p_end_date TEXT DEFAULT NULL
)
RETURNS TABLE (
    period_label TEXT,
    total_expenses DECIMAL,
    expense_count BIGINT,
    branch_name VARCHAR,
    category VARCHAR,
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
        TO_CHAR(e.created_at, 'YYYY-MM-DD') as period_label,
        COALESCE(SUM(e.amount), 0) as total_expenses,
        COUNT(e.id)::BIGINT as expense_count,
        b.name as branch_name,
        e.category,
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

-- ===== STEP 3: CREATE OPTIMIZED FUNCTIONS =====

-- 10. Optimized Dashboard Function
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
                    'stock_movement' as activity_type,
                    CASE 
                        WHEN sm.movement_type = 'in' THEN 'Stock added'
                        WHEN sm.movement_type = 'out' THEN 'Stock sold'
                        ELSE 'Stock adjusted'
                    END as description,
                    sm.created_at,
                    u.full_name as user_name,
                    b.name as branch_name
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

-- 11. Optimized Inventory Function
CREATE OR REPLACE FUNCTION get_inventory_fast(
    p_page INTEGER DEFAULT 1,
    p_limit INTEGER DEFAULT 20,
    p_search TEXT DEFAULT NULL,
    p_branch_id VARCHAR DEFAULT NULL,
    p_cross_branch BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
    data JSON,
    pagination JSON
) AS $$
DECLARE
    v_data JSON;
    v_pagination JSON;
    v_total INTEGER;
    v_offset INTEGER;
    v_where_clause TEXT := 'WHERE p.is_active = true';
    v_params TEXT[] := ARRAY[]::TEXT[];
    v_param_count INTEGER := 0;
BEGIN
    v_offset := (p_page - 1) * p_limit;

    -- Build WHERE clause
    IF p_branch_id IS NOT NULL AND NOT p_cross_branch THEN
        v_param_count := v_param_count + 1;
        v_where_clause := v_where_clause || ' AND i.branch_id = $' || v_param_count;
        v_params := array_append(v_params, p_branch_id);
    END IF;

    IF p_search IS NOT NULL AND p_search != '' THEN
        v_param_count := v_param_count + 1;
        v_where_clause := v_where_clause || ' AND (p.name ILIKE $' || v_param_count || ' OR p.sku ILIKE $' || v_param_count || ')';
        v_params := array_append(v_params, '%' || p_search || '%');
    END IF;

    -- Get total count
    EXECUTE 'SELECT COUNT(DISTINCT p.id) FROM products p LEFT JOIN inventory i ON p.id = i.product_id ' || v_where_clause
    INTO v_total
    USING v_params;

    -- Get data
    EXECUTE '
        SELECT json_agg(
            json_build_object(
                ''product_id'', p.id,
                ''product_name'', p.name,
                ''sku'', p.sku,
                ''category_name'', c.name,
                ''brand'', p.brand,
                ''total_stock'', COALESCE(stock.total_quantity, 0),
                ''low_stock_count'', COALESCE(stock.low_stock_count, 0),
                ''out_of_stock_count'', COALESCE(stock.out_of_stock_count, 0)
            )
        )
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        LEFT JOIN (
            SELECT 
                i.product_id,
                SUM(i.quantity) as total_quantity,
                COUNT(CASE WHEN i.quantity <= i.min_stock_level THEN 1 END) as low_stock_count,
                COUNT(CASE WHEN i.quantity = 0 THEN 1 END) as out_of_stock_count
            FROM inventory i
            GROUP BY i.product_id
        ) stock ON p.id = stock.product_id
        ' || v_where_clause || '
        ORDER BY p.name
        LIMIT $' || (v_param_count + 1) || ' OFFSET $' || (v_param_count + 2)
    INTO v_data
    USING array_append(array_append(v_params, p_limit::TEXT), v_offset::TEXT);

    -- Build pagination
    v_pagination := json_build_object(
        'page', p_page,
        'limit', p_limit,
        'total', v_total,
        'total_pages', CEIL(v_total::DECIMAL / p_limit),
        'has_next', p_page * p_limit < v_total,
        'has_prev', p_page > 1
    );

    RETURN QUERY SELECT 
        COALESCE(v_data, '[]'::json),
        v_pagination;
END;
$$ LANGUAGE plpgsql;

-- 12. Optimized Reports Function
CREATE OR REPLACE FUNCTION get_reports_fast(
    p_time_range VARCHAR DEFAULT 'daily',
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL,
    p_branch_id VARCHAR DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'sales', (SELECT json_agg(row_to_json(sr)) FROM get_sales_data(p_branch_id, p_start_date::TEXT, p_end_date::TEXT, p_time_range) sr),
        'expenses', (SELECT json_agg(row_to_json(er)) FROM get_expense_data(p_branch_id, p_start_date::TEXT, p_end_date::TEXT) er),
        'summary', json_build_object(
            'total_revenue', COALESCE((SELECT SUM(total_revenue) FROM get_sales_data(p_branch_id, p_start_date::TEXT, p_end_date::TEXT, p_time_range)), 0),
            'total_expenses', COALESCE((SELECT SUM(total_expenses) FROM get_expense_data(p_branch_id, p_start_date::TEXT, p_end_date::TEXT)), 0),
            'time_range', p_time_range
        )
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 13. Optimized Stock Function
CREATE OR REPLACE FUNCTION get_stock_fast(
    p_branch_id VARCHAR DEFAULT NULL,
    p_page INTEGER DEFAULT 1,
    p_limit INTEGER DEFAULT 50
)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'products', (
            SELECT json_agg(
                json_build_object(
                    'product_id', p.id,
                    'product_name', p.name,
                    'sku', p.sku,
                    'category_name', c.name,
                    'total_stock', COALESCE(stock.total_quantity, 0),
                    'low_stock_count', COALESCE(stock.low_stock_count, 0)
                )
            )
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            LEFT JOIN (
                SELECT 
                    i.product_id,
                    SUM(i.quantity) as total_quantity,
                    COUNT(CASE WHEN i.quantity <= i.min_stock_level THEN 1 END) as low_stock_count
                FROM inventory i
                WHERE (p_branch_id IS NULL OR i.branch_id = p_branch_id)
                GROUP BY i.product_id
            ) stock ON p.id = stock.product_id
            WHERE p.is_active = true
            ORDER BY p.name
            LIMIT p_limit OFFSET (p_page - 1) * p_limit
        ),
        'movements', (
            SELECT json_agg(
                json_build_object(
                    'id', sm.id,
                    'product_name', p.name,
                    'movement_type', sm.movement_type,
                    'quantity', sm.quantity,
                    'branch_name', b.name,
                    'created_at', sm.created_at
                )
            )
            FROM stock_movements sm
            JOIN products p ON sm.product_id = p.id
            JOIN branches b ON sm.branch_id = b.id
            WHERE (p_branch_id IS NULL OR sm.branch_id = p_branch_id)
            ORDER BY sm.created_at DESC
            LIMIT p_limit OFFSET (p_page - 1) * p_limit
        ),
        'branches', (
            SELECT json_agg(
                json_build_object(
                    'id', b.id,
                    'name', b.name
                )
            )
            FROM branches b
            WHERE b.is_active = true
        )
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 14. Optimized Transfer Function
CREATE OR REPLACE FUNCTION get_transfer_fast(
    p_from_branch_id VARCHAR DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'products', (
            SELECT json_agg(
                json_build_object(
                    'product_id', p.id,
                    'product_name', p.name,
                    'sku', p.sku,
                    'category_name', c.name,
                    'available_quantity', COALESCE(inv.quantity, 0)
                )
            )
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            LEFT JOIN inventory inv ON p.id = inv.product_id
            WHERE p.is_active = true
            AND (p_from_branch_id IS NULL OR inv.branch_id = p_from_branch_id)
            ORDER BY p.name
        ),
        'transfers', (
            SELECT json_agg(
                json_build_object(
                    'id', t.id,
                    'from_branch_name', fb.name,
                    'to_branch_name', tb.name,
                    'status', t.status,
                    'requested_at', t.requested_at
                )
            )
            FROM transfers t
            JOIN branches fb ON t.from_branch_id = fb.id
            JOIN branches tb ON t.to_branch_id = tb.id
            WHERE (p_from_branch_id IS NULL OR t.from_branch_id = p_from_branch_id)
            ORDER BY t.requested_at DESC
        ),
        'branches', (
            SELECT json_agg(
                json_build_object(
                    'id', b.id,
                    'name', b.name
                )
            )
            FROM branches b
            WHERE b.is_active = true
        )
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- ===== STEP 4: VERIFY CLEAN SETUP =====

-- Show final status
SELECT 
    'Database Functions Fixed and Cleaned!' as status,
    'All duplicate functions removed and fresh functions created' as details;

-- Show all created functions (should be exactly 14)
SELECT 
    'Created Functions' as category,
    routine_name as function_name,
    'Ready' as status
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN (
    'get_dashboard_stats',
    'get_stock_trend',
    'get_top_selling_today',
    'get_top_selling_week',
    'get_low_stock_products',
    'get_recent_product_updates',
    'get_sales_total',
    'get_sales_data',
    'get_expense_data',
    'get_dashboard_optimized',
    'get_inventory_fast',
    'get_reports_fast',
    'get_stock_fast',
    'get_transfer_fast'
)
ORDER BY routine_name;

-- Count total functions to ensure no duplicates
SELECT 
    'Function Count' as info,
    COUNT(*) as total_functions,
    CASE 
        WHEN COUNT(*) = 14 THEN '✅ Perfect - No duplicates!'
        ELSE '❌ Warning - Duplicates detected!'
    END as status
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN (
    'get_dashboard_stats',
    'get_stock_trend',
    'get_top_selling_today',
    'get_top_selling_week',
    'get_low_stock_products',
    'get_recent_product_updates',
    'get_sales_total',
    'get_sales_data',
    'get_expense_data',
    'get_dashboard_optimized',
    'get_inventory_fast',
    'get_reports_fast',
    'get_stock_fast',
    'get_transfer_fast'
);
