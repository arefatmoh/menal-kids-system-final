-- Test database structure
-- Run this with: psql $CONN -f test_database_structure.sql

-- Check if required tables exist
SELECT 'Checking if sales table exists...' as message;
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'sales'
) as sales_table_exists;

SELECT 'Checking if sale_items table exists...' as message;
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'sale_items'
) as sale_items_table_exists;

SELECT 'Checking if branches table exists...' as message;
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'branches'
) as branches_table_exists;

SELECT 'Checking if expenses table exists...' as message;
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'expenses'
) as expenses_table_exists;

-- Check table structures
SELECT 'Sales table structure:' as message;
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'sales' 
ORDER BY ordinal_position;

SELECT 'Sale_items table structure:' as message;
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'sale_items' 
ORDER BY ordinal_position;

SELECT 'Branches table structure:' as message;
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'branches' 
ORDER BY ordinal_position;

SELECT 'Expenses table structure:' as message;
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'expenses' 
ORDER BY ordinal_position;

-- Check if functions exist
SELECT 'Checking if get_sales_data function exists...' as message;
SELECT EXISTS (
    SELECT FROM information_schema.routines 
    WHERE routine_schema = 'public' 
    AND routine_name = 'get_sales_data'
) as get_sales_data_exists;

SELECT 'Checking if get_expense_data function exists...' as message;
SELECT EXISTS (
    SELECT FROM information_schema.routines 
    WHERE routine_schema = 'public' 
    AND routine_name = 'get_expense_data'
) as get_expense_data_exists;
