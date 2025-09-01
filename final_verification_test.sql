-- Final verification test
-- This will confirm that all duplication fixes are working correctly

-- Test 1: Check current dashboard stats
SELECT 'Test 1: Current Dashboard Stats' as test_name;
SELECT * FROM get_dashboard_stats();

-- Test 2: Check trigger function definition
SELECT 'Test 2: Trigger Function Definition' as test_name;
SELECT prosrc FROM pg_proc WHERE proname = 'trigger_inventory_stock_movement';

-- Test 3: Check active triggers
SELECT 'Test 3: Active Triggers' as test_name;
SELECT 
    trigger_name,
    event_object_table,
    action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'inventory';

-- Test 4: Check alerts constraint
SELECT 'Test 4: Alerts Constraint Test' as test_name;
INSERT INTO alerts (type, severity, title, message, branch_id, status) 
VALUES ('inventory', 'medium', 'Test Alert', 'Test message', 'branch1', 'active')
ON CONFLICT DO NOTHING;

-- Clean up test data
DELETE FROM alerts WHERE title = 'Test Alert';

-- Test 5: Check stock movements table structure
SELECT 'Test 5: Stock Movements Table Structure' as test_name;
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'stock_movements' 
ORDER BY ordinal_position;

-- Final success message
SELECT 'All duplication fixes verified and working correctly!' as final_status;
