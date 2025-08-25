-- Comprehensive fix for stock management system
-- This script addresses all the database issues preventing stock operations from working

-- 1. Add missing variation_id column to stock_movements table
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'stock_movements' 
        AND column_name = 'variation_id'
    ) THEN
        ALTER TABLE stock_movements 
        ADD COLUMN variation_id UUID REFERENCES product_variations(id);
        
        RAISE NOTICE 'Added variation_id column to stock_movements table';
    ELSE
        RAISE NOTICE 'variation_id column already exists in stock_movements table';
    END IF;
END $$;

-- 2. Ensure inventory table has proper unique constraints
-- Drop existing constraint if it exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'inventory_product_variation_branch_key'
    ) THEN
        ALTER TABLE inventory DROP CONSTRAINT inventory_product_variation_branch_key;
        RAISE NOTICE 'Dropped existing unique constraint';
    END IF;
END $$;

-- Add proper unique constraint that handles NULL variation_id correctly
ALTER TABLE inventory 
ADD CONSTRAINT inventory_product_variation_branch_key 
UNIQUE (product_id, COALESCE(variation_id, '00000000-0000-0000-0000-000000000000'::uuid), branch_id);

-- 3. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_inventory_product_branch ON inventory(product_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_inventory_variation_branch ON inventory(variation_id, branch_id) WHERE variation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_stock_movements_product_branch ON stock_movements(product_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_variation ON stock_movements(variation_id) WHERE variation_id IS NOT NULL;

-- 4. Ensure all required columns exist in inventory table
DO $$ 
BEGIN
    -- Add updated_at column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'inventory' 
        AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE inventory 
        ADD COLUMN updated_at TIMESTAMP DEFAULT NOW();
        
        RAISE NOTICE 'Added updated_at column to inventory table';
    END IF;
    
    -- Add min_stock_level and max_stock_level if they don't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'inventory' 
        AND column_name = 'min_stock_level'
    ) THEN
        ALTER TABLE inventory 
        ADD COLUMN min_stock_level INTEGER DEFAULT 0;
        
        RAISE NOTICE 'Added min_stock_level column to inventory table';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'inventory' 
        AND column_name = 'max_stock_level'
    ) THEN
        ALTER TABLE inventory 
        ADD COLUMN max_stock_level INTEGER DEFAULT 1000;
        
        RAISE NOTICE 'Added max_stock_level column to inventory table';
    END IF;
END $$;

-- 5. Create a function to safely update inventory
CREATE OR REPLACE FUNCTION update_inventory_safe(
    p_product_id UUID,
    p_variation_id UUID DEFAULT NULL,
    p_branch_id VARCHAR(50),
    p_quantity_change INTEGER,
    p_movement_type VARCHAR(10)
) RETURNS BOOLEAN AS $$
DECLARE
    current_quantity INTEGER;
    new_quantity INTEGER;
BEGIN
    -- Get current quantity
    SELECT COALESCE(quantity, 0) INTO current_quantity
    FROM inventory 
    WHERE product_id = p_product_id 
      AND variation_id IS NOT DISTINCT FROM p_variation_id 
      AND branch_id = p_branch_id;
    
    -- Calculate new quantity
    IF p_movement_type = 'in' THEN
        new_quantity := current_quantity + p_quantity_change;
    ELSE
        new_quantity := GREATEST(0, current_quantity - p_quantity_change);
    END IF;
    
    -- Update or insert inventory record
    IF current_quantity IS NULL THEN
        -- Insert new record
        INSERT INTO inventory (
            product_id, variation_id, branch_id, quantity, 
            min_stock_level, max_stock_level, created_at, updated_at
        ) VALUES (
            p_product_id, p_variation_id, p_branch_id, new_quantity,
            0, 1000, NOW(), NOW()
        );
    ELSE
        -- Update existing record
        UPDATE inventory 
        SET quantity = new_quantity, updated_at = NOW()
        WHERE product_id = p_product_id 
          AND variation_id IS NOT DISTINCT FROM p_variation_id 
          AND branch_id = p_branch_id;
    END IF;
    
    RETURN TRUE;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error updating inventory: %', SQLERRM;
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- 6. Verify the fixes
SELECT 'Database fixes completed successfully' as status;

-- Show table structure
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name IN ('stock_movements', 'inventory')
ORDER BY table_name, ordinal_position;

-- Show constraints
SELECT 
    tc.table_name,
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_name IN ('stock_movements', 'inventory')
ORDER BY tc.table_name, tc.constraint_name;
