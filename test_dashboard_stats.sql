-- Test Dashboard Stats Function
-- This script tests the current behavior of get_dashboard_stats function

-- Test 1: Check what happens when we pass branch1
SELECT '=== TEST 1: Branch1 (Franko) ===' as test_name;
SELECT * FROM get_dashboard_stats('branch1');

-- Test 2: Check what happens when we pass branch2  
SELECT '=== TEST 2: Branch2 (Mebrathayl) ===' as test_name;
SELECT * FROM get_dashboard_stats('branch2');

-- Test 3: Check what happens when we pass NULL (all branches)
SELECT '=== TEST 3: All Branches (NULL) ===' as test_name;
SELECT * FROM get_dashboard_stats(NULL);

-- Test 4: Let's see what products exist in each branch
SELECT '=== TEST 4: Products by Branch ===' as test_name;
SELECT 
    b.name as branch_name,
    COUNT(DISTINCT p.id) as total_products,
    COUNT(DISTINCT CASE WHEN i.quantity > 0 THEN p.id END) as products_with_stock
FROM branches b
LEFT JOIN inventory i ON i.branch_id = b.id
LEFT JOIN products p ON i.product_id = p.id AND p.is_active = TRUE
GROUP BY b.id, b.name
ORDER BY b.name;

-- Test 5: Let's see the actual product distribution
SELECT '=== TEST 5: Product Distribution ===' as test_name;
SELECT 
    p.name as product_name,
    p.sku,
    b.name as branch_name,
    i.quantity,
    i.min_stock_level
FROM products p
JOIN inventory i ON i.product_id = p.id
JOIN branches b ON i.branch_id = b.id
WHERE p.is_active = TRUE
ORDER BY p.name, b.name;
