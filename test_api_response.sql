-- Test API Response for Dashboard
-- This script tests what the API should be returning

-- Test the optimized dashboard function directly
SELECT '=== TESTING OPTIMIZED DASHBOARD FUNCTION ===' as test_header;

-- Test for branch1 (Franko)
SELECT 'Branch1 (Franko) API Response:' as test_name;
SELECT json_extract_path_text(get_dashboard_optimized('branch1'), 'stats', 'total_products') as total_products;

-- Test for branch2 (Mebrathayl)  
SELECT 'Branch2 (Mebrathayl) API Response:' as test_name;
SELECT json_extract_path_text(get_dashboard_optimized('branch2'), 'stats', 'total_products') as total_products;

-- Test for all branches (NULL)
SELECT 'All Branches (NULL) API Response:' as test_name;
SELECT json_extract_path_text(get_dashboard_optimized(NULL), 'stats', 'total_products') as total_products;

-- Test the individual stats function
SELECT '=== TESTING INDIVIDUAL STATS FUNCTION ===' as test_header;

-- Test for branch1 (Franko)
SELECT 'Branch1 (Franko) Stats:' as test_name, total_products FROM get_dashboard_stats('branch1');

-- Test for branch2 (Mebrathayl)
SELECT 'Branch2 (Mebrathayl) Stats:' as test_name, total_products FROM get_dashboard_stats('branch2');

-- Test for all branches (NULL)
SELECT 'All Branches (NULL) Stats:' as test_name, total_products FROM get_dashboard_stats(NULL);

SELECT 'API test completed!' as completion_message;
