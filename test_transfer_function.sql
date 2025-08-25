-- Test script for get_transfer_fast function
-- Run this after creating the function to verify it works

-- Test 1: Check if function exists
SELECT 
    routine_name, 
    routine_type, 
    data_type 
FROM information_schema.routines 
WHERE routine_name = 'get_transfer_fast';

-- Test 2: Test function with no branch filter
SELECT 'Testing get_transfer_fast(NULL)' as test_case;
SELECT get_transfer_fast(NULL) as result;

-- Test 3: Test function with specific branch (replace 'branch_id_here' with actual branch ID)
SELECT 'Testing get_transfer_fast with specific branch' as test_case;
-- SELECT get_transfer_fast('branch_id_here') as result;

-- Test 4: Check the structure of returned JSON
SELECT 'Analyzing JSON structure' as test_case;
WITH test_result AS (
    SELECT get_transfer_fast(NULL) as result
)
SELECT 
    json_typeof(result) as result_type,
    json_typeof(result->'products') as products_type,
    json_typeof(result->'variations') as variations_type,
    json_typeof(result->'transfers') as transfers_type,
    json_typeof(result->'branches') as branches_type,
    json_array_length(result->'products') as products_count,
    json_array_length(result->'variations') as variations_count,
    json_array_length(result->'transfers') as transfers_count,
    json_array_length(result->'branches') as branches_count
FROM test_result;

-- Test 5: Check if we have data in the tables
SELECT 'Checking data availability' as test_case;
SELECT 
    'products' as table_name,
    COUNT(*) as count
FROM products 
WHERE is_active = true
UNION ALL
SELECT 
    'product_variations' as table_name,
    COUNT(*) as count
FROM product_variations 
WHERE is_active = true
UNION ALL
SELECT 
    'inventory' as table_name,
    COUNT(*) as count
FROM inventory
UNION ALL
SELECT 
    'transfers' as table_name,
    COUNT(*) as count
FROM transfers
UNION ALL
SELECT 
    'branches' as table_name,
    COUNT(*) as count
FROM branches 
WHERE is_active = true;

-- Test 6: Check inventory data structure
SELECT 'Checking inventory structure' as test_case;
SELECT 
    p.name as product_name,
    p.sku as product_sku,
    p.product_type,
    i.quantity as current_stock,
    i.branch_id,
    b.name as branch_name
FROM products p
JOIN categories c ON p.category_id = c.id
LEFT JOIN inventory i ON p.id = i.product_id
LEFT JOIN branches b ON i.branch_id = b.id
WHERE p.is_active = true
LIMIT 5;
