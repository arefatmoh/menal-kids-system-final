-- Fix Dashboard Stats Function for Branch-Specific Product Counting
-- This script updates the get_dashboard_stats function to properly count products by branch

-- Drop and recreate the function with proper branch-specific logic
CREATE OR REPLACE FUNCTION get_dashboard_stats(p_branch_id VARCHAR(50) DEFAULT NULL)
RETURNS TABLE (
    total_products BIGINT,
    low_stock_alerts BIGINT,
    out_of_stock_alerts BIGINT,
    stock_in_today BIGINT,
    stock_out_today BIGINT,
    total_sales_today NUMERIC,
    transactions_today BIGINT,
    active_alerts BIGINT,
    critical_alerts BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        -- Count active products available in branch inventory
        -- For specific branch: count products that have inventory in that branch
        -- For all branches: count total unique products across all branches
        (
          SELECT COUNT(DISTINCT p.id)::BIGINT
          FROM products p
          JOIN inventory i ON i.product_id = p.id
          WHERE p.is_active = TRUE
            AND (p_branch_id IS NULL OR i.branch_id = p_branch_id)
        ) AS total_products,

        -- Low stock alerts from inventory
        (
          SELECT COUNT(DISTINCT i2.id)::BIGINT
          FROM inventory i2
          WHERE i2.min_stock_level IS NOT NULL
            AND i2.quantity <= i2.min_stock_level
            AND i2.quantity > 0
            AND (p_branch_id IS NULL OR i2.branch_id = p_branch_id)
        ) AS low_stock_alerts,

        -- Out of stock alerts from inventory
        (
          SELECT COUNT(DISTINCT i3.id)::BIGINT
          FROM inventory i3
          WHERE i3.quantity = 0
            AND (p_branch_id IS NULL OR i3.branch_id = p_branch_id)
        ) AS out_of_stock_alerts,

        -- Stock in today (sum of stock movements)
        (
          SELECT COALESCE(SUM(sm_in.quantity), 0)::BIGINT
          FROM stock_movements sm_in
          WHERE sm_in.movement_type = 'in'
            AND DATE(sm_in.created_at) = CURRENT_DATE
            AND (p_branch_id IS NULL OR sm_in.branch_id = p_branch_id)
        ) AS stock_in_today,

        -- Stock out today (sum of stock movements)
        (
          SELECT COALESCE(SUM(sm_out.quantity), 0)::BIGINT
          FROM stock_movements sm_out
          WHERE sm_out.movement_type = 'out'
            AND DATE(sm_out.created_at) = CURRENT_DATE
            AND (p_branch_id IS NULL OR sm_out.branch_id = p_branch_id)
        ) AS stock_out_today,

        -- Total sales amount today
        (
          SELECT COALESCE(SUM(s.total_amount), 0)
          FROM sales s
          WHERE DATE(s.created_at) = CURRENT_DATE
            AND (p_branch_id IS NULL OR s.branch_id = p_branch_id)
        ) AS total_sales_today,

        -- Number of sales transactions today
        (
          SELECT COUNT(s2.id)::BIGINT
          FROM sales s2
          WHERE DATE(s2.created_at) = CURRENT_DATE
            AND (p_branch_id IS NULL OR s2.branch_id = p_branch_id)
        ) AS transactions_today,

        -- Active alerts (including global alerts where branch_id is NULL)
        (
          SELECT COUNT(a.id)::BIGINT
          FROM alerts a
          WHERE a.status = 'active'
            AND (p_branch_id IS NULL OR a.branch_id = p_branch_id OR a.branch_id IS NULL)
        ) AS active_alerts,

        -- Critical alerts (including global alerts where branch_id is NULL)
        (
          SELECT COUNT(a2.id)::BIGINT
          FROM alerts a2
          WHERE a2.status = 'active'
            AND a2.severity = 'critical'
            AND (p_branch_id IS NULL OR a2.branch_id = p_branch_id OR a2.branch_id IS NULL)
        ) AS critical_alerts;
END;
$$ LANGUAGE plpgsql;

-- Test the function
SELECT 'Testing get_dashboard_stats function...' as test_status;

-- Test for branch1 (Franko)
SELECT 'Branch1 (Franko) stats:' as branch_test;
SELECT * FROM get_dashboard_stats('branch1');

-- Test for branch2 (Mebrathayl)
SELECT 'Branch2 (Mebrathayl) stats:' as branch_test;
SELECT * FROM get_dashboard_stats('branch2');

-- Test for all branches
SELECT 'All branches stats:' as branch_test;
SELECT * FROM get_dashboard_stats(NULL);

SELECT 'Dashboard stats function updated successfully!' as completion_status;
