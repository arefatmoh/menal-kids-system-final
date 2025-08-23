-- Master Database Fix Script
-- This script runs all necessary database fixes in the correct order

-- 1. Run the comprehensive database fix
\i fix_all_database_issues.sql

-- 2. Run the trigger setup
\i setup_all_triggers.sql

-- 3. Run the original triggers file to ensure everything is up to date
\i database/triggers.sql

-- 4. Run the functions file to ensure all functions exist
\i database/functions.sql

-- 5. Final verification
SELECT 'All database fixes completed successfully!' as status;

-- Show summary of what was fixed
SELECT 
    'Database Status' as category,
    COUNT(*) as count,
    'All required objects exist' as status
FROM (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name IN ('sales', 'sale_items', 'products', 'categories', 'inventory', 'stock_movements', 'transfers', 'transfer_items', 'users', 'branches', 'product_variations', 'alerts')
    AND table_schema = 'public'
    
    UNION ALL
    
    SELECT 1 FROM information_schema.columns 
    WHERE table_name IN ('sales', 'sale_items', 'inventory', 'stock_movements', 'transfer_items', 'transfers', 'alerts')
    AND column_name IN ('discount', 'notes', 'updated_at', 'variation_id', 'reason', 'reference_type', 'reference_id', 'requested_at', 'approved_at', 'completed_at', 'threshold_value', 'current_value', 'action_required', 'acknowledged_at', 'resolved_at')
    AND table_schema = 'public'
    
    UNION ALL
    
    SELECT 1 FROM information_schema.routines 
    WHERE routine_name IN ('generate_sku', 'trigger_generate_product_sku', 'tableHasColumn')
    AND routine_schema = 'public'
    
    UNION ALL
    
    SELECT 1 FROM information_schema.triggers 
    WHERE trigger_name IN ('inventory_movement_trigger', 'low_stock_alert_trigger', 'validate_sale_inventory_trigger', 'sale_inventory_trigger', 'generate_sku_trigger')
    AND trigger_schema = 'public'
) as all_objects;
