-- Add function to get recent product updates (more useful than high value inventory)

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
