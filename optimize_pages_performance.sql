-- Page Performance Optimization Script
-- Optimizes database performance for all pages

-- A. Recent activities function without depending on transfers.requested_by
DROP FUNCTION IF EXISTS get_recent_activities(VARCHAR(50), INTEGER);
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
        -- Sales activities with item summary
        SELECT 
            'sale'::VARCHAR as activity_type,
            (
              'Sale: ' || 
              COALESCE(
                (
                  SELECT (
                    (SELECT p2.name || CASE WHEN pv2.color IS NOT NULL OR pv2.size IS NOT NULL 
                      THEN ' (' || COALESCE(pv2.color, '') || CASE WHEN pv2.color IS NOT NULL AND pv2.size IS NOT NULL THEN ', ' ELSE '' END || COALESCE(pv2.size, '') || ')'
                      ELSE '' END
                    END)
                  ) || CASE WHEN (SELECT COUNT(*) FROM sale_items si2 WHERE si2.sale_id = s.id) > 1 THEN ' + more' ELSE '' END
                  FROM sale_items si2 
                  JOIN products p2 ON si2.product_id = p2.id 
                  LEFT JOIN product_variations pv2 ON si2.variation_id = pv2.id 
                  WHERE si2.sale_id = s.id
                  ORDER BY si2.quantity DESC
                  LIMIT 1
                ), 'Items'
              ) || ', Total: ብር ' || ROUND(s.total_amount)::TEXT
            )::TEXT as description,
            b.name as branch_name,
            u.full_name as user_name,
            timezone('Africa/Addis_Ababa', s.created_at)::timestamp as created_at,
            s.id as reference_id
        FROM sales s
        JOIN branches b ON s.branch_id = b.id
        JOIN users u ON s.user_id = u.id
        WHERE (p_branch_id IS NULL OR s.branch_id = p_branch_id)

        UNION ALL

        -- Stock movements activities (deduplicated)
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
            COALESCE(u.full_name, 'System')::VARCHAR as user_name,
            timezone('Africa/Addis_Ababa', sm.created_at)::timestamp as created_at,
            sm.id as reference_id
        FROM stock_movements sm
        JOIN products p ON sm.product_id = p.id
        LEFT JOIN product_variations pv ON sm.variation_id = pv.id
        JOIN branches b ON sm.branch_id = b.id
        LEFT JOIN users u ON sm.user_id = u.id
        WHERE (p_branch_id IS NULL OR sm.branch_id = p_branch_id)
            AND sm.reference_type != 'sale'

        UNION ALL

        -- Transfer activities (no requested_by dependency)
        SELECT 
            ('transfer_' || t.status)::VARCHAR as activity_type,
            ('Transfer ' || t.status || ': ' || 
             (SELECT STRING_AGG(p.name || ' (' || COALESCE(pv.color, '') || CASE WHEN pv.color IS NOT NULL AND pv.size IS NOT NULL THEN ', ' ELSE '' END || COALESCE(pv.size, '') || ')', ', ')
              FROM transfer_items ti 
              JOIN products p ON ti.product_id = p.id 
              LEFT JOIN product_variations pv ON ti.variation_id = pv.id 
              WHERE ti.transfer_id = t.id) || 
             ' from ' || fb.name || ' to ' || tb.name || 
             CASE WHEN t.notes IS NOT NULL AND t.notes <> '' THEN ' - ' || t.notes ELSE '' END)::TEXT as description,
            CASE 
                WHEN p_branch_id = t.from_branch_id THEN fb.name
                ELSE tb.name
            END as branch_name,
            'System'::VARCHAR as user_name,
            timezone('Africa/Addis_Ababa', COALESCE(t.completed_at, t.approved_at, t.requested_at))::timestamp as created_at,
            t.id as reference_id
        FROM transfers t
        JOIN branches fb ON t.from_branch_id = fb.id
        JOIN branches tb ON t.to_branch_id = tb.id
        WHERE (p_branch_id IS NULL OR t.from_branch_id = p_branch_id OR t.to_branch_id = p_branch_id)

        UNION ALL

        -- Product creation activities
        SELECT 
            'product_created'::VARCHAR as activity_type,
            ('New Product: ' || p.name || ' (SKU: ' || p.sku || ')')::TEXT as description,
            'System'::VARCHAR as branch_name,
            'System'::VARCHAR as user_name,
            timezone('Africa/Addis_Ababa', p.created_at)::timestamp as created_at,
            p.id as reference_id
        FROM products p
        WHERE p.created_at >= CURRENT_DATE - INTERVAL '7 days'
            AND p.created_at IS NOT NULL

        UNION ALL

        -- Product variation activities
        SELECT 
            'variation_created'::VARCHAR as activity_type,
            ('New Variation: ' || p.name || ' - ' || 
             COALESCE(pv.color, '') || CASE WHEN pv.color IS NOT NULL AND pv.size IS NOT NULL THEN ', ' ELSE '' END || 
             COALESCE(pv.size, '') || ' (SKU: ' || pv.sku || ')'
             || CASE WHEN pv.price IS NOT NULL THEN ' - Price: $' || pv.price ELSE '' END)::TEXT as description,
            'System'::VARCHAR as branch_name,
            'System'::VARCHAR as user_name,
            timezone('Africa/Addis_Ababa', pv.created_at)::timestamp as created_at,
            pv.id as reference_id
        FROM product_variations pv
        JOIN products p ON pv.product_id = p.id
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
            timezone('Africa/Addis_Ababa', i.updated_at)::timestamp as created_at,
            i.id as reference_id
        FROM inventory i
        JOIN products p ON i.product_id = p.id
        LEFT JOIN product_variations pv ON i.variation_id = pv.id
        JOIN branches b ON i.branch_id = b.id
        WHERE (p_branch_id IS NULL OR i.branch_id = p_branch_id)
            AND i.updated_at >= CURRENT_DATE - INTERVAL '7 days'
            AND i.updated_at IS NOT NULL
            AND i.updated_at <> i.created_at
    )
    ORDER BY created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- 1. Create optimized dashboard function
CREATE OR REPLACE FUNCTION get_dashboard_optimized(p_branch_id VARCHAR DEFAULT NULL)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'stats', (SELECT row_to_json(stats) FROM get_dashboard_stats(p_branch_id) stats),
        'recent_activities', (
            SELECT COALESCE(json_agg(row_to_json(ra)), '[]'::json)
            FROM get_recent_activities(p_branch_id, 10) ra
        ),
        'stock_trend', (SELECT COALESCE(json_agg(row_to_json(st)), '[]'::json) FROM get_stock_trend(p_branch_id) st),
        'top_selling_today', (SELECT COALESCE(json_agg(row_to_json(tst)), '[]'::json) FROM get_top_selling_today(p_branch_id) tst),
        'top_selling_week', (SELECT COALESCE(json_agg(row_to_json(tsw)), '[]'::json) FROM get_top_selling_week(p_branch_id) tsw),
        'low_stock_products', (SELECT COALESCE(json_agg(row_to_json(lsp)), '[]'::json) FROM get_low_stock_products(p_branch_id, 10) lsp),
        'recent_updates', (SELECT COALESCE(json_agg(row_to_json(rpu)), '[]'::json) FROM get_recent_product_updates(p_branch_id, 7) rpu)
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 2. Create optimized inventory function
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

-- 3. Create optimized reports function
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

-- 4. Create optimized stock function
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

-- 5. Create optimized transfer function
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

-- 6. Create additional indexes for page performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stock_movements_created_desc ON stock_movements(created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sales_created_desc ON sales(created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transfers_requested_desc ON transfers(requested_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_name_sku ON products(name, sku);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inventory_branch_qty ON inventory(branch_id, quantity);

-- 7. Create materialized view for inventory summary
CREATE MATERIALIZED VIEW IF NOT EXISTS inventory_summary_fast AS
SELECT 
    p.id as product_id,
    p.name as product_name,
    p.sku as product_sku,
    c.name as category_name,
    p.brand,
    COUNT(pv.id) as variation_count,
    SUM(i.quantity) as total_quantity,
    COUNT(CASE WHEN i.quantity <= i.min_stock_level THEN 1 END) as low_stock_count,
    COUNT(CASE WHEN i.quantity = 0 THEN 1 END) as out_of_stock_count
FROM products p
LEFT JOIN categories c ON p.category_id = c.id
LEFT JOIN product_variations pv ON p.id = pv.product_id AND pv.is_active = true
LEFT JOIN inventory i ON pv.id = i.variation_id
WHERE p.is_active = true
GROUP BY p.id, p.name, p.sku, c.name, p.brand;

CREATE INDEX IF NOT EXISTS idx_inventory_summary_fast_lookup ON inventory_summary_fast(product_id);

-- 8. Create refresh function
CREATE OR REPLACE FUNCTION refresh_page_optimizations()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY inventory_summary_fast;
END;
$$ LANGUAGE plpgsql;

-- 9. Show results
SELECT 
    'Page Performance Optimization Complete!' as status,
    'Created optimized functions for all pages' as details;

-- Show created functions
SELECT 
    'Optimized Functions' as category,
    routine_name as function_name
FROM information_schema.routines 
WHERE routine_name IN (
    'get_dashboard_optimized',
    'get_inventory_fast',
    'get_reports_fast',
    'get_stock_fast',
    'get_transfer_fast',
    'refresh_page_optimizations'
)
AND routine_schema = 'public';
