-- Verify All Functions Work Correctly
-- Run this after the fix script to ensure everything is working

-- Test 1: Basic function calls
SELECT 'Testing basic functions...' as test;

-- Test dashboard stats
SELECT 'Dashboard Stats:' as function_name, 
       COUNT(*) as result_count 
FROM get_dashboard_stats(NULL);

-- Test stock trend
SELECT 'Stock Trend:' as function_name, 
       COUNT(*) as result_count 
FROM get_stock_trend(NULL);

-- Test 2: Optimized functions
SELECT 'Testing optimized functions...' as test;

-- Test dashboard optimized
SELECT 'Dashboard Optimized:' as function_name,
       CASE 
           WHEN get_dashboard_optimized(NULL) IS NOT NULL THEN '✅ Working'
           ELSE '❌ Failed'
       END as status;

-- Test inventory fast
SELECT 'Inventory Fast:' as function_name,
       CASE 
           WHEN get_inventory_fast(1, 5) IS NOT NULL THEN '✅ Working'
           ELSE '❌ Failed'
       END as status;

-- Test 3: Function count verification
SELECT 'Function Count Verification:' as test;

SELECT 
    COUNT(*) as total_functions,
    CASE 
        WHEN COUNT(*) = 14 THEN '✅ Perfect - All 14 functions created!'
        ELSE '❌ Warning - Missing functions!'
    END as status
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN (
    'get_dashboard_stats',
    'get_stock_trend',
    'get_top_selling_today',
    'get_top_selling_week',
    'get_low_stock_products',
    'get_recent_product_updates',
    'get_sales_total',
    'get_sales_data',
    'get_expense_data',
    'get_dashboard_optimized',
    'get_inventory_fast',
    'get_reports_fast',
    'get_stock_fast',
    'get_transfer_fast'
);

-- Test 4: No duplicate functions
SELECT 'Duplicate Check:' as test;

SELECT 
    routine_name,
    COUNT(*) as function_count,
    CASE 
        WHEN COUNT(*) = 1 THEN '✅ No duplicates'
        ELSE '❌ DUPLICATES FOUND!'
    END as status
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN (
    'get_dashboard_stats',
    'get_stock_trend',
    'get_top_selling_today',
    'get_top_selling_week',
    'get_low_stock_products',
    'get_recent_product_updates',
    'get_sales_total',
    'get_sales_data',
    'get_expense_data',
    'get_dashboard_optimized',
    'get_inventory_fast',
    'get_reports_fast',
    'get_stock_fast',
    'get_transfer_fast'
)
GROUP BY routine_name
ORDER BY routine_name;

-- Final status
SELECT 
    'Verification Complete!' as status,
    'If all tests above show ✅, your database is ready!' as details;
