-- Debug inventory data to see what's being returned
-- Test basic inventory query
SELECT 
    p.id as product_id,
    p.name as product_name,
    p.sku,
    c.name as category_name,
    p.brand,
    i.quantity,
    i.min_stock_level,
    i.max_stock_level,
    b.name as branch_name
FROM products p
LEFT JOIN inventory i ON p.id = i.product_id
LEFT JOIN categories c ON p.category_id = c.id
LEFT JOIN branches b ON i.branch_id = b.id
WHERE p.is_active = true
ORDER BY p.name
LIMIT 10;

-- Test pagination
SELECT COUNT(DISTINCT p.id) as total_products
FROM products p
LEFT JOIN inventory i ON p.id = i.product_id
WHERE p.is_active = true;

-- Test with branch filter
SELECT 
    p.id as product_id,
    p.name as product_name,
    p.sku,
    c.name as category_name,
    p.brand,
    i.quantity,
    i.min_stock_level,
    i.max_stock_level,
    b.name as branch_name
FROM products p
LEFT JOIN inventory i ON p.id = i.product_id
LEFT JOIN categories c ON p.category_id = c.id
LEFT JOIN branches b ON i.branch_id = b.id
WHERE p.is_active = true AND i.branch_id = 'branch2'
ORDER BY p.name
LIMIT 10;
