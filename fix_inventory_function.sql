-- Fix the get_inventory_fast function to ensure it always returns valid JSON
DROP FUNCTION IF EXISTS get_inventory_fast(INTEGER, INTEGER, TEXT, VARCHAR, BOOLEAN);

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
    -- Ensure valid parameters
    IF p_page < 1 THEN p_page := 1; END IF;
    IF p_limit < 1 THEN p_limit := 20; END IF;
    IF p_limit > 100 THEN p_limit := 100; END IF;
    
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

    -- Get total count with error handling
    BEGIN
        EXECUTE 'SELECT COUNT(DISTINCT p.id) FROM products p LEFT JOIN inventory i ON p.id = i.product_id ' || v_where_clause
        INTO v_total
        USING v_params;
    EXCEPTION WHEN OTHERS THEN
        v_total := 0;
    END;

    -- Ensure v_total is not null
    IF v_total IS NULL THEN v_total := 0; END IF;

    -- Get data with error handling
    BEGIN
        EXECUTE '
            SELECT json_agg(
                json_build_object(
                    ''product_id'', p.id,
                    ''product_name'', p.name,
                    ''sku'', p.sku,
                    ''category_name'', COALESCE(c.name, ''''),
                    ''brand'', COALESCE(p.brand, ''''),
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
                    SUM(COALESCE(i.quantity, 0)) as total_quantity,
                    COUNT(CASE WHEN COALESCE(i.quantity, 0) <= COALESCE(i.min_stock_level, 0) THEN 1 END) as low_stock_count,
                    COUNT(CASE WHEN COALESCE(i.quantity, 0) = 0 THEN 1 END) as out_of_stock_count
                FROM inventory i
                GROUP BY i.product_id
            ) stock ON p.id = stock.product_id
            ' || v_where_clause || '
            ORDER BY p.name
            LIMIT $' || (v_param_count + 1) || ' OFFSET $' || (v_param_count + 2)
        INTO v_data
        USING array_append(array_append(v_params, p_limit::TEXT), v_offset::TEXT);
    EXCEPTION WHEN OTHERS THEN
        v_data := '[]'::json;
    END;

    -- Ensure v_data is not null
    IF v_data IS NULL THEN v_data := '[]'::json; END IF;

    -- Build pagination with error handling
    BEGIN
        v_pagination := json_build_object(
            'page', p_page,
            'limit', p_limit,
            'total', v_total,
            'total_pages', GREATEST(1, CEIL(v_total::DECIMAL / p_limit)),
            'has_next', p_page * p_limit < v_total,
            'has_prev', p_page > 1
        );
    EXCEPTION WHEN OTHERS THEN
        v_pagination := json_build_object(
            'page', p_page,
            'limit', p_limit,
            'total', 0,
            'total_pages', 1,
            'has_next', false,
            'has_prev', false
        );
    END;

    -- Ensure v_pagination is not null
    IF v_pagination IS NULL THEN 
        v_pagination := json_build_object(
            'page', p_page,
            'limit', p_limit,
            'total', 0,
            'total_pages', 1,
            'has_next', false,
            'has_prev', false
        );
    END IF;

    RETURN QUERY SELECT 
        v_data,
        v_pagination;
END;
$$ LANGUAGE plpgsql;

-- Test the function
SELECT 'Testing get_inventory_fast function...' as test;
SELECT * FROM get_inventory_fast(1, 5, NULL, NULL, false);
