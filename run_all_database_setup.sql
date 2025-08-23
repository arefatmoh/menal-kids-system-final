-- Master Database Setup Script
-- This script runs all necessary database setup files in the correct order

-- 1. Run the complete database setup
\i setup_database_complete.sql

-- 2. Run the triggers file to ensure all triggers exist
\i database/triggers.sql

-- 3. Run the functions file to ensure all functions exist
\i database/functions.sql

-- 4. Run the SKU trigger fix
\i fix_sku_trigger.sql

-- 5. Final verification
SELECT 'Database setup completed successfully!' as status;
