-- Migration: Fix variation support for all transaction tables
-- This migration ensures all tables have proper variation_id support

-- Step 1: Add variation_id column to sale_items table (if not exists)
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS variation_id UUID REFERENCES product_variations(id);

-- Step 2: Add variation_id column to transfer_items table (if not exists)
ALTER TABLE transfer_items ADD COLUMN IF NOT EXISTS variation_id UUID REFERENCES product_variations(id);

-- Step 3: Add variation_id column to stock_movements table (if not exists)
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS variation_id UUID REFERENCES product_variations(id);

-- Step 4: Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_sale_items_variation_id ON sale_items(variation_id);
CREATE INDEX IF NOT EXISTS idx_transfer_items_variation_id ON transfer_items(variation_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_variation_id ON stock_movements(variation_id);

-- Step 5: Add comments for documentation
COMMENT ON COLUMN sale_items.variation_id IS 'Reference to product variation. NULL for uniform products or legacy data';
COMMENT ON COLUMN transfer_items.variation_id IS 'Reference to product variation. NULL for uniform products or legacy data';
COMMENT ON COLUMN stock_movements.variation_id IS 'Reference to product variation. NULL for uniform products or legacy data';

-- Step 6: Update inventory queries to handle variation_id properly
-- This ensures the inventory table can properly track variations
DO $$
BEGIN
    -- Check if variation_id column exists in inventory table
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'inventory' AND column_name = 'variation_id'
    ) THEN
        ALTER TABLE inventory ADD COLUMN variation_id UUID REFERENCES product_variations(id);
        CREATE INDEX IF NOT EXISTS idx_inventory_variation_id ON inventory(variation_id);
        COMMENT ON COLUMN inventory.variation_id IS 'Reference to product variation. NULL for uniform products';
    END IF;
END$$;

-- Step 7: Ensure product_variations table has all necessary columns
DO $$
BEGIN
    -- Add variation_id column if it doesn't exist (for consistency)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'product_variations' AND column_name = 'variation_id'
    ) THEN
        ALTER TABLE product_variations ADD COLUMN variation_id UUID DEFAULT uuid_generate_v4();
        CREATE UNIQUE INDEX IF NOT EXISTS idx_product_variations_variation_id ON product_variations(variation_id);
        COMMENT ON COLUMN product_variations.variation_id IS 'Unique identifier for this variation';
    END IF;
END$$;

-- Step 8: Update any existing NULL variation_id values to be consistent
-- This is safe to run multiple times
UPDATE sale_items SET variation_id = NULL WHERE variation_id IS NULL;
UPDATE transfer_items SET variation_id = NULL WHERE variation_id IS NULL;
UPDATE stock_movements SET variation_id = NULL WHERE variation_id IS NULL;
UPDATE inventory SET variation_id = NULL WHERE variation_id IS NULL;
