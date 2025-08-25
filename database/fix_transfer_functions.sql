-- Fix transfer management system
-- This script creates the missing get_transfer_fast function

-- Create the missing get_transfer_fast function
CREATE OR REPLACE FUNCTION get_transfer_fast(p_from_branch_id VARCHAR(50) DEFAULT NULL)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    -- Get products with inventory for transfer
    WITH product_data AS (
        SELECT 
            p.id as product_id,
            p.name as product_name,
            p.sku as product_sku,
            p.product_type,
            p.brand,
            p.age_range,
            p.gender,
            p.description,
            p.image_url,
            c.name as category_name,
            COALESCE(i.quantity, 0) as current_stock,
            i.min_stock_level,
            i.max_stock_level,
            i.branch_id,
            b.name as branch_name
        FROM products p
        JOIN categories c ON p.category_id = c.id
        LEFT JOIN inventory i ON p.id = i.product_id
        LEFT JOIN branches b ON i.branch_id = b.id
        WHERE p.is_active = true
          AND (p_from_branch_id IS NULL OR i.branch_id = p_from_branch_id)
    ),
    variation_data AS (
        SELECT 
            p.id as product_id,
            p.name as product_name,
            p.sku as product_sku,
            p.product_type,
            p.brand,
            p.age_range,
            p.gender,
            p.description,
            p.image_url,
            c.name as category_name,
            pv.id as variation_id,
            pv.sku as variation_sku,
            pv.color,
            pv.size,
            pv.price,
            pv.cost_price,
            pv.purchase_price,
            COALESCE(i.quantity, 0) as current_stock,
            i.min_stock_level,
            i.max_stock_level,
            i.branch_id,
            b.name as branch_name
        FROM products p
        JOIN categories c ON p.category_id = c.id
        JOIN product_variations pv ON p.id = pv.product_id
        LEFT JOIN inventory i ON p.id = i.product_id AND pv.id = i.variation_id
        LEFT JOIN branches b ON i.branch_id = b.id
        WHERE p.is_active = true 
          AND p.product_type = 'variation'
          AND pv.is_active = true
          AND (p_from_branch_id IS NULL OR i.branch_id = p_from_branch_id)
    ),
    transfers_data AS (
        SELECT 
            t.id,
            t.from_branch_id,
            t.to_branch_id,
            t.status,
            t.reason,
            t.notes,
            t.requested_at,
            t.approved_at,
            t.completed_at,
            t.created_at,
            t.updated_at,
            fb.name as from_branch_name,
            tb.name as to_branch_name,
            u.full_name as requested_by,
            ti.product_id,
            ti.variation_id,
            ti.quantity,
            p.name as product_name,
            p.sku as product_sku,
            pv.color,
            pv.size
        FROM transfers t
        JOIN branches fb ON t.from_branch_id = fb.id
        JOIN branches tb ON t.to_branch_id = tb.id
        JOIN users u ON t.requested_by = u.id
        LEFT JOIN transfer_items ti ON t.id = ti.transfer_id
        LEFT JOIN products p ON ti.product_id = p.id
        LEFT JOIN product_variations pv ON ti.variation_id = pv.id
        WHERE (p_from_branch_id IS NULL OR t.from_branch_id = p_from_branch_id)
        ORDER BY t.created_at DESC
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
    )
    SELECT json_build_object(
        'products', (
            SELECT json_agg(
                json_build_object(
                    'product_id', pd.product_id,
                    'product_name', pd.product_name,
                    'product_sku', pd.product_sku,
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
                    'variations', '[]'::json
                )
            )
            FROM product_data pd
            WHERE pd.product_type = 'uniform'
        ),
        'variations', (
            SELECT json_agg(
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
            )
            FROM variation_data vd
        ),
        'transfers', (
            SELECT json_agg(
                json_build_object(
                    'id', td.id,
                    'from_branch_id', td.from_branch_id,
                    'to_branch_id', td.to_branch_id,
                    'status', td.status,
                    'reason', td.reason,
                    'notes', td.notes,
                    'requested_at', td.requested_at,
                    'approved_at', td.approved_at,
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
            )
            FROM transfers_data td
        ),
        'branches', (
            SELECT json_agg(
                json_build_object(
                    'id', bd.id,
                    'name', bd.name,
                    'address', bd.address,
                    'phone', bd.phone,
                    'email', bd.email,
                    'manager_name', bd.manager_name,
                    'is_active', bd.is_active
                )
            )
            FROM branches_data bd
        )
    ) INTO result;
    
    RETURN result;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error in get_transfer_fast: %', SQLERRM;
        RETURN json_build_object(
            'products', '[]'::json,
            'variations', '[]'::json,
            'transfers', '[]'::json,
            'branches', '[]'::json
        );
END;
$$ LANGUAGE plpgsql;

-- Verify the function was created
SELECT 'get_transfer_fast function created successfully' as status;
