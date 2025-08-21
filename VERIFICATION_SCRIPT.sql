-- Product Variations System - Verification Script
-- This script verifies that all backend integration and data migration is working correctly

-- 1. Check if product_variations table exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'product_variations') THEN
        RAISE EXCEPTION 'product_variations table does not exist';
    ELSE
        RAISE NOTICE '✅ product_variations table exists';
    END IF;
END $$;

-- 2. Check if product_type column exists in products table
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'product_type') THEN
        RAISE EXCEPTION 'product_type column does not exist in products table';
    ELSE
        RAISE NOTICE '✅ product_type column exists in products table';
    END IF;
END $$;

-- 3. Check if variation_id column exists in inventory table
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'inventory' AND column_name = 'variation_id') THEN
        RAISE EXCEPTION 'variation_id column does not exist in inventory table';
    ELSE
        RAISE NOTICE '✅ variation_id column exists in inventory table';
    END IF;
END $$;

-- 4. Check if required indexes exist
DO $$
BEGIN
    -- Check product_variations indexes
    IF NOT EXISTS (SELECT FROM pg_indexes WHERE indexname = 'idx_product_variations_product_id') THEN
        RAISE NOTICE '⚠️ idx_product_variations_product_id index missing';
    ELSE
        RAISE NOTICE '✅ idx_product_variations_product_id index exists';
    END IF;
    
    IF NOT EXISTS (SELECT FROM pg_indexes WHERE indexname = 'idx_product_variations_sku') THEN
        RAISE NOTICE '⚠️ idx_product_variations_sku index missing';
    ELSE
        RAISE NOTICE '✅ idx_product_variations_sku index exists';
    END IF;
    
    IF NOT EXISTS (SELECT FROM pg_indexes WHERE indexname = 'idx_inventory_variation_id') THEN
        RAISE NOTICE '⚠️ idx_inventory_variation_id index missing';
    ELSE
        RAISE NOTICE '✅ idx_inventory_variation_id index exists';
    END IF;
END $$;

-- 5. Check if triggers exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_trigger WHERE tgname = 'update_product_variations_updated_at') THEN
        RAISE NOTICE '⚠️ update_product_variations_updated_at trigger missing';
    ELSE
        RAISE NOTICE '✅ update_product_variations_updated_at trigger exists';
    END IF;
    
    IF NOT EXISTS (SELECT FROM pg_trigger WHERE tgname = 'generate_variation_sku_trigger') THEN
        RAISE NOTICE '⚠️ generate_variation_sku_trigger missing';
    ELSE
        RAISE NOTICE '✅ generate_variation_sku_trigger exists';
    END IF;
END $$;

-- 6. Check if functions exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_proc WHERE proname = 'generate_variation_sku') THEN
        RAISE NOTICE '⚠️ generate_variation_sku function missing';
    ELSE
        RAISE NOTICE '✅ generate_variation_sku function exists';
    END IF;
    
    IF NOT EXISTS (SELECT FROM pg_proc WHERE proname = 'trigger_generate_variation_sku') THEN
        RAISE NOTICE '⚠️ trigger_generate_variation_sku function missing';
    ELSE
        RAISE NOTICE '✅ trigger_generate_variation_sku function exists';
    END IF;
END $$;

-- 7. Check if views exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.views WHERE table_name = 'v_products_with_variations') THEN
        RAISE NOTICE '⚠️ v_products_with_variations view missing';
    ELSE
        RAISE NOTICE '✅ v_products_with_variations view exists';
    END IF;
    
    IF NOT EXISTS (SELECT FROM information_schema.views WHERE table_name = 'v_inventory_with_variations') THEN
        RAISE NOTICE '⚠️ v_inventory_with_variations view missing';
    ELSE
        RAISE NOTICE '✅ v_inventory_with_variations view exists';
    END IF;
END $$;

-- 8. Check data integrity
DO $$
DECLARE
    product_count INTEGER;
    variation_count INTEGER;
    inventory_count INTEGER;
    orphaned_variations INTEGER;
    orphaned_inventory INTEGER;
BEGIN
    -- Count products
    SELECT COUNT(*) INTO product_count FROM products WHERE is_active = true;
    RAISE NOTICE '📊 Total active products: %', product_count;
    
    -- Count variations
    SELECT COUNT(*) INTO variation_count FROM product_variations WHERE is_active = true;
    RAISE NOTICE '📊 Total active variations: %', variation_count;
    
    -- Count inventory records
    SELECT COUNT(*) INTO inventory_count FROM inventory;
    RAISE NOTICE '📊 Total inventory records: %', inventory_count;
    
    -- Check for orphaned variations (variations without products)
    SELECT COUNT(*) INTO orphaned_variations 
    FROM product_variations pv 
    LEFT JOIN products p ON pv.product_id = p.id 
    WHERE p.id IS NULL;
    
    IF orphaned_variations > 0 THEN
        RAISE NOTICE '⚠️ Found % orphaned variations (without products)', orphaned_variations;
    ELSE
        RAISE NOTICE '✅ No orphaned variations found';
    END IF;
    
    -- Check for orphaned inventory (inventory without products)
    SELECT COUNT(*) INTO orphaned_inventory 
    FROM inventory i 
    LEFT JOIN products p ON i.product_id = p.id 
    WHERE p.id IS NULL;
    
    IF orphaned_inventory > 0 THEN
        RAISE NOTICE '⚠️ Found % orphaned inventory records (without products)', orphaned_inventory;
    ELSE
        RAISE NOTICE '✅ No orphaned inventory records found';
    END IF;
END $$;

-- 9. Test variation creation (if any products exist)
DO $$
DECLARE
    test_product_id UUID;
    test_variation_id UUID;
BEGIN
    -- Get a test product
    SELECT id INTO test_product_id FROM products WHERE is_active = true LIMIT 1;
    
    IF test_product_id IS NOT NULL THEN
        RAISE NOTICE '🧪 Testing variation creation for product: %', test_product_id;
        
        -- Try to create a test variation
        INSERT INTO product_variations (product_id, sku, color, size, price)
        VALUES (test_product_id, 'TEST-VAR-' || substr(md5(random()::text), 1, 6), 'test-color', 'test-size', 25.00)
        RETURNING id INTO test_variation_id;
        
        RAISE NOTICE '✅ Test variation created successfully: %', test_variation_id;
        
        -- Clean up test variation
        DELETE FROM product_variations WHERE id = test_variation_id;
        RAISE NOTICE '🧹 Test variation cleaned up';
    ELSE
        RAISE NOTICE '⚠️ No products found for testing variation creation';
    END IF;
END $$;

-- 10. Check constraint integrity
DO $$
BEGIN
    -- Check if unique constraint exists
    IF NOT EXISTS (
        SELECT FROM information_schema.table_constraints 
        WHERE constraint_name = 'inventory_product_variation_branch_key'
    ) THEN
        RAISE NOTICE '⚠️ inventory_product_variation_branch_key constraint missing';
    ELSE
        RAISE NOTICE '✅ inventory_product_variation_branch_key constraint exists';
    END IF;
    
    -- Check if check constraint exists for product_type
    IF NOT EXISTS (
        SELECT FROM information_schema.check_constraints 
        WHERE constraint_name LIKE '%product_type%'
    ) THEN
        RAISE NOTICE '⚠️ product_type check constraint missing';
    ELSE
        RAISE NOTICE '✅ product_type check constraint exists';
    END IF;
END $$;

-- 11. Final summary
SELECT 
    'Product Variations System Verification Complete' as status,
    (SELECT COUNT(*) FROM products WHERE is_active = true) as total_products,
    (SELECT COUNT(*) FROM product_variations WHERE is_active = true) as total_variations,
    (SELECT COUNT(*) FROM inventory) as total_inventory_records,
    CASE 
        WHEN EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'product_variations') 
        AND EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'product_type')
        AND EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'inventory' AND column_name = 'variation_id')
        THEN '✅ All core components present'
        ELSE '❌ Missing core components'
    END as system_status;
