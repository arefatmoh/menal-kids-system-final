-- Debug script to find why get_transfer_fast returns empty data
-- Run this to identify the root cause

-- Check 1: Basic table counts
SELECT '=== BASIC TABLE COUNTS ===' as section;
SELECT 
    'products' as table_name,
    COUNT(*) as total_count,
    COUNT(CASE WHEN is_active = true THEN 1 END) as active_count
FROM products
UNION ALL
SELECT 
    'product_variations' as table_name,
    COUNT(*) as total_count,
    COUNT(CASE WHEN is_active = true THEN 1 END) as active_count
FROM product_variations
UNION ALL
SELECT 
    'inventory' as table_name,
    COUNT(*) as total_count,
    COUNT(CASE WHEN quantity > 0 THEN 1 END) as with_stock_count
FROM inventory
UNION ALL
SELECT 
    'transfers' as table_name,
    COUNT(*) as total_count,
    COUNT(*) as all_count
FROM transfers
UNION ALL
SELECT 
    'branches' as table_name,
    COUNT(*) as total_count,
    COUNT(CASE WHEN is_active = true THEN 1 END) as active_count
FROM branches;

-- Check 2: Test the exact queries from the function
SELECT '=== TESTING FUNCTION QUERIES ===' as section;

-- Test product_data CTE
SELECT 'Testing product_data CTE:' as test_name;
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
)
SELECT COUNT(*) as product_count FROM product_data;

-- Test variation_data CTE
SELECT 'Testing variation_data CTE:' as test_name;
WITH variation_data AS (
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
)
SELECT COUNT(*) as variation_count FROM variation_data;

-- Test branches_data CTE
SELECT 'Testing branches_data CTE:' as test_name;
WITH branches_data AS (
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
SELECT COUNT(*) as branch_count FROM branches_data;

-- Check 3: Look at actual data
SELECT '=== SAMPLE DATA ===' as section;

-- Sample products
SELECT 'Sample products:' as data_type;
SELECT 
    p.id, p.name, p.sku, p.product_type, p.is_active,
    c.name as category_name
FROM products p
LEFT JOIN categories c ON p.category_id = c.id
LIMIT 5;

-- Sample inventory
SELECT 'Sample inventory:' as data_type;
SELECT 
    i.product_id, i.quantity, i.branch_id,
    p.name as product_name,
    b.name as branch_name
FROM inventory i
JOIN products p ON i.product_id = p.id
JOIN branches b ON i.branch_id = b.id
LIMIT 5;

-- Sample branches
SELECT 'Sample branches:' as data_type;
SELECT id, name, is_active FROM branches LIMIT 5;

-- Check 4: Test with specific branch filter
SELECT '=== TESTING WITH BRANCH FILTER ===' as section;
SELECT 'Testing with branch1:' as test_name;
SELECT get_transfer_fast('branch1') as result_with_branch1;

-- Check 5: Verify the function logic step by step
SELECT '=== STEP-BY-STEP VERIFICATION ===' as section;

-- Step 1: Check if we have products with inventory
SELECT 'Products with inventory:' as step;
SELECT 
    p.id, p.name, p.product_type,
    i.quantity, i.branch_id,
    b.name as branch_name
FROM products p
JOIN inventory i ON p.id = i.product_id
JOIN branches b ON i.branch_id = b.id
WHERE p.is_active = true
LIMIT 10;

-- Step 2: Check if we have variations with inventory
SELECT 'Variations with inventory:' as step;
SELECT 
    p.id, p.name, p.product_type,
    pv.id as variation_id, pv.color, pv.size,
    i.quantity, i.branch_id,
    b.name as branch_name
FROM products p
JOIN product_variations pv ON p.id = pv.product_id
JOIN inventory i ON p.id = i.product_id AND pv.id = i.variation_id
JOIN branches b ON i.branch_id = b.id
WHERE p.is_active = true 
  AND p.product_type = 'variation'
  AND pv.is_active = true
LIMIT 10;
