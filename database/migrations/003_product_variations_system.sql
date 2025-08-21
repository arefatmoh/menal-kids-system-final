-- Migration: Product Variations System
-- This migration adds support for product variations

-- Step 1: Add product_type column to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS product_type VARCHAR(20) DEFAULT 'uniform' CHECK (product_type IN ('uniform', 'variation'));

-- Step 2: Create product_variations table
CREATE TABLE IF NOT EXISTS product_variations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    sku VARCHAR(100) UNIQUE NOT NULL,
    color VARCHAR(100),
    size VARCHAR(50),
    price DECIMAL(10,2),
    cost_price DECIMAL(10,2),
    purchase_price DECIMAL(10,2),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Step 3: Add variation_id column to inventory table
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS variation_id UUID REFERENCES product_variations(id);

-- Step 4: Update inventory table unique constraint
-- First, drop the existing unique constraint if it exists
ALTER TABLE inventory DROP CONSTRAINT IF EXISTS inventory_product_branch_key;

-- Then add the new unique constraint that includes variation_id
ALTER TABLE inventory ADD CONSTRAINT inventory_product_variation_branch_key UNIQUE(product_id, variation_id, branch_id);

-- Step 5: Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_product_variations_product_id ON product_variations(product_id);
CREATE INDEX IF NOT EXISTS idx_product_variations_sku ON product_variations(sku);
CREATE INDEX IF NOT EXISTS idx_product_variations_active ON product_variations(is_active);
CREATE INDEX IF NOT EXISTS idx_inventory_variation_id ON inventory(variation_id);

-- Step 6: Migrate existing data
-- For existing products, create uniform variations
INSERT INTO product_variations (product_id, sku, color, size, price, cost_price, purchase_price)
SELECT 
    p.id,
    p.sku || '-UNI',
    p.color,
    p.size,
    p.price,
    p.cost_price,
    p.purchase_price
FROM products p
WHERE p.product_type IS NULL OR p.product_type = 'uniform'
ON CONFLICT (sku) DO NOTHING;

-- Step 7: Update inventory records to reference variations
UPDATE inventory i
SET variation_id = pv.id
FROM product_variations pv
WHERE i.product_id = pv.product_id 
  AND i.variation_id IS NULL
  AND pv.sku LIKE '%-UNI';

-- Step 8: Update products table to set product_type for existing products
UPDATE products 
SET product_type = 'uniform' 
WHERE product_type IS NULL;

-- Step 9: Create trigger to update updated_at column for product_variations
CREATE OR REPLACE FUNCTION update_product_variations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_product_variations_updated_at 
    BEFORE UPDATE ON product_variations 
    FOR EACH ROW 
    EXECUTE FUNCTION update_product_variations_updated_at();

-- Step 10: Create function to generate SKU for variations
CREATE OR REPLACE FUNCTION generate_variation_sku(product_sku VARCHAR, variation_suffix VARCHAR DEFAULT NULL)
RETURNS VARCHAR AS $$
BEGIN
    IF variation_suffix IS NULL THEN
        RETURN product_sku || '-' || upper(substring(md5(random()::text) from 1 for 6));
    ELSE
        RETURN product_sku || '-' || variation_suffix;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Step 11: Create trigger to auto-generate SKU for variations if not provided
CREATE OR REPLACE FUNCTION trigger_generate_variation_sku()
RETURNS TRIGGER AS $$
DECLARE
    product_sku VARCHAR(100);
BEGIN
    -- Only generate SKU if not provided
    IF NEW.sku IS NULL OR NEW.sku = '' THEN
        -- Get product SKU
        SELECT sku INTO product_sku FROM products WHERE id = NEW.product_id;
        
        -- Generate variation SKU
        NEW.sku := generate_variation_sku(product_sku);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply the SKU generation trigger
DROP TRIGGER IF EXISTS generate_variation_sku_trigger ON product_variations;
CREATE TRIGGER generate_variation_sku_trigger
    BEFORE INSERT ON product_variations
    FOR EACH ROW
    EXECUTE FUNCTION trigger_generate_variation_sku();

-- Step 12: Create view for products with variations
CREATE OR REPLACE VIEW v_products_with_variations AS
SELECT 
    p.*,
    c.name as category_name,
    COUNT(pv.id) as variation_count,
    COALESCE(SUM(i.quantity), 0) as total_stock
FROM products p
LEFT JOIN categories c ON p.category_id = c.id
LEFT JOIN product_variations pv ON p.id = pv.product_id AND pv.is_active = true
LEFT JOIN inventory i ON pv.id = i.variation_id
WHERE p.is_active = true
GROUP BY p.id, c.name
ORDER BY p.created_at DESC;

-- Step 13: Create view for inventory with variations
CREATE OR REPLACE VIEW v_inventory_with_variations AS
SELECT 
    i.*,
    p.name as product_name,
    p.sku as product_sku,
    p.product_type,
    p.brand,
    p.age_range,
    p.gender,
    c.name as category_name,
    b.name as branch_name,
    pv.sku as variation_sku,
    pv.color,
    pv.size,
    pv.price,
    pv.cost_price,
    pv.purchase_price,
    CASE 
        WHEN i.quantity = 0 THEN 'out_of_stock'
        WHEN i.min_stock_level IS NOT NULL AND i.quantity <= i.min_stock_level THEN 'low_stock'
        WHEN i.max_stock_level IS NOT NULL AND i.quantity >= i.max_stock_level THEN 'overstock'
        ELSE 'normal'
    END as stock_status
FROM inventory i
JOIN products p ON i.product_id = p.id
JOIN categories c ON p.category_id = c.id
JOIN branches b ON i.branch_id = b.id
LEFT JOIN product_variations pv ON i.variation_id = pv.id
WHERE p.is_active = true AND (pv.id IS NULL OR pv.is_active = true)
ORDER BY p.name, pv.sku;

-- Step 14: Add comments for documentation
COMMENT ON TABLE product_variations IS 'Stores product variations (colors, sizes, prices) for variation-type products';
COMMENT ON COLUMN products.product_type IS 'Type of product: uniform (single variation) or variation (multiple variations)';
COMMENT ON COLUMN inventory.variation_id IS 'Reference to product variation. NULL for uniform products or legacy data';
COMMENT ON VIEW v_products_with_variations IS 'View showing products with their variation counts and total stock';
COMMENT ON VIEW v_inventory_with_variations IS 'View showing inventory with variation details and stock status';
