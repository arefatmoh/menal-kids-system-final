-- Fix the get_stock_fast function to resolve data type mismatch error
-- The issue is that ::TEXT casting conflicts with expected JSON return type

DROP FUNCTION IF EXISTS get_stock_fast(VARCHAR, INTEGER, INTEGER);

CREATE OR REPLACE FUNCTION get_stock_fast(
    p_branch_id VARCHAR DEFAULT NULL,
    p_page INTEGER DEFAULT 1,
    p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (data JSON, pagination JSON) AS $$
DECLARE
    total_count INTEGER;
    total_pages INTEGER;
BEGIN
    -- Get total count for pagination
    SELECT COUNT(DISTINCT p.id) INTO total_count
    FROM products p
    WHERE p.is_active = true;
    
    -- Calculate total pages
    total_pages := CEIL(total_count::DECIMAL / p_limit);
    
    -- Return data and pagination
    RETURN QUERY
    SELECT 
        json_build_object(
            'products', (
                SELECT json_agg(
                    json_build_object(
                        'id', p.id,
                        'name', p.name,
                        'sku', p.sku,
                        'current_stock', COALESCE(stock.total_quantity, 0),
                        'category_name', c.name,
                        'price', 0,
                        'min_stock_level', COALESCE(i.min_stock_level, 0),
                        'max_stock_level', COALESCE(i.max_stock_level, 0),
                        'branch_id', COALESCE(i.branch_id, 'branch1'),
                        'branch_name', COALESCE(b.name, 'Branch 1'),
                        'stock_status', CASE 
                            WHEN COALESCE(stock.total_quantity, 0) = 0 THEN 'Out of Stock'
                            WHEN COALESCE(stock.total_quantity, 0) <= COALESCE(i.min_stock_level, 0) THEN 'Low Stock'
                            WHEN COALESCE(stock.total_quantity, 0) > COALESCE(i.max_stock_level, 0) THEN 'Overstock'
                            ELSE 'Normal'
                        END,
                        'product_type', p.product_type,
                        'variations', '[]'::json
                    )
                )
                FROM (
                    SELECT DISTINCT p.id, p.name, p.sku, p.category_id, p.product_type
                    FROM products p
                    INNER JOIN inventory i ON p.id = i.product_id
                    WHERE p.is_active = true 
                    AND (p_branch_id IS NULL OR i.branch_id = p_branch_id)
                    ORDER BY p.name
                    LIMIT p_limit OFFSET (p_page - 1) * p_limit
                ) p
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
                LEFT JOIN (
                    SELECT 
                        i.product_id,
                        i.branch_id,
                        i.min_stock_level,
                        i.max_stock_level
                    FROM inventory i
                    WHERE (p_branch_id IS NULL OR i.branch_id = p_branch_id)
                    LIMIT 1
                ) i ON p.id = i.product_id
                LEFT JOIN branches b ON COALESCE(i.branch_id, 'branch1') = b.id
            ),
            'movements', (
                SELECT json_agg(
                    json_build_object(
                        'id', sm.id,
                        'product_name', p.name,
                        'sku', p.sku,
                        'movement_type', sm.movement_type,
                        'quantity', sm.quantity,
                        'reason', COALESCE(sm.reason, ''),
                        'user_name', 'System',
                        'created_at', sm.created_at,
                        'branch_id', sm.branch_id,
                        'branch_name', b.name
                    )
                )
                FROM (
                    SELECT DISTINCT sm.id, sm.product_id, sm.movement_type, sm.quantity, sm.branch_id, sm.created_at, sm.reason
                    FROM stock_movements sm
                    WHERE (p_branch_id IS NULL OR sm.branch_id = p_branch_id)
                    ORDER BY sm.created_at DESC
                    LIMIT p_limit OFFSET (p_page - 1) * p_limit
                ) sm
                JOIN products p ON sm.product_id = p.id
                JOIN branches b ON sm.branch_id = b.id
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
        ) as data,
        json_build_object(
            'current_page', p_page,
            'total_pages', total_pages,
            'total_count', total_count,
            'limit', p_limit
        ) as pagination;
END;
$$ LANGUAGE plpgsql;

-- Test the function
SELECT * FROM get_stock_fast('branch1', 1, 10);
