-- Migration: Fix price column constraint to allow NULL values
-- This migration updates the products table to allow NULL price values

-- 1. Drop any existing NOT NULL constraint on price column
ALTER TABLE products ALTER COLUMN price DROP NOT NULL;

-- 2. Ensure the price column allows NULL values
ALTER TABLE products ALTER COLUMN price SET DATA TYPE DECIMAL(10,2);

-- 3. Add purchase_price column if it doesn't exist
ALTER TABLE products ADD COLUMN IF NOT EXISTS purchase_price DECIMAL(10,2);

-- 4. Update the API to handle NULL price values properly
-- This will be handled in the application code

COMMIT; 