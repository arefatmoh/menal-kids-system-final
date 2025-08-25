-- Fix stock_movements table to add missing variation_id column
-- This script adds the variation_id column that was missing from the original schema

-- Add variation_id column if it doesn't exist
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

-- Verify the column was added
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'stock_movements' 
ORDER BY ordinal_position;
