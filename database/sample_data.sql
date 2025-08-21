-- Menal Kids Shop - Fresh Clean Setup
-- Only real user assignments - no categories, no sample data

-- Clear existing data (if any)
DELETE FROM stock_movements;
DELETE FROM transfer_items;
DELETE FROM transfers;
DELETE FROM sale_items;
DELETE FROM sales;
DELETE FROM inventory;
DELETE FROM products;
DELETE FROM categories;
DELETE FROM expenses;
DELETE FROM budgets;
DELETE FROM alerts;
DELETE FROM users;
DELETE FROM branches;

-- Insert branches
INSERT INTO branches (id, name, address, phone, email, manager_name, is_active) VALUES
('branch1', 'Franko (Main)', 'Franko Mall, Level 2, Shop 15', '+251-911-123456', 'franko@menalkids.com', 'Sarah Johnson', TRUE),
('branch2', 'Mebrathayl', 'Mebrathayl Shopping Center, Ground Floor', '+251-911-789012', 'mebrathayl@menalkids.com', 'Michael Chen', TRUE);

-- Insert real users with proper assignments
INSERT INTO users (id, email, password_hash, full_name, role, branch_id, phone, is_active) VALUES
(uuid_generate_v4(), 'owner@menalkids.com', crypt('owner123', gen_salt('bf')), 'Menal Ahmed', 'owner', NULL, '+251-911-000001', TRUE),
(uuid_generate_v4(), 'sarah@menalkids.com', crypt('employee123', gen_salt('bf')), 'Sarah Johnson', 'employee', 'branch1', '+251-911-000002', TRUE),
(uuid_generate_v4(), 'michael@menalkids.com', crypt('employee123', gen_salt('bf')), 'Michael Chen', 'employee', 'branch2', '+251-911-000003', TRUE);

-- ============================================================================
-- DISPLAY SUMMARY
-- ============================================================================

-- Display summary of inserted data
SELECT 'Menal Kids Shop - Fresh clean setup completed!' as status;
SELECT 'Branches: ' || COUNT(*) as summary FROM branches;
SELECT 'Users: ' || COUNT(*) as summary FROM users;
SELECT 'Categories: ' || COUNT(*) as summary FROM categories;

-- Show user assignments
SELECT 
    u.full_name,
    u.email,
    u.role,
    CASE 
        WHEN u.role = 'owner' THEN 'All branches'
        ELSE b.name
    END as branch_assignment
FROM users u
LEFT JOIN branches b ON u.branch_id = b.id
ORDER BY u.role DESC, u.full_name;

-- Show branch information
SELECT 
    b.name as branch_name,
    b.manager_name,
    b.address,
    b.phone,
    b.email
FROM branches b
ORDER BY b.name;
