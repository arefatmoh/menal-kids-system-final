-- 006: Enforce inventory uniqueness and optional backfill

-- Uniqueness: prevent duplicate rows per product-branch for uniform
CREATE UNIQUE INDEX IF NOT EXISTS uniq_inventory_uniform
  ON inventory(product_id, branch_id)
  WHERE variation_id IS NULL;

-- Uniqueness: prevent duplicate rows per product-branch-variation for variations
CREATE UNIQUE INDEX IF NOT EXISTS uniq_inventory_variation
  ON inventory(product_id, branch_id, variation_id)
  WHERE variation_id IS NOT NULL;

-- Ensure quantities are never negative
ALTER TABLE inventory
  ADD CONSTRAINT IF NOT EXISTS chk_inventory_non_negative
  CHECK (quantity >= 0);

-- Optional backfill: insert missing zero-quantity inventory rows for existing variations per branch
-- Note: Safe to run multiple times
INSERT INTO inventory (product_id, variation_id, branch_id, quantity, min_stock_level, max_stock_level)
SELECT
  pv.product_id,
  pv.id as variation_id,
  b.id as branch_id,
  0 as quantity,
  NULL as min_stock_level,
  NULL as max_stock_level
FROM product_variations pv
CROSS JOIN branches b
LEFT JOIN inventory i
  ON i.product_id = pv.product_id
 AND i.branch_id = b.id
 AND i.variation_id = pv.id
WHERE i.id IS NULL;

-- Optional backfill: insert missing zero-quantity uniform rows for uniform products per branch
INSERT INTO inventory (product_id, branch_id, quantity, min_stock_level, max_stock_level)
SELECT
  p.id as product_id,
  b.id as branch_id,
  0 as quantity,
  NULL as min_stock_level,
  NULL as max_stock_level
FROM products p
CROSS JOIN branches b
LEFT JOIN inventory i
  ON i.product_id = p.id
 AND i.branch_id = b.id
WHERE p.product_type = 'uniform'
  AND i.id IS NULL;
