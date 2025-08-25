-- remove_products_by_id.sql
SET client_encoding = 'UTF8';

BEGIN;

-- List of product IDs to remove
WITH products_to_remove AS (
  SELECT id, name, sku FROM products WHERE id IN (
    'b0c97dd6-7064-42b8-999e-c19026a6ee4e',  -- Franko 0239
    'b3de68b2-0390-48da-bbb7-7995f060dcfb',  -- Mebrat 0240
    'a8369a34-eabc-411a-a33f-3c276f37030e',  -- Mukera franko 21 0151
    '58761037-23af-4e9b-b65d-a342a88ee9ef',  -- mukera 0079
    '42809a0f-8257-4014-a1cf-f7b6f3db0b2b',  -- mukera fr 22 0152
    '66ed5766-7e55-40f9-bf92-fde35ec0cb85'   -- mukera fr 223 0153
  )
),
-- First, remove all inventory records for these products
deleted_inventory AS (
  DELETE FROM inventory i
  USING products_to_remove p
  WHERE i.product_id = p.id
  RETURNING i.product_id, i.branch_id, i.quantity
),
-- Then, remove the products themselves
deleted_products AS (
  DELETE FROM products p
  USING products_to_remove ptr
  WHERE p.id = ptr.id
  RETURNING p.id, p.name, p.sku
)
-- Show what was removed
SELECT 
  'Products removed:' as action,
  COUNT(*) as count
FROM deleted_products
UNION ALL
SELECT 
  'Inventory records removed:' as action,
  COUNT(*) as count
FROM deleted_inventory;

COMMIT;

-- Optional verification - these should return 0:
-- SELECT COUNT(*) FROM products WHERE id IN (
--   'b0c97dd6-7064-42b8-999e-c19026a6ee4e',
--   'b3de68b2-0390-48da-bbb7-7995f060dcfb',
--   'a8369a34-eabc-411a-a33f-3c276f37030e',
--   '58761037-23af-4e9b-b65d-a342a88ee9ef',
--   '42809a0f-8257-4014-a1cf-f7b6f3db0b2b',
--   '66ed5766-7e55-40f9-bf92-fde35ec0cb85'
-- );