-- Fixed transfer function with correct field names for frontend
-- This ensures product cards display all details correctly

CREATE OR REPLACE FUNCTION get_transfer_fast_simple(p_from_branch_id VARCHAR(50) DEFAULT NULL)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    -- Get products ONLY from the specified branch (user's branch)
    WITH product_data AS (
        SELECT 
            p.id as id,                    -- Frontend expects 'id'
            p.name as name,                -- Frontend expects 'name'
            p.sku as sku,                  -- Frontend expects 'sku'
            p.product_type,
            p.brand,
            p.age_range,
            p.gender,
            p.description,
            p.image_url,
            COALESCE(c.name, 'Uncategorized') as category_name,
            COALESCE(i.quantity, 0) as current_stock,
            COALESCE(i.min_stock_level, 0) as min_stock_level,
            COALESCE(i.max_stock_level, 100) as max_stock_level,
            i.branch_id,
            b.name as branch_name,
            pv.price as price,             -- Get price from variations
            pv.cost_price as cost_price,
            pv.purchase_price as purchase_price
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        INNER JOIN inventory i ON p.id = i.product_id  -- INNER JOIN to ensure inventory exists
        INNER JOIN branches b ON i.branch_id = b.id    -- INNER JOIN to ensure branch exists
        LEFT JOIN product_variations pv ON p.id = pv.product_id  -- Get price info
        WHERE p.is_active = true
          AND i.branch_id = p_from_branch_id           -- STRICT branch filtering
          AND i.quantity > 0                          -- Only products with stock
          AND p.product_type = 'uniform'               -- Only uniform products
    ),
    variation_data AS (
        SELECT 
            p.id as product_id,            -- Frontend expects 'product_id'
            p.name as product_name,        -- Frontend expects 'product_name'
            p.sku as product_sku,          -- Frontend expects 'product_sku'
            p.product_type,
            p.brand,
            p.age_range,
            p.gender,
            p.description,
            p.image_url,
            COALESCE(c.name, 'Uncategorized') as category_name,
            pv.id as variation_id,
            pv.sku as variation_sku,
            pv.color,
            pv.size,
            pv.price,
            pv.cost_price,
            pv.purchase_price,
            COALESCE(i.quantity, 0) as current_stock,
            COALESCE(i.min_stock_level, 0) as min_stock_level,
            COALESCE(i.max_stock_level, 100) as max_stock_level,
            i.branch_id,
            b.name as branch_name
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        JOIN product_variations pv ON p.id = pv.product_id
        INNER JOIN inventory i ON p.id = i.product_id AND pv.id = i.variation_id  -- INNER JOIN for variations
        INNER JOIN branches b ON i.branch_id = b.id
        WHERE p.is_active = true 
          AND p.product_type = 'variation'
          AND pv.is_active = true
          AND i.branch_id = p_from_branch_id           -- STRICT branch filtering
          AND i.quantity > 0                          -- Only variations with stock
    ),
    transfers_data AS (
        SELECT 
            t.id,
            t.from_branch_id,
            t.to_branch_id,
            t.status,
            t.notes as reason,
            t.transfer_date as requested_at,
            t.transfer_date as completed_at,
            t.transfer_date as created_at,
            t.transfer_date as updated_at,
            COALESCE(fb.name, 'Unknown') as from_branch_name,
            COALESCE(tb.name, 'Unknown') as to_branch_name,
            COALESCE(u.full_name, 'Unknown User') as requested_by,
            ti.product_id,
            ti.variation_id,
            ti.quantity,
            COALESCE(p.name, 'Unknown Product') as product_name,
            COALESCE(p.sku, 'Unknown SKU') as product_sku,
            pv.color,
            pv.size
        FROM transfers t
        LEFT JOIN branches fb ON t.from_branch_id = fb.id
        LEFT JOIN branches tb ON t.to_branch_id = tb.id
        LEFT JOIN users u ON t.user_id = u.id
        LEFT JOIN transfer_items ti ON t.id = ti.transfer_id
        LEFT JOIN products p ON ti.product_id = p.id
        LEFT JOIN product_variations pv ON ti.variation_id = pv.id
        WHERE t.from_branch_id = p_from_branch_id      -- Only transfers FROM user's branch
        ORDER BY t.transfer_date DESC
    ),
    branches_data AS (
        SELECT 
            id,
            name,
            address,
            phone,
            email,
            manager_name,
            is_active
        FROM branches
        WHERE is_active = true
          AND id != p_from_branch_id                   -- Exclude user's own branch (can't transfer to self)
    )
    SELECT json_build_object(
        'products', (
            SELECT COALESCE(json_agg(
                json_build_object(
                    'id', pd.id,
                    'name', pd.name,
                    'sku', pd.sku,
                    'product_type', pd.product_type,
                    'brand', pd.brand,
                    'age_range', pd.age_range,
                    'gender', pd.gender,
                    'description', pd.description,
                    'image_url', pd.image_url,
                    'category_name', pd.category_name,
                    'current_stock', pd.current_stock,
                    'min_stock_level', pd.min_stock_level,
                    'max_stock_level', pd.max_stock_level,
                    'branch_id', pd.branch_id,
                    'branch_name', pd.branch_name,
                    'price', pd.price,
                    'cost_price', pd.cost_price,
                    'purchase_price', pd.purchase_price,
                    'variations', '[]'::json
                )
            ), '[]'::json)
            FROM product_data pd
        ),
        'variations', (
            SELECT COALESCE(json_agg(
                json_build_object(
                    'product_id', vd.product_id,
                    'product_name', vd.product_name,
                    'product_sku', vd.product_sku,
                    'product_type', vd.product_type,
                    'brand', vd.brand,
                    'age_range', vd.age_range,
                    'gender', vd.gender,
                    'description', vd.description,
                    'image_url', vd.image_url,
                    'category_name', vd.category_name,
                    'variation_id', vd.variation_id,
                    'variation_sku', vd.variation_sku,
                    'color', vd.color,
                    'size', vd.size,
                    'price', vd.price,
                    'cost_price', vd.cost_price,
                    'purchase_price', vd.purchase_price,
                    'current_stock', vd.current_stock,
                    'min_stock_level', vd.min_stock_level,
                    'max_stock_level', vd.max_stock_level,
                    'branch_id', vd.branch_id,
                    'branch_name', vd.branch_name
                )
            ), '[]'::json)
            FROM variation_data vd
        ),
        'transfers', (
            SELECT COALESCE(json_agg(
                json_build_object(
                    'id', td.id,
                    'from_branch_id', td.from_branch_id,
                    'to_branch_id', td.to_branch_id,
                    'status', td.status,
                    'reason', td.reason,
                    'requested_at', td.requested_at,
                    'completed_at', td.completed_at,
                    'created_at', td.created_at,
                    'updated_at', td.updated_at,
                    'from_branch_name', td.from_branch_name,
                    'to_branch_name', td.to_branch_name,
                    'requested_by', td.requested_by,
                    'product_id', td.product_id,
                    'variation_id', td.variation_id,
                    'quantity', td.quantity,
                    'product_name', td.product_name,
                    'product_sku', td.product_sku,
                    'color', td.color,
                    'size', td.size
                )
            ), '[]'::json)
            FROM transfers_data td
        ),
        'branches', (
            SELECT COALESCE(json_agg(
                json_build_object(
                    'id', bd.id,
                    'name', bd.name,
                    'address', bd.address,
                    'phone', bd.phone,
                    'email', bd.email,
                    'manager_name', bd.manager_name,
                    'is_active', bd.is_active
                )
            ), '[]'::json)
            FROM branches_data bd
        )
    ) INTO result;
    
    RETURN result;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error in get_transfer_fast_simple: %', SQLERRM;
        RETURN json_build_object(
            'products', '[]'::json,
            'variations', '[]'::json,
            'transfers', '[]'::json,
            'branches', '[]'::json
        );
END;
$$ LANGUAGE plpgsql;

-- Test the fixed function
SELECT 'Testing fixed function for branch1:' as test_name;
SELECT get_transfer_fast_simple('branch1') as result_branch1;

SELECT 'Testing fixed function for branch2:' as test_name;
SELECT get_transfer_fast_simple('branch2') as result_branch2;