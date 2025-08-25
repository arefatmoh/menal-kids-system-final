-- Test All Optimized Functions
-- Run this after fixing the database functions to verify they work

-- Test 1: Dashboard Stats
SELECT 'Testing get_dashboard_stats...' as test;
SELECT * FROM get_dashboard_stats(NULL) LIMIT 1;

-- Test 2: Stock Trend
SELECT 'Testing get_stock_trend...' as test;
SELECT * FROM get_stock_trend(NULL) LIMIT 1;

-- Test 3: Top Selling Today
SELECT 'Testing get_top_selling_today...' as test;
SELECT * FROM get_top_selling_today(NULL) LIMIT 1;

-- Test 4: Top Selling Week
SELECT 'Testing get_top_selling_week...' as test;
SELECT * FROM get_top_selling_week(NULL) LIMIT 1;

-- Test 5: Low Stock Products
SELECT 'Testing get_low_stock_products...' as test;
SELECT * FROM get_low_stock_products(NULL) LIMIT 1;

-- Test 6: Recent Updates
SELECT 'Testing get_recent_product_updates...' as test;
SELECT * FROM get_recent_product_updates(NULL) LIMIT 1;

-- Test 7: Sales Total
SELECT 'Testing get_sales_total...' as test;
SELECT * FROM get_sales_total(NULL) LIMIT 1;

-- Test 8: Sales Data
SELECT 'Testing get_sales_data...' as test;
SELECT * FROM get_sales_data(NULL, NULL, NULL, 'daily') LIMIT 1;

-- Test 9: Expense Data
SELECT 'Testing get_expense_data...' as test;
SELECT * FROM get_expense_data(NULL, NULL, NULL) LIMIT 1;

-- Test 10: Optimized Dashboard
SELECT 'Testing get_dashboard_optimized...' as test;
SELECT get_dashboard_optimized(NULL) as result;

-- Test 11: Optimized Inventory
SELECT 'Testing get_inventory_fast...' as test;
SELECT * FROM get_inventory_fast(1, 5, NULL, NULL, false);

-- Test 12: Optimized Reports
SELECT 'Testing get_reports_fast...' as test;
SELECT get_reports_fast('daily', NULL, NULL, NULL) as result;

-- Test 13: Optimized Stock
SELECT 'Testing get_stock_fast...' as test;
SELECT get_stock_fast(NULL, 1, 5) as result;

-- Test 14: Optimized Transfer
SELECT 'Testing get_transfer_fast...' as test;
SELECT get_transfer_fast(NULL) as result;

-- Final Status
SELECT 
    'All Functions Tested!' as status,
    'If no errors above, all functions are working correctly' as details;
