-- Database Performance Optimization Script
-- This script optimizes database performance without changing application code

-- 1. Optimize connection pool settings
-- These settings will be applied when the application connects
-- (Note: These are recommendations for your database configuration)

-- 2. Create missing indexes for better query performance
-- Sales-related indexes
CREATE INDEX IF NOT EXISTS idx_sales_branch_id ON sales(branch_id);
CREATE INDEX IF NOT EXISTS idx_sales_user_id ON sales(user_id);
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at);
CREATE INDEX IF NOT EXISTS idx_sales_branch_created ON sales(branch_id, created_at);

-- Sale items indexes
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product_id ON sale_items(product_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_variation_id ON sale_items(variation_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product_variation ON sale_items(product_id, variation_id);

-- Inventory indexes for faster stock lookups
CREATE INDEX IF NOT EXISTS idx_inventory_product_branch_variation ON inventory(product_id, branch_id, variation_id);
CREATE INDEX IF NOT EXISTS idx_inventory_branch_product ON inventory(branch_id, product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_quantity ON inventory(quantity);
CREATE INDEX IF NOT EXISTS idx_inventory_updated_at ON inventory(updated_at);

-- Stock movements indexes
CREATE INDEX IF NOT EXISTS idx_stock_movements_product_branch ON stock_movements(product_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created_at ON stock_movements(created_at);
CREATE INDEX IF NOT EXISTS idx_stock_movements_reference ON stock_movements(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_variation_id ON stock_movements(variation_id);

-- Products indexes
CREATE INDEX IF NOT EXISTS idx_products_category_active ON products(category_id, is_active);
CREATE INDEX IF NOT EXISTS idx_products_name_active ON products(name, is_active);
CREATE INDEX IF NOT EXISTS idx_products_sku_active ON products(sku, is_active);
CREATE INDEX IF NOT EXISTS idx_products_brand_active ON products(brand, is_active);

-- Product variations indexes
CREATE INDEX IF NOT EXISTS idx_product_variations_product_id ON product_variations(product_id);
CREATE INDEX IF NOT EXISTS idx_product_variations_sku ON product_variations(sku);
CREATE INDEX IF NOT EXISTS idx_product_variations_color_size ON product_variations(color, size);
CREATE INDEX IF NOT EXISTS idx_product_variations_active ON product_variations(is_active);

-- Categories indexes
CREATE INDEX IF NOT EXISTS idx_categories_parent_active ON categories(parent_id, is_active);
CREATE INDEX IF NOT EXISTS idx_categories_name_active ON categories(name, is_active);

-- Users indexes
CREATE INDEX IF NOT EXISTS idx_users_branch_role ON users(branch_id, role);
CREATE INDEX IF NOT EXISTS idx_users_email_active ON users(email, is_active);

-- Alerts indexes
CREATE INDEX IF NOT EXISTS idx_alerts_type_status ON alerts(type, status);
CREATE INDEX IF NOT EXISTS idx_alerts_branch_status ON alerts(branch_id, status);
CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON alerts(created_at);

-- 3. Create composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_inventory_lookup ON inventory(product_id, branch_id, variation_id, quantity);
CREATE INDEX IF NOT EXISTS idx_sales_summary ON sales(branch_id, created_at, total_amount);
CREATE INDEX IF NOT EXISTS idx_products_search ON products(name, sku, brand, is_active);

-- 4. Create partial indexes for better performance
-- Only index active products
CREATE INDEX IF NOT EXISTS idx_products_active_only ON products(name, sku, brand) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_product_variations_active_only ON product_variations(product_id, color, size) WHERE is_active = true;

-- Only index active inventory with stock
CREATE INDEX IF NOT EXISTS idx_inventory_with_stock ON inventory(product_id, branch_id, variation_id) WHERE quantity > 0;

-- 5. Create covering indexes for frequently accessed data
CREATE INDEX IF NOT EXISTS idx_inventory_covering ON inventory(product_id, branch_id, variation_id, quantity, min_stock_level, max_stock_level);
CREATE INDEX IF NOT EXISTS idx_products_covering ON products(id, name, sku, category_id, brand, is_active, product_type);

-- 6. Optimize table statistics
-- Update table statistics for better query planning
ANALYZE sales;
ANALYZE sale_items;
ANALYZE inventory;
ANALYZE stock_movements;
ANALYZE products;
ANALYZE product_variations;
ANALYZE categories;
ANALYZE users;
ANALYZE branches;
ANALYZE alerts;

-- 7. Create materialized view for inventory summary (if needed for reports)
-- This can be refreshed periodically for better performance
CREATE MATERIALIZED VIEW IF NOT EXISTS inventory_summary AS
SELECT 
    i.product_id,
    i.branch_id,
    i.variation_id,
    p.name as product_name,
    p.sku as product_sku,
    pv.color,
    pv.size,
    pv.sku as variation_sku,
    b.name as branch_name,
    c.name as category_name,
    SUM(i.quantity) as total_quantity,
    MIN(i.min_stock_level) as min_stock_level,
    MAX(i.max_stock_level) as max_stock_level,
    COUNT(*) as inventory_records
FROM inventory i
JOIN products p ON i.product_id = p.id
JOIN branches b ON i.branch_id = b.id
JOIN categories c ON p.category_id = c.id
LEFT JOIN product_variations pv ON i.variation_id = pv.id
WHERE p.is_active = true
GROUP BY i.product_id, i.branch_id, i.variation_id, p.name, p.sku, pv.color, pv.size, pv.sku, b.name, c.name;

-- Create index on materialized view
CREATE INDEX IF NOT EXISTS idx_inventory_summary_lookup ON inventory_summary(product_id, branch_id, variation_id);

-- 8. Create function to refresh materialized view
CREATE OR REPLACE FUNCTION refresh_inventory_summary()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY inventory_summary;
END;
$$ LANGUAGE plpgsql;

-- 9. Show optimization results
SELECT 
    'Performance Optimization' as category,
    'Indexes Created' as item,
    COUNT(*) as count
FROM pg_indexes 
WHERE schemaname = 'public' 
AND indexname LIKE 'idx_%'
AND indexname IN (
    'idx_sales_branch_id',
    'idx_sales_user_id', 
    'idx_sales_created_at',
    'idx_sale_items_sale_id',
    'idx_sale_items_product_id',
    'idx_inventory_product_branch_variation',
    'idx_inventory_branch_product',
    'idx_products_category_active',
    'idx_products_name_active',
    'idx_product_variations_product_id'
);

-- 10. Show current database size and performance stats
SELECT 
    'Database Stats' as category,
    schemaname as schema_name,
    tablename as table_name,
    attname as column_name,
    n_distinct as distinct_values,
    correlation as correlation
FROM pg_stats 
WHERE schemaname = 'public' 
AND tablename IN ('sales', 'sale_items', 'inventory', 'products', 'product_variations')
ORDER BY tablename, attname;
