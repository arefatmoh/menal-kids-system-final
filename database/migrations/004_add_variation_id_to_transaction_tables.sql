-- Migration: Add variation_id to transaction tables
-- This migration adds variation_id support to sale_items and transfer_items tables

-- Step 1: Add variation_id column to sale_items table
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS variation_id UUID REFERENCES product_variations(id);

-- Step 2: Add variation_id column to transfer_items table
ALTER TABLE transfer_items ADD COLUMN IF NOT EXISTS variation_id UUID REFERENCES product_variations(id);

-- Step 3: Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_sale_items_variation_id ON sale_items(variation_id);
CREATE INDEX IF NOT EXISTS idx_transfer_items_variation_id ON transfer_items(variation_id);

-- Step 4: Add comments for documentation
COMMENT ON COLUMN sale_items.variation_id IS 'Reference to product variation. NULL for uniform products or legacy data';
COMMENT ON COLUMN transfer_items.variation_id IS 'Reference to product variation. NULL for uniform products or legacy data';