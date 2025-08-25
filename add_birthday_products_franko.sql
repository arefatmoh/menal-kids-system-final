-- add_toys_mebrathayl.sql
SET client_encoding = 'UTF8';

BEGIN;

-- Ensure category exists
DO $$
DECLARE
  v_category_id UUID := '45bd9cfa-aaa9-40d1-928b-1dfe7092b123';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM categories WHERE id = v_category_id) THEN
    RAISE EXCEPTION 'Category id % not found', v_category_id;
  END IF;
END$$;

-- Data: name, sku, qty (SKUs 0193..0238)
WITH data(name, sku, qty) AS (
  VALUES
    (E'መጫወቻ set  እቃ','0193',3),
    (E'ጊታር','0194',4),
    (E'አሻንጉሊት የካርቶን ሲንደሬላ','0195',1),
    (E'አሻንጉሊት frozen የካርቶን','0196',1),
    (E'አሻንጉሊት የካርቶን','0197',1),
    (E'ፈረስ ጋሪ','0198',1),
    (E'ዶሮ መኪና','0199',1),
    (E'ዥዋዥዌ','0200',1),
    (E'መዋኛ ላስቲክ','0201',1),
    (E'ደናሽ መኪና','0202',1),
    (E'የወታደር እቃ','0203',1),
    (E'የኪችን እቃ','0204',1),
    (E'የፖሊስ ሽጉጥ 2ፒስ','0205',1),
    (E'ማይክሮፎን','0206',2),
    (E'ዶሮና ዳክዬ set','0207',1),
    (E'መጥረቢያ','0208',1),
    (E'ትራንስፎርመርስ','0209',2),
    (E'ትንንሹ ጭቃ','0210',1),
    (E'ፍሪክሽን አውሮፕላን','0211',1),
    (E'ፍሪክሽን ሽጉጥ','0212',1),
    (E'ጠርሙስ ፐዝል','0213',1),
    (E'ጸጉር መቁረጫ','0214',1),
    (E'ሙዚቃ ምንጣፍ','0215',1),
    (E'ፑል','0216',1),
    (E'የቤት ዕቃ','0217',3),
    (E'ምንጣፍ ትልቁ','0218',1),
    (E'ኮምፒተር','0219',3),
    (E'ቼዝ','0220',2),
    (E'ሲጥሲጥ ኳስ','0221',1),
    (E'ከሽከሽ','0222',1),
    (E'ጀት','0223',1),
    (E'ላደር snake ladders','0224',3),
    (E'ሽጉጥ ትልቁ','0225',1),
    (E'ሚዘረጋው ኳስ','0226',2),
    (E'ፒንሳ ዕቃ','0227',2),
    (E'ትንሽዋ ባቡር','0228',1),
    (E'ባላ','0229',2),
    (E'ባቡር ትልቁ','0230',1),
    (E'ሳክስፎን መገጣጠሚያ','0231',2),
    (E'ጊታር ብሎክ','0232',1),
    (E'ፕሮጀክተር ፔንቲንግ','0233',1),
    (E'አሻንጉሊት የውጭ ትልልቁ','0234',2),
    (E'አሻንጉሊት መካከለኛ','0235',12),
    (E'አሻንጉሊት በግ','0236',2),
    (E'አሻንጉሊት ዝሆን','0237',1),
    (E'አሻንጉሊት ግብዳ','0238',1)
),
ins AS (
  -- Insert or update products by SKU
  INSERT INTO products (name, sku, category_id)
  SELECT d.name, d.sku, '45bd9cfa-aaa9-40d1-928b-1dfe7092b123'::uuid
  FROM data d
  ON CONFLICT (sku)
  DO UPDATE SET
    name = EXCLUDED.name,
    category_id = EXCLUDED.category_id,
    updated_at = NOW()
  RETURNING id, sku
),
-- Update existing inventory rows for branch2 (no variation)
upd AS (
  UPDATE inventory i
  SET quantity = i.quantity + d.qty,
      updated_at = NOW()
  FROM data d
  JOIN ins p ON p.sku = d.sku
  WHERE i.product_id = p.id
    AND i.branch_id = 'branch2'
    AND i.variation_id IS NULL
  RETURNING i.product_id
)
-- Insert new inventory rows for branch2 that don't exist
INSERT INTO inventory (product_id, variation_id, branch_id, quantity, min_stock_level, max_stock_level)
SELECT p.id, NULL, 'branch2', d.qty, 0, NULL
FROM data d
JOIN ins p ON p.sku = d.sku
LEFT JOIN upd u ON u.product_id = p.id
WHERE u.product_id IS NULL;

COMMIT;

-- Optional checks:
-- SELECT COUNT(*) FROM products WHERE sku BETWEEN '0193' AND '0238';
-- SELECT p.sku, i.branch_id, i.quantity
-- FROM products p JOIN inventory i ON i.product_id = p.id
-- WHERE p.sku BETWEEN '0193' AND '0238'
-- ORDER BY p.sku, i.branch_id;