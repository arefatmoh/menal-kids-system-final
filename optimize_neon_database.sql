-- Neon Database Optimization Script
-- Optimized specifically for Neon's serverless architecture

-- 1. Enable required extensions for Neon
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- 2. Neon-optimized indexes (lighter weight for serverless)
-- Sales indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sales_branch_id ON sales(branch_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sales_created_at ON sales(created_at);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sales_branch_created ON sales(branch_id, created_at);

-- Sale items indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sale_items_product_id ON sale_items(product_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sale_items_variation_id ON sale_items(variation_id);

-- Inventory indexes (most important for performance)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inventory_product_branch_variation ON inventory(product_id, branch_id, variation_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inventory_branch_product ON inventory(branch_id, product_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inventory_quantity ON inventory(quantity);

-- Products indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_category_active ON products(category_id, is_active);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_name_active ON products(name, is_active);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_sku_active ON products(sku, is_active);

-- Product variations indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_product_variations_product_id ON product_variations(product_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_product_variations_sku ON product_variations(sku);

-- 3. Neon-optimized composite indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inventory_lookup ON inventory(product_id, branch_id, variation_id, quantity);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_search ON products(name, sku, brand, is_active);

-- 4. Partial indexes for Neon (save space and improve performance)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_active_only ON products(name, sku, brand) WHERE is_active = true;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inventory_with_stock ON inventory(product_id, branch_id, variation_id) WHERE quantity > 0;

-- 5. Update statistics for better query planning
ANALYZE sales;
ANALYZE sale_items;
ANALYZE inventory;
ANALYZE products;
ANALYZE product_variations;

-- 6. Neon-optimized materialized view (lighter weight)
CREATE MATERIALIZED VIEW IF NOT EXISTS inventory_summary_neon AS
SELECT 
    i.product_id,
    i.branch_id,
    i.variation_id,
    p.name as product_name,
    p.sku as product_sku,
    pv.color,
    pv.size,
    b.name as branch_name,
    c.name as category_name,
    SUM(i.quantity) as total_quantity,
    MIN(i.min_stock_level) as min_stock_level,
    MAX(i.max_stock_level) as max_stock_level
FROM inventory i
JOIN products p ON i.product_id = p.id
JOIN branches b ON i.branch_id = b.id
JOIN categories c ON p.category_id = c.id
LEFT JOIN product_variations pv ON i.variation_id = pv.id
WHERE p.is_active = true
GROUP BY i.product_id, i.branch_id, i.variation_id, p.name, p.sku, pv.color, pv.size, b.name, c.name;

-- Create index on materialized view
CREATE INDEX IF NOT EXISTS idx_inventory_summary_neon_lookup ON inventory_summary_neon(product_id, branch_id, variation_id);

-- 7. Neon-optimized refresh function
CREATE OR REPLACE FUNCTION refresh_inventory_summary_neon()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY inventory_summary_neon;
END;
$$ LANGUAGE plpgsql;

-- 8. Show optimization results
SELECT 
    'Neon Performance Optimization' as category,
    'Indexes Created' as item,
    COUNT(*) as count
FROM pg_indexes 
WHERE schemaname = 'public' 
AND indexname LIKE 'idx_%'
AND indexname IN (
    'idx_sales_branch_id',
    'idx_sales_created_at',
    'idx_sale_items_sale_id',
    'idx_sale_items_product_id',
    'idx_inventory_product_branch_variation',
    'idx_inventory_branch_product',
    'idx_products_category_active',
    'idx_products_name_active',
    'idx_product_variations_product_id'
);

-- 9. Neon-specific recommendations
SELECT 
    'Neon Optimization Tips' as category,
    '1. Use CONCURRENTLY for index creation to avoid blocking' as tip
UNION ALL
SELECT 
    'Neon Optimization Tips',
    '2. Keep materialized views lightweight for serverless architecture'
UNION ALL
SELECT 
    'Neon Optimization Tips',
    '3. Use partial indexes to save storage space'
UNION ALL
SELECT 
    'Neon Optimization Tips',
    '4. Monitor connection pool usage with Neon metrics'
UNION ALL
SELECT 
    'Neon Optimization Tips',
    '5. Refresh materialized views during low-traffic periods';
