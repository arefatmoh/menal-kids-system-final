-- Test script to verify no duplication occurs
-- This will help us confirm the fix is working

-- First, let's see the current state
SELECT 'Current stock movements count:' as info;
SELECT COUNT(*) as total_movements FROM stock_movements;

-- Let's also check if there are any recent movements
SELECT 'Recent movements (last 1 hour):' as info;
SELECT 
    product_id, 
    movement_type, 
    quantity, 
    reference_type, 
    created_at,
    COUNT(*) as duplicate_count
FROM stock_movements 
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY product_id, movement_type, quantity, reference_type, created_at
HAVING COUNT(*) > 1
ORDER BY created_at DESC;

-- Test the trigger logic
SELECT 'Testing trigger logic:' as info;
SELECT 
    trigger_name,
    event_object_table,
    action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'inventory';

-- Check the function definition
SELECT 'Current trigger function:' as info;
SELECT prosrc FROM pg_proc WHERE proname = 'trigger_inventory_stock_movement';

-- Success message
SELECT 'Duplication test completed. Check the results above.' as status;
