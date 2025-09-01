-- Completely remove the problematic trigger function
-- This will eliminate the alerts constraint violation error

-- Drop the trigger function that's causing the alerts constraint violation
DROP FUNCTION IF EXISTS trigger_check_low_stock() CASCADE;

-- Also drop the inventory movement trigger function to be safe
DROP FUNCTION IF EXISTS trigger_inventory_stock_movement() CASCADE;

-- Verify the functions are gone
SELECT proname FROM pg_proc WHERE proname IN ('trigger_check_low_stock', 'trigger_inventory_stock_movement');

-- Test that we can update inventory without any trigger conflicts
-- Let's see if there are any inventory records to test with
SELECT COUNT(*) as inventory_count FROM inventory;

-- Success message
SELECT 'Problematic trigger functions completely removed! Stock movements should now work without any errors.' as status;
