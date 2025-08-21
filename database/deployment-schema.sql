-- =====================================================
-- MENAL KIDS SYSTEM - PRODUCTION DATABASE SCHEMA
-- =====================================================
-- This file contains the complete, production-ready database schema
-- with all variations support, constraints, and optimizations included
-- 
-- Deployment Instructions:
-- 1. Ensure PostgreSQL 12+ is installed and running
-- 2. Create database: CREATE DATABASE menal_kids_shop;
-- 3. Run this script: psql -d menal_kids_shop -f deployment-schema.sql
-- 4. Verify with: SELECT 'Database deployed successfully!' as status;
-- =====================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Drop existing tables if they exist (for clean setup)
DROP TABLE IF EXISTS stock_movements CASCADE;
DROP TABLE IF EXISTS transfer_items CASCADE;
DROP TABLE IF EXISTS transfers CASCADE;
DROP TABLE IF EXISTS sale_items CASCADE;
DROP TABLE IF EXISTS sales CASCADE;
DROP TABLE IF EXISTS inventory CASCADE;
DROP TABLE IF EXISTS product_variations CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS expenses CASCADE;
DROP TABLE IF EXISTS budgets CASCADE;
DROP TABLE IF EXISTS alerts CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS branches CASCADE;

-- =====================================================
-- CORE TABLES
-- =====================================================

-- Branches table
CREATE TABLE branches (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    address TEXT,
    phone VARCHAR(20),
    email VARCHAR(255),
    manager_name VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('owner', 'employee')),
    branch_id VARCHAR(50) REFERENCES branches(id),
    phone VARCHAR(20),
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Categories table
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    parent_id UUID REFERENCES categories(id),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Products table
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    sku VARCHAR(100) UNIQUE NOT NULL,
    category_id UUID NOT NULL REFERENCES categories(id),
    description TEXT,
    image_url TEXT,
    barcode VARCHAR(255),
    brand VARCHAR(255),
    age_range VARCHAR(100),
    gender VARCHAR(20) CHECK (gender IN ('boys', 'girls', 'unisex')),
    product_type VARCHAR(20) DEFAULT 'uniform' CHECK (product_type IN ('uniform', 'variation')),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Product variations table
CREATE TABLE product_variations (
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

-- Inventory table with variation support
CREATE TABLE inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id),
    variation_id UUID REFERENCES product_variations(id),
    branch_id VARCHAR(50) NOT NULL REFERENCES branches(id),
    quantity INTEGER NOT NULL DEFAULT 0,
    min_stock_level INTEGER DEFAULT 0,
    max_stock_level INTEGER,
    reorder_point INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    -- Ensure quantities are never negative
    CONSTRAINT chk_inventory_non_negative CHECK (quantity >= 0)
);

-- Sales table
CREATE TABLE sales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id VARCHAR(50) NOT NULL REFERENCES branches(id),
    user_id UUID NOT NULL REFERENCES users(id),
    customer_name VARCHAR(255),
    customer_phone VARCHAR(20),
    customer_email VARCHAR(255),
    total_amount DECIMAL(10,2) NOT NULL,
    payment_method VARCHAR(50) DEFAULT 'cash',
    payment_status VARCHAR(20) DEFAULT 'completed',
    sale_date TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Sale items table with variation support
CREATE TABLE sale_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    variation_id UUID REFERENCES product_variations(id),
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Stock movements table with variation support
CREATE TABLE stock_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id),
    variation_id UUID REFERENCES product_variations(id),
    branch_id VARCHAR(50) NOT NULL REFERENCES branches(id),
    user_id UUID NOT NULL REFERENCES users(id),
    movement_type VARCHAR(20) NOT NULL CHECK (movement_type IN ('in', 'out', 'adjustment', 'transfer')),
    quantity INTEGER NOT NULL,
    reference_type VARCHAR(50),
    reference_id UUID,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Transfers table
CREATE TABLE transfers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    from_branch_id VARCHAR(50) NOT NULL REFERENCES branches(id),
    to_branch_id VARCHAR(50) NOT NULL REFERENCES branches(id),
    user_id UUID NOT NULL REFERENCES users(id),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'in_transit', 'completed', 'cancelled')),
    transfer_date TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Transfer items table with variation support
CREATE TABLE transfer_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transfer_id UUID NOT NULL REFERENCES transfers(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    variation_id UUID REFERENCES product_variations(id),
    quantity INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Budgets table
CREATE TABLE budgets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id VARCHAR(50) NOT NULL REFERENCES branches(id),
    category VARCHAR(100) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Expenses table
CREATE TABLE expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id VARCHAR(50) NOT NULL REFERENCES branches(id),
    category VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    expense_date DATE NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id),
    receipt_url TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Alerts table
CREATE TABLE alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id VARCHAR(50) NOT NULL REFERENCES branches(id),
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    severity VARCHAR(20) DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'error', 'critical')),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'acknowledged', 'resolved')),
    user_id UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- User indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_branch_id ON users(branch_id);
CREATE INDEX idx_users_role ON users(role);

-- Product indexes
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_category_id ON products(category_id);
CREATE INDEX idx_products_is_active ON products(is_active);

-- Product variations indexes
CREATE INDEX idx_product_variations_product_id ON product_variations(product_id);
CREATE INDEX idx_product_variations_sku ON product_variations(sku);

-- Inventory indexes
CREATE INDEX idx_inventory_product_branch ON inventory(product_id, branch_id);
CREATE INDEX idx_inventory_branch_id ON inventory(branch_id);
CREATE INDEX idx_inventory_low_stock ON inventory(quantity, min_stock_level);
CREATE INDEX idx_inventory_variation_id ON inventory(variation_id);

-- Sales indexes
CREATE INDEX idx_sales_branch_id ON sales(branch_id);
CREATE INDEX idx_sales_user_id ON sales(user_id);
CREATE INDEX idx_sales_created_at ON sales(created_at);
CREATE INDEX idx_sales_payment_method ON sales(payment_method);

-- Sale items indexes
CREATE INDEX idx_sale_items_sale_id ON sale_items(sale_id);
CREATE INDEX idx_sale_items_product_id ON sale_items(product_id);
CREATE INDEX idx_sale_items_variation_id ON sale_items(variation_id);

-- Stock movements indexes
CREATE INDEX idx_stock_movements_product_id ON stock_movements(product_id);
CREATE INDEX idx_stock_movements_branch_id ON stock_movements(branch_id);
CREATE INDEX idx_stock_movements_created_at ON stock_movements(created_at);
CREATE INDEX idx_stock_movements_type ON stock_movements(movement_type);
CREATE INDEX idx_stock_movements_variation_id ON stock_movements(variation_id);

-- Transfer indexes
CREATE INDEX idx_transfers_from_branch ON transfers(from_branch_id);
CREATE INDEX idx_transfers_to_branch ON transfers(to_branch_id);
CREATE INDEX idx_transfers_status ON transfers(status);
CREATE INDEX idx_transfers_created_at ON transfers(created_at);

-- Transfer items indexes
CREATE INDEX idx_transfer_items_transfer_id ON transfer_items(transfer_id);
CREATE INDEX idx_transfer_items_product_id ON transfer_items(product_id);
CREATE INDEX idx_transfer_items_variation_id ON transfer_items(variation_id);

-- Budget indexes
CREATE INDEX idx_budgets_branch_id ON budgets(branch_id);
CREATE INDEX idx_budgets_category ON budgets(category);
CREATE INDEX idx_budgets_period ON budgets(period_start, period_end);

-- Expense indexes
CREATE INDEX idx_expenses_branch_id ON expenses(branch_id);
CREATE INDEX idx_expenses_category ON expenses(category);
CREATE INDEX idx_expenses_date ON expenses(expense_date);

-- Alert indexes
CREATE INDEX idx_alerts_branch_id ON alerts(branch_id);
CREATE INDEX idx_alerts_type ON alerts(type);
CREATE INDEX idx_alerts_severity ON alerts(severity);
CREATE INDEX idx_alerts_status ON alerts(status);
CREATE INDEX idx_alerts_created_at ON alerts(created_at);

-- =====================================================
-- UNIQUENESS CONSTRAINTS
-- =====================================================

-- Inventory uniqueness: prevent duplicate rows per product-branch for uniform products
CREATE UNIQUE INDEX uniq_inventory_uniform
  ON inventory(product_id, branch_id)
  WHERE variation_id IS NULL;

-- Inventory uniqueness: prevent duplicate rows per product-branch-variation for variations
CREATE UNIQUE INDEX uniq_inventory_variation
  ON inventory(product_id, branch_id, variation_id)
  WHERE variation_id IS NOT NULL;

-- =====================================================
-- TRIGGERS FOR AUTOMATIC TIMESTAMPS
-- =====================================================

-- Function to update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for all tables
CREATE TRIGGER update_branches_updated_at BEFORE UPDATE ON branches FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON categories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_product_variations_updated_at BEFORE UPDATE ON product_variations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_inventory_updated_at BEFORE UPDATE ON inventory FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_sales_updated_at BEFORE UPDATE ON sales FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_sale_items_updated_at BEFORE UPDATE ON sale_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_stock_movements_updated_at BEFORE UPDATE ON stock_movements FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_transfers_updated_at BEFORE UPDATE ON transfers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_transfer_items_updated_at BEFORE UPDATE ON transfer_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_budgets_updated_at BEFORE UPDATE ON budgets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_expenses_updated_at BEFORE UPDATE ON expenses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_alerts_updated_at BEFORE UPDATE ON alerts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- VIEWS FOR REPORTING
-- =====================================================

-- Inventory status view
CREATE VIEW v_inventory_status AS
SELECT 
    i.id,
    p.name as product_name,
    p.sku as product_sku,
    p.product_type,
    pv.color,
    pv.size,
    pv.price,
    b.name as branch_name,
    i.quantity,
    i.min_stock_level,
    i.max_stock_level,
    i.reorder_point,
    CASE 
        WHEN i.quantity <= i.min_stock_level THEN 'low_stock'
        WHEN i.quantity = 0 THEN 'out_of_stock'
        ELSE 'in_stock'
    END as stock_status,
    i.created_at,
    i.updated_at
FROM inventory i
JOIN products p ON i.product_id = p.id
LEFT JOIN product_variations pv ON i.variation_id = pv.id
JOIN branches b ON i.branch_id = b.id
WHERE p.is_active = TRUE;

-- Sales summary view
CREATE VIEW v_sales_summary AS
SELECT 
    s.id,
    s.branch_id,
    b.name as branch_name,
    s.user_id,
    u.full_name as user_name,
    s.customer_name,
    s.total_amount,
    s.payment_method,
    s.payment_status,
    s.sale_date,
    COUNT(si.id) as total_items,
    s.created_at
FROM sales s
JOIN branches b ON s.branch_id = b.id
JOIN users u ON s.user_id = u.id
LEFT JOIN sale_items si ON s.id = si.sale_id
GROUP BY s.id, s.branch_id, b.name, s.user_id, u.full_name, s.customer_name, s.total_amount, s.payment_method, s.payment_status, s.sale_date, s.created_at;

-- Transfer summary view
CREATE VIEW v_transfer_summary AS
SELECT 
    t.id,
    t.from_branch_id,
    fb.name as from_branch_name,
    t.to_branch_id,
    tb.name as to_branch_name,
    t.user_id,
    u.full_name as user_name,
    t.status,
    t.transfer_date,
    COUNT(ti.id) as total_items,
    t.created_at
FROM transfers t
JOIN branches fb ON t.from_branch_id = fb.id
JOIN branches tb ON t.to_branch_id = tb.id
JOIN users u ON t.user_id = u.id
LEFT JOIN transfer_items ti ON t.id = ti.transfer_id
GROUP BY t.id, t.from_branch_id, fb.name, t.to_branch_id, tb.name, t.user_id, u.full_name, t.status, t.transfer_date, t.created_at;

-- =====================================================
-- MATERIALIZED VIEW FOR DASHBOARD STATS
-- =====================================================

CREATE MATERIALIZED VIEW mv_dashboard_stats AS
SELECT 
    b.id as branch_id,
    b.name as branch_name,
    COUNT(DISTINCT p.id) as total_products,
    COUNT(DISTINCT pv.id) as total_variations,
    COUNT(DISTINCT i.id) as total_inventory_items,
    SUM(i.quantity) as total_stock_quantity,
    COUNT(DISTINCT CASE WHEN i.quantity <= i.min_stock_level THEN i.id END) as low_stock_items,
    COUNT(DISTINCT CASE WHEN i.quantity = 0 THEN i.id END) as out_of_stock_items,
    COUNT(DISTINCT s.id) as total_sales,
    SUM(s.total_amount) as total_sales_amount,
    COUNT(DISTINCT t.id) as total_transfers,
    NOW() as last_updated
FROM branches b
LEFT JOIN inventory i ON b.id = i.branch_id
LEFT JOIN products p ON i.product_id = p.id
LEFT JOIN product_variations pv ON i.variation_id = pv.id
LEFT JOIN sales s ON b.id = s.branch_id
LEFT JOIN transfers t ON b.id = t.from_branch_id OR b.id = t.to_branch_id
WHERE b.is_active = TRUE
GROUP BY b.id, b.name;

-- Create index on materialized view
CREATE INDEX idx_mv_dashboard_stats_branch_id ON mv_dashboard_stats(branch_id);

-- =====================================================
-- COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE branches IS 'Store branches/locations';
COMMENT ON TABLE users IS 'System users with roles and permissions';
COMMENT ON TABLE categories IS 'Product categories with hierarchical support';
COMMENT ON TABLE products IS 'Products with support for uniform and variation types';
COMMENT ON TABLE product_variations IS 'Product variations (color, size, price) for variation products';
COMMENT ON TABLE inventory IS 'Stock levels per product/variation per branch';
COMMENT ON TABLE sales IS 'Sales transactions';
COMMENT ON TABLE sale_items IS 'Individual items in sales with variation support';
COMMENT ON TABLE stock_movements IS 'Stock movement tracking with variation support';
COMMENT ON TABLE transfers IS 'Inter-branch product transfers';
COMMENT ON TABLE transfer_items IS 'Individual items in transfers with variation support';
COMMENT ON TABLE budgets IS 'Budget allocation per branch and category';
COMMENT ON TABLE expenses IS 'Expense tracking per branch';
COMMENT ON TABLE alerts IS 'System alerts and notifications';

COMMENT ON COLUMN sale_items.variation_id IS 'Reference to product variation. NULL for uniform products';
COMMENT ON COLUMN transfer_items.variation_id IS 'Reference to product variation. NULL for uniform products';
COMMENT ON COLUMN stock_movements.variation_id IS 'Reference to product variation. NULL for uniform products';
COMMENT ON COLUMN inventory.variation_id IS 'Reference to product variation. NULL for uniform products';

-- =====================================================
-- DEPLOYMENT VERIFICATION
-- =====================================================

-- Verify the database structure
SELECT 'Database deployed successfully!' as status;

-- Show table count
SELECT COUNT(*) as total_tables FROM information_schema.tables 
WHERE table_schema = 'public' AND table_type = 'BASE TABLE';

-- Show view count
SELECT COUNT(*) as total_views FROM information_schema.views 
WHERE table_schema = 'public';

-- Show index count
SELECT COUNT(*) as total_indexes FROM pg_indexes 
WHERE schemaname = 'public';
