-- Comprehensive Page Performance Optimization Script
-- This script optimizes database performance for ALL pages

-- 1. Create optimized dashboard function (combines multiple queries)
CREATE OR REPLACE FUNCTION get_dashboard_data_optimized(p_branch_id VARCHAR DEFAULT NULL)
RETURNS TABLE (
    stats JSON,
    recent_activities JSON,
    stock_trend JSON,
    top_selling_today JSON,
    top_selling_week JSON,
    low_stock_products JSON,
    recent_updates JSON,
    sales_total JSON
) AS $$
DECLARE
    v_stats JSON;
    v_activities JSON;
    v_stock_trend JSON;
    v_top_today JSON;
    v_top_week JSON;
    v_low_stock JSON;
    v_updates JSON;
    v_sales_total JSON;
BEGIN
    -- Get dashboard stats
    SELECT json_build_object(
        'total_products', COALESCE(stats.total_products, 0),
        'total_sales', COALESCE(stats.total_sales, 0),
        'total_revenue', COALESCE(stats.total_revenue, 0),
        'low_stock_items', COALESCE(stats.low_stock_items, 0),
        'out_of_stock_items', COALESCE(stats.out_of_stock_items, 0),
        'total_inventory_value', COALESCE(stats.total_inventory_value, 0)
    ) INTO v_stats
    FROM get_dashboard_stats(p_branch_id) stats;

    -- Get recent activities (optimized)
    SELECT json_agg(
        json_build_object(
            'id', ra.id,
            'type', ra.activity_type,
            'description', ra.description,
            'created_at', ra.created_at,
            'user_name', ra.user_name,
            'branch_name', ra.branch_name,
            'reference_id', ra.reference_id
        )
    ) INTO v_activities
    FROM (
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
            b.name as branch_name,
            sm.id as reference_id
        FROM stock_movements sm
        JOIN users u ON sm.user_id = u.id
        JOIN branches b ON sm.branch_id = b.id
        WHERE (p_branch_id IS NULL OR sm.branch_id = p_branch_id)
        UNION ALL
        SELECT 
            s.id,
            'sale' as activity_type,
            'Sale completed' as description,
            s.created_at,
            u.full_name as user_name,
            b.name as branch_name,
            s.id as reference_id
        FROM sales s
        JOIN users u ON s.user_id = u.id
        JOIN branches b ON s.branch_id = b.id
        WHERE (p_branch_id IS NULL OR s.branch_id = p_branch_id)
        ORDER BY created_at DESC
        LIMIT 10
    ) ra;

    -- Get stock trend (optimized)
    SELECT json_agg(
        json_build_object(
            'name', st.name,
            'stock', st.stock,
            'stock_in', st.stock_in,
            'stock_out', st.stock_out,
            'total_stock', st.total_stock
        )
    ) INTO v_stock_trend
    FROM get_stock_trend(p_branch_id) st;

    -- Get top selling today (optimized)
    SELECT json_agg(
        json_build_object(
            'product_name', tst.product_name,
            'quantity_sold', tst.quantity_sold,
            'total_amount', tst.total_amount,
            'variation_info', tst.variation_info
        )
    ) INTO v_top_today
    FROM get_top_selling_today(p_branch_id) tst;

    -- Get top selling week (optimized)
    SELECT json_agg(
        json_build_object(
            'product_name', tsw.product_name,
            'quantity_sold', tsw.quantity_sold,
            'total_amount', tsw.total_amount,
            'variation_info', tsw.variation_info
        )
    ) INTO v_top_week
    FROM get_top_selling_week(p_branch_id) tsw;

    -- Get low stock products (optimized)
    SELECT json_agg(
        json_build_object(
            'product_name', lsp.product_name,
            'current_quantity', lsp.current_quantity,
            'variation_info', lsp.variation_info,
            'category_info', lsp.category_info,
            'days_since_restock', lsp.days_since_restock
        )
    ) INTO v_low_stock
    FROM get_low_stock_products(p_branch_id) lsp;

    -- Get recent updates (optimized)
    SELECT json_agg(
        json_build_object(
            'product_name', rpu.product_name,
            'update_type', rpu.update_type,
            'updated_at', rpu.updated_at,
            'variation_info', rpu.variation_info,
            'category_info', rpu.category_info,
            'change_details', rpu.change_details
        )
    ) INTO v_updates
    FROM get_recent_product_updates(p_branch_id) rpu;

    -- Get sales total (optimized)
    SELECT json_build_object(
        'total_sales', COALESCE(st.total_sales, 0),
        'total_revenue', COALESCE(st.total_revenue, 0),
        'total_transactions', COALESCE(st.total_transactions, 0)
    ) INTO v_sales_total
    FROM get_sales_total(p_branch_id) st;

    RETURN QUERY SELECT 
        v_stats,
        v_activities,
        v_stock_trend,
        v_top_today,
        v_top_week,
        v_low_stock,
        v_updates,
        v_sales_total;
END;
$$ LANGUAGE plpgsql;

-- 2. Create optimized inventory function with caching
CREATE OR REPLACE FUNCTION get_inventory_optimized(
    p_page INTEGER DEFAULT 1,
    p_limit INTEGER DEFAULT 20,
    p_search TEXT DEFAULT NULL,
    p_branch_id VARCHAR DEFAULT NULL,
    p_cross_branch BOOLEAN DEFAULT FALSE,
    p_filters JSON DEFAULT NULL
)
RETURNS TABLE (
    inventory_data JSON,
    pagination JSON,
    filters JSON
) AS $$
DECLARE
    v_inventory JSON;
    v_pagination JSON;
    v_filters JSON;
    v_total INTEGER;
    v_offset INTEGER;
    v_where_clause TEXT := 'WHERE p.is_active = true';
    v_params TEXT[] := ARRAY[]::TEXT[];
    v_param_count INTEGER := 0;
BEGIN
    v_offset := (p_page - 1) * p_limit;

    -- Build WHERE clause based on filters
    IF p_branch_id IS NOT NULL AND NOT p_cross_branch THEN
        v_param_count := v_param_count + 1;
        v_where_clause := v_where_clause || ' AND i.branch_id = $' || v_param_count;
        v_params := array_append(v_params, p_branch_id);
    END IF;

    -- Add search filter
    IF p_search IS NOT NULL AND p_search != '' THEN
        v_param_count := v_param_count + 1;
        v_where_clause := v_where_clause || ' AND (p.name ILIKE $' || v_param_count || ' OR p.sku ILIKE $' || v_param_count || ')';
        v_params := array_append(v_params, '%' || p_search || '%');
    END IF;

    -- Get total count
    EXECUTE 'SELECT COUNT(DISTINCT p.id) FROM products p LEFT JOIN inventory i ON p.id = i.product_id ' || v_where_clause
    INTO v_total
    USING v_params;

    -- Get inventory data
    EXECUTE '
        SELECT json_agg(
            json_build_object(
                ''product_id'', p.id,
                ''product_name'', p.name,
                ''sku'', p.sku,
                ''category_name'', c.name,
                ''brand'', p.brand,
                ''gender'', p.gender,
                ''age_range'', p.age_range,
                ''variations'', COALESCE(variations.variation_data, ''[]''::json),
                ''total_stock'', COALESCE(stock.total_quantity, 0),
                ''low_stock_count'', COALESCE(stock.low_stock_count, 0),
                ''out_of_stock_count'', COALESCE(stock.out_of_stock_count, 0)
            )
        )
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        LEFT JOIN (
            SELECT 
                pv.product_id,
                json_agg(
                    json_build_object(
                        ''id'', pv.id,
                        ''color'', pv.color,
                        ''size'', pv.size,
                        ''sku'', pv.sku,
                        ''price'', pv.price,
                        ''cost_price'', pv.cost_price,
                        ''inventory'', COALESCE(inv.inventory_data, ''[]''::json)
                    )
                ) as variation_data
            FROM product_variations pv
            LEFT JOIN (
                SELECT 
                    i.variation_id,
                    json_agg(
                        json_build_object(
                            ''branch_id'', i.branch_id,
                            ''branch_name'', b.name,
                            ''quantity'', i.quantity,
                            ''min_stock_level'', i.min_stock_level,
                            ''max_stock_level'', i.max_stock_level
                        )
                    ) as inventory_data
                FROM inventory i
                JOIN branches b ON i.branch_id = b.id
                GROUP BY i.variation_id
            ) inv ON pv.id = inv.variation_id
            WHERE pv.is_active = true
            GROUP BY pv.product_id
        ) variations ON p.id = variations.product_id
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
    INTO v_inventory
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

    -- Build filters summary
    v_filters := json_build_object(
        'search', p_search,
        'branch_id', p_branch_id,
        'cross_branch', p_cross_branch,
        'applied_filters', p_filters
    );

    RETURN QUERY SELECT 
        COALESCE(v_inventory, '[]'::json),
        v_pagination,
        v_filters;
END;
$$ LANGUAGE plpgsql;

-- 3. Create optimized reports function
CREATE OR REPLACE FUNCTION get_reports_optimized(
    p_time_range VARCHAR DEFAULT 'daily',
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL,
    p_branch_id VARCHAR DEFAULT NULL
)
RETURNS TABLE (
    sales_report JSON,
    expense_report JSON,
    summary JSON
) AS $$
DECLARE
    v_sales JSON;
    v_expenses JSON;
    v_summary JSON;
BEGIN
    -- Get sales report
    SELECT json_agg(
        json_build_object(
            'period_label', sr.period_label,
            'total_sales', sr.total_sales,
            'total_revenue', sr.total_revenue,
            'transaction_count', sr.transaction_count,
            'branch_name', sr.branch_name,
            'period_start', sr.period_start,
            'period_end', sr.period_end
        )
    ) INTO v_sales
    FROM get_sales_data(p_branch_id, p_start_date::TEXT, p_end_date::TEXT, p_time_range) sr;

    -- Get expense report
    SELECT json_agg(
        json_build_object(
            'period_label', er.period_label,
            'total_expenses', er.total_expenses,
            'expense_count', er.expense_count,
            'branch_name', er.branch_name,
            'category', er.category,
            'period_start', er.period_start,
            'period_end', er.period_end
        )
    ) INTO v_expenses
    FROM get_expense_data(p_branch_id, p_start_date::TEXT, p_end_date::TEXT) er;

    -- Build summary
    SELECT json_build_object(
        'total_revenue', COALESCE(SUM(sr.total_revenue), 0),
        'total_expenses', COALESCE(SUM(er.total_expenses), 0),
        'net_profit', COALESCE(SUM(sr.total_revenue), 0) - COALESCE(SUM(er.total_expenses), 0),
        'total_transactions', COALESCE(SUM(sr.transaction_count), 0),
        'total_expense_items', COALESCE(SUM(er.expense_count), 0),
        'time_range', p_time_range,
        'branch_id', p_branch_id
    ) INTO v_summary
    FROM get_sales_data(p_branch_id, p_start_date::TEXT, p_end_date::TEXT, p_time_range) sr
    CROSS JOIN get_expense_data(p_branch_id, p_start_date::TEXT, p_end_date::TEXT) er;

    RETURN QUERY SELECT 
        COALESCE(v_sales, '[]'::json),
        COALESCE(v_expenses, '[]'::json),
        v_summary;
END;
$$ LANGUAGE plpgsql;

-- 4. Create optimized stock management function
CREATE OR REPLACE FUNCTION get_stock_management_optimized(
    p_branch_id VARCHAR DEFAULT NULL,
    p_page INTEGER DEFAULT 1,
    p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
    products JSON,
    stock_movements JSON,
    branches JSON,
    summary JSON
) AS $$
DECLARE
    v_products JSON;
    v_movements JSON;
    v_branches JSON;
    v_summary JSON;
BEGIN
    -- Get products with inventory
    SELECT json_agg(
        json_build_object(
            'product_id', p.id,
            'product_name', p.name,
            'sku', p.sku,
            'category_name', c.name,
            'variations', COALESCE(variations.variation_data, '[]'::json)
        )
    ) INTO v_products
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN (
        SELECT 
            pv.product_id,
            json_agg(
                json_build_object(
                    'id', pv.id,
                    'color', pv.color,
                    'size', pv.size,
                    'sku', pv.sku,
                    'price', pv.price,
                    'cost_price', pv.cost_price,
                    'inventory', COALESCE(inv.inventory_data, '[]'::json)
                )
            ) as variation_data
        FROM product_variations pv
        LEFT JOIN (
            SELECT 
                i.variation_id,
                json_agg(
                    json_build_object(
                        'branch_id', i.branch_id,
                        'branch_name', b.name,
                        'quantity', i.quantity,
                        'min_stock_level', i.min_stock_level,
                        'max_stock_level', i.max_stock_level
                    )
                ) as inventory_data
            FROM inventory i
            JOIN branches b ON i.branch_id = b.id
            WHERE (p_branch_id IS NULL OR i.branch_id = p_branch_id)
            GROUP BY i.variation_id
        ) inv ON pv.id = inv.variation_id
        WHERE pv.is_active = true
        GROUP BY pv.product_id
    ) variations ON p.id = variations.product_id
    WHERE p.is_active = true
    ORDER BY p.name
    LIMIT p_limit OFFSET (p_page - 1) * p_limit;

    -- Get stock movements
    SELECT json_agg(
        json_build_object(
            'id', sm.id,
            'product_name', p.name,
            'variation_info', CASE 
                WHEN pv.id IS NOT NULL THEN 
                    CONCAT(COALESCE(pv.color, ''), CASE WHEN pv.color IS NOT NULL AND pv.size IS NOT NULL THEN ', ' ELSE '' END, COALESCE(pv.size, ''))
                ELSE 'N/A'
            END,
            'movement_type', sm.movement_type,
            'quantity', sm.quantity,
            'reason', sm.reason,
            'branch_name', b.name,
            'user_name', u.full_name,
            'created_at', sm.created_at
        )
    ) INTO v_movements
    FROM stock_movements sm
    JOIN products p ON sm.product_id = p.id
    LEFT JOIN product_variations pv ON sm.variation_id = pv.id
    JOIN branches b ON sm.branch_id = b.id
    JOIN users u ON sm.user_id = u.id
    WHERE (p_branch_id IS NULL OR sm.branch_id = p_branch_id)
    ORDER BY sm.created_at DESC
    LIMIT p_limit OFFSET (p_page - 1) * p_limit;

    -- Get branches
    SELECT json_agg(
        json_build_object(
            'id', b.id,
            'name', b.name,
            'location', b.location
        )
    ) INTO v_branches
    FROM branches b
    WHERE b.is_active = true;

    -- Build summary
    SELECT json_build_object(
        'total_products', COUNT(DISTINCT p.id),
        'total_variations', COUNT(pv.id),
        'total_stock_movements', COUNT(sm.id),
        'low_stock_items', COUNT(CASE WHEN i.quantity <= i.min_stock_level THEN 1 END),
        'out_of_stock_items', COUNT(CASE WHEN i.quantity = 0 THEN 1 END)
    ) INTO v_summary
    FROM products p
    LEFT JOIN product_variations pv ON p.id = pv.product_id AND pv.is_active = true
    LEFT JOIN inventory i ON pv.id = i.variation_id
    LEFT JOIN stock_movements sm ON p.id = sm.product_id
    WHERE p.is_active = true
    AND (p_branch_id IS NULL OR i.branch_id = p_branch_id OR sm.branch_id = p_branch_id);

    RETURN QUERY SELECT 
        COALESCE(v_products, '[]'::json),
        COALESCE(v_movements, '[]'::json),
        COALESCE(v_branches, '[]'::json),
        v_summary;
END;
$$ LANGUAGE plpgsql;

-- 5. Create optimized transfer function
CREATE OR REPLACE FUNCTION get_transfer_data_optimized(
    p_from_branch_id VARCHAR DEFAULT NULL,
    p_to_branch_id VARCHAR DEFAULT NULL
)
RETURNS TABLE (
    products JSON,
    transfers JSON,
    branches JSON
) AS $$
DECLARE
    v_products JSON;
    v_transfers JSON;
    v_branches JSON;
BEGIN
    -- Get products with inventory for transfer
    SELECT json_agg(
        json_build_object(
            'product_id', p.id,
            'product_name', p.name,
            'sku', p.sku,
            'category_name', c.name,
            'variations', COALESCE(variations.variation_data, '[]'::json)
        )
    ) INTO v_products
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN (
        SELECT 
            pv.product_id,
            json_agg(
                json_build_object(
                    'id', pv.id,
                    'color', pv.color,
                    'size', pv.size,
                    'sku', pv.sku,
                    'price', pv.price,
                    'cost_price', pv.cost_price,
                    'available_quantity', COALESCE(inv.quantity, 0),
                    'branch_id', inv.branch_id
                )
            ) as variation_data
        FROM product_variations pv
        LEFT JOIN inventory inv ON pv.id = inv.variation_id
        WHERE pv.is_active = true
        AND (p_from_branch_id IS NULL OR inv.branch_id = p_from_branch_id)
        GROUP BY pv.product_id
    ) variations ON p.id = variations.product_id
    WHERE p.is_active = true
    ORDER BY p.name;

    -- Get transfers
    SELECT json_agg(
        json_build_object(
            'id', t.id,
            'from_branch_name', fb.name,
            'to_branch_name', tb.name,
            'status', t.status,
            'requested_at', t.requested_at,
            'approved_at', t.approved_at,
            'completed_at', t.completed_at,
            'items', COALESCE(items.item_data, '[]'::json)
        )
    ) INTO v_transfers
    FROM transfers t
    JOIN branches fb ON t.from_branch_id = fb.id
    JOIN branches tb ON t.to_branch_id = tb.id
    LEFT JOIN (
        SELECT 
            ti.transfer_id,
            json_agg(
                json_build_object(
                    'product_name', p.name,
                    'variation_info', CASE 
                        WHEN pv.id IS NOT NULL THEN 
                            CONCAT(COALESCE(pv.color, ''), CASE WHEN pv.color IS NOT NULL AND pv.size IS NOT NULL THEN ', ' ELSE '' END, COALESCE(pv.size, ''))
                        ELSE 'N/A'
                    END,
                    'quantity', ti.quantity,
                    'unit_price', ti.unit_price
                )
            ) as item_data
        FROM transfer_items ti
        JOIN products p ON ti.product_id = p.id
        LEFT JOIN product_variations pv ON ti.variation_id = pv.id
        GROUP BY ti.transfer_id
    ) items ON t.id = items.transfer_id
    WHERE (p_from_branch_id IS NULL OR t.from_branch_id = p_from_branch_id)
    AND (p_to_branch_id IS NULL OR t.to_branch_id = p_to_branch_id)
    ORDER BY t.requested_at DESC;

    -- Get branches
    SELECT json_agg(
        json_build_object(
            'id', b.id,
            'name', b.name,
            'location', b.location
        )
    ) INTO v_branches
    FROM branches b
    WHERE b.is_active = true;

    RETURN QUERY SELECT 
        COALESCE(v_products, '[]'::json),
        COALESCE(v_transfers, '[]'::json),
        COALESCE(v_branches, '[]'::json);
END;
$$ LANGUAGE plpgsql;

-- 6. Create additional indexes for page optimizations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stock_movements_created_at_desc ON stock_movements(created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sales_created_at_desc ON sales(created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transfers_requested_at_desc ON transfers(requested_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_name_sku_active ON products(name, sku, is_active);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inventory_branch_quantity ON inventory(branch_id, quantity);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_product_variations_product_active ON product_variations(product_id, is_active);

-- 7. Create materialized views for frequently accessed data
CREATE MATERIALIZED VIEW IF NOT EXISTS inventory_summary_optimized AS
SELECT 
    p.id as product_id,
    p.name as product_name,
    p.sku as product_sku,
    c.name as category_name,
    p.brand,
    p.gender,
    p.age_range,
    COUNT(pv.id) as variation_count,
    SUM(i.quantity) as total_quantity,
    COUNT(CASE WHEN i.quantity <= i.min_stock_level THEN 1 END) as low_stock_count,
    COUNT(CASE WHEN i.quantity = 0 THEN 1 END) as out_of_stock_count,
    AVG(pv.price) as avg_price,
    AVG(pv.cost_price) as avg_cost_price
FROM products p
LEFT JOIN categories c ON p.category_id = c.id
LEFT JOIN product_variations pv ON p.id = pv.product_id AND pv.is_active = true
LEFT JOIN inventory i ON pv.id = i.variation_id
WHERE p.is_active = true
GROUP BY p.id, p.name, p.sku, c.name, p.brand, p.gender, p.age_range;

CREATE INDEX IF NOT EXISTS idx_inventory_summary_optimized_lookup ON inventory_summary_optimized(product_id);

-- 8. Create refresh function for materialized views
CREATE OR REPLACE FUNCTION refresh_all_materialized_views()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY inventory_summary;
    REFRESH MATERIALIZED VIEW CONCURRENTLY inventory_summary_neon;
    REFRESH MATERIALIZED VIEW CONCURRENTLY inventory_summary_optimized;
END;
$$ LANGUAGE plpgsql;

-- 9. Show optimization results
SELECT 
    'Page Performance Optimization Complete!' as status,
    'Created optimized functions for all pages' as details;

-- Show created functions
SELECT 
    'Optimized Functions' as category,
    routine_name as function_name,
    'Created' as status
FROM information_schema.routines 
WHERE routine_name IN (
    'get_dashboard_data_optimized',
    'get_inventory_optimized',
    'get_reports_optimized',
    'get_stock_management_optimized',
    'get_transfer_data_optimized',
    'refresh_all_materialized_views'
)
AND routine_schema = 'public';

-- Show performance recommendations
SELECT 
    'Performance Recommendations' as category,
    '1. Use optimized functions in API routes for better performance' as recommendation
UNION ALL
SELECT 
    'Performance Recommendations',
    '2. Implement caching for dashboard and reports data'
UNION ALL
SELECT 
    'Performance Recommendations',
    '3. Use pagination for large datasets'
UNION ALL
SELECT 
    'Performance Recommendations',
    '4. Refresh materialized views periodically'
UNION ALL
SELECT 
    'Performance Recommendations',
    '5. Monitor query performance with pg_stat_statements';
