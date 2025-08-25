-- Test the get_inventory_fast function
SELECT 'Testing get_inventory_fast function...' as test;

-- Test with basic parameters
SELECT * FROM get_inventory_fast(1, 5, NULL, NULL, false);

-- Test with search
SELECT * FROM get_inventory_fast(1, 5, 'test', NULL, false);

-- Test with branch filter
SELECT * FROM get_inventory_fast(1, 5, NULL, 'branch1', false);

-- Test cross-branch
SELECT * FROM get_inventory_fast(1, 5, NULL, NULL, true);

-- Check if function exists and is working
SELECT 
    proname as function_name,
    proargtypes as argument_types,
    prorettype as return_type
FROM pg_proc 
WHERE proname = 'get_inventory_fast';
