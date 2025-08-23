-- Fix missing columns in sales and related tables
-- This script adds all the missing columns that the API expects

-- 1. Add discount column to sales table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'sales' 
        AND column_name = 'discount'
    ) THEN
        ALTER TABLE sales ADD COLUMN discount DECIMAL(10,2) DEFAULT 0;
        RAISE NOTICE 'Added discount column to sales table';
    ELSE
        RAISE NOTICE 'Discount column already exists in sales table';
    END IF;
END $$;

-- 2. Add notes column to sales table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'sales' 
        AND column_name = 'notes'
    ) THEN
        ALTER TABLE sales ADD COLUMN notes TEXT;
        RAISE NOTICE 'Added notes column to sales table';
    ELSE
        RAISE NOTICE 'Notes column already exists in sales table';
    END IF;
END $$;

-- 3. Add updated_at column to sales table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'sales' 
        AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE sales ADD COLUMN updated_at TIMESTAMP DEFAULT NOW();
        RAISE NOTICE 'Added updated_at column to sales table';
    ELSE
        RAISE NOTICE 'Updated_at column already exists in sales table';
    END IF;
END $$;

-- 4. Add variation_id column to sale_items table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'sale_items' 
        AND column_name = 'variation_id'
    ) THEN
        ALTER TABLE sale_items ADD COLUMN variation_id UUID REFERENCES product_variations(id);
        CREATE INDEX IF NOT EXISTS idx_sale_items_variation_id ON sale_items(variation_id);
        RAISE NOTICE 'Added variation_id column to sale_items table';
    ELSE
        RAISE NOTICE 'variation_id column already exists in sale_items table';
    END IF;
END $$;

-- 5. Add variation_id column to inventory table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'inventory' 
        AND column_name = 'variation_id'
    ) THEN
        ALTER TABLE inventory ADD COLUMN variation_id UUID REFERENCES product_variations(id);
        CREATE INDEX IF NOT EXISTS idx_inventory_variation_id ON inventory(variation_id);
        RAISE NOTICE 'Added variation_id column to inventory table';
    ELSE
        RAISE NOTICE 'variation_id column already exists in inventory table';
    END IF;
END $$;

-- 6. Add variation_id column to stock_movements table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'stock_movements' 
        AND column_name = 'variation_id'
    ) THEN
        ALTER TABLE stock_movements ADD COLUMN variation_id UUID REFERENCES product_variations(id);
        CREATE INDEX IF NOT EXISTS idx_stock_movements_variation_id ON stock_movements(variation_id);
        RAISE NOTICE 'Added variation_id column to stock_movements table';
    ELSE
        RAISE NOTICE 'variation_id column already exists in stock_movements table';
    END IF;
END $$;

-- 7. Add variation_id column to transfer_items table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'transfer_items' 
        AND column_name = 'variation_id'
    ) THEN
        ALTER TABLE transfer_items ADD COLUMN variation_id UUID REFERENCES product_variations(id);
        CREATE INDEX IF NOT EXISTS idx_transfer_items_variation_id ON transfer_items(variation_id);
        RAISE NOTICE 'Added variation_id column to transfer_items table';
    ELSE
        RAISE NOTICE 'variation_id column already exists in transfer_items table';
    END IF;
END $$;

-- 8. Ensure all required triggers exist
DO $$
BEGIN
    -- Check if validate_sale_inventory_trigger exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'validate_sale_inventory_trigger'
    ) THEN
        RAISE NOTICE 'validate_sale_inventory_trigger is missing - please run the triggers.sql file';
    ELSE
        RAISE NOTICE 'validate_sale_inventory_trigger exists';
    END IF;
    
    -- Check if sale_inventory_trigger exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'sale_inventory_trigger'
    ) THEN
        RAISE NOTICE 'sale_inventory_trigger is missing - please run the triggers.sql file';
    ELSE
        RAISE NOTICE 'sale_inventory_trigger exists';
    END IF;
END $$;

-- Verify all columns were added
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name IN ('sales', 'sale_items', 'inventory', 'stock_movements', 'transfer_items')
AND column_name IN ('discount', 'notes', 'updated_at', 'variation_id')
ORDER BY table_name, column_name;
