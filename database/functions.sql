-- Menal Kids Shop Database Functions
-- Utility functions for business logic and reporting

-- Function to get dashboard statistics for a specific branch or all branches
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

-- Function to get recent activities for dashboard
CREATE OR REPLACE FUNCTION get_recent_activities(p_branch_id VARCHAR(50) DEFAULT NULL, p_limit INTEGER DEFAULT 10)
RETURNS TABLE (
    activity_type VARCHAR,
    description TEXT,
    branch_name VARCHAR,
    user_name VARCHAR,
    created_at TIMESTAMP,
    reference_id UUID
) AS $$
BEGIN
    RETURN QUERY
    (
        -- Sales activities
        SELECT 
            'sale'::VARCHAR as activity_type,
            ('Sale of ' || COALESCE(SUM(si.quantity), 0) || ' items for $' || s.total_amount)::TEXT as description,
            b.name as branch_name,
            u.full_name as user_name,
            s.created_at,
            s.id as reference_id
        FROM sales s
        JOIN branches b ON s.branch_id = b.id
        JOIN users u ON s.user_id = u.id
        LEFT JOIN sale_items si ON s.id = si.sale_id
        WHERE (p_branch_id IS NULL OR s.branch_id = p_branch_id)
        GROUP BY s.id, b.name, u.full_name, s.total_amount, s.created_at
        
        UNION ALL
        
        -- Stock movements activities (deduplicated)
        SELECT DISTINCT ON (sm.product_id, sm.branch_id, sm.movement_type, sm.quantity, DATE(sm.created_at))
            ('stock_' || sm.movement_type)::VARCHAR as activity_type,
            (CASE 
                WHEN sm.movement_type = 'in' THEN 'Stock added: '
                ELSE 'Stock removed: '
            END || sm.quantity || ' units of ' || p.name)::TEXT as description,
            b.name as branch_name,
            u.full_name as user_name,
            sm.created_at,
            sm.id as reference_id
        FROM stock_movements sm
        JOIN products p ON sm.product_id = p.id
        JOIN branches b ON sm.branch_id = b.id
        JOIN users u ON sm.user_id = u.id
        WHERE (p_branch_id IS NULL OR sm.branch_id = p_branch_id)
            AND sm.reference_type != 'sale' -- Exclude sales-related movements to avoid duplicates
        
        UNION ALL
        
        -- Transfer activities
        SELECT 
            ('transfer_' || t.status)::VARCHAR as activity_type,
            ('Transfer ' || t.status || ' from ' || fb.name || ' to ' || tb.name)::TEXT as description,
            CASE 
                WHEN p_branch_id = t.from_branch_id THEN fb.name
                ELSE tb.name
            END as branch_name,
            u.full_name as user_name,
            COALESCE(t.completed_at, t.approved_at, t.requested_at) as created_at,
            t.id as reference_id
        FROM transfers t
        JOIN branches fb ON t.from_branch_id = fb.id
        JOIN branches tb ON t.to_branch_id = tb.id
        JOIN users u ON t.requested_by = u.id
        WHERE (p_branch_id IS NULL OR t.from_branch_id = p_branch_id OR t.to_branch_id = p_branch_id)
    )
    ORDER BY created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate stock trend over time
CREATE OR REPLACE FUNCTION get_stock_trend(p_days INTEGER DEFAULT 7, p_branch_id VARCHAR(50) DEFAULT NULL)
RETURNS TABLE (
    date DATE,
    stock_in BIGINT,
    stock_out BIGINT,
    net_movement BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        DATE(sm.created_at) as date,
        COALESCE(SUM(sm.quantity) FILTER (WHERE sm.movement_type = 'in'), 0)::BIGINT as stock_in,
        COALESCE(SUM(sm.quantity) FILTER (WHERE sm.movement_type = 'out'), 0)::BIGINT as stock_out,
        (COALESCE(SUM(sm.quantity) FILTER (WHERE sm.movement_type = 'in'), 0) - 
         COALESCE(SUM(sm.quantity) FILTER (WHERE sm.movement_type = 'out'), 0))::BIGINT as net_movement
    FROM stock_movements sm
    WHERE sm.created_at >= CURRENT_DATE - INTERVAL '1 day' * p_days
        AND (p_branch_id IS NULL OR sm.branch_id = p_branch_id)
    GROUP BY DATE(sm.created_at)
    ORDER BY DATE(sm.created_at);
END;
$$ LANGUAGE plpgsql;

-- Function to check and create low stock alerts
CREATE OR REPLACE FUNCTION check_low_stock_alerts()
RETURNS INTEGER AS $$
DECLARE
    alert_count INTEGER := 0;
    rec RECORD;
BEGIN
    -- Loop through all low stock items
    FOR rec IN 
        SELECT 
            i.product_id,
            i.branch_id,
            i.quantity,
            i.min_stock_level,
            p.name as product_name,
            b.name as branch_name
        FROM inventory i
        JOIN products p ON i.product_id = p.id
        JOIN branches b ON i.branch_id = b.id
        WHERE i.min_stock_level IS NOT NULL 
            AND i.quantity <= i.min_stock_level 
            AND p.is_active = TRUE
            AND b.is_active = TRUE
    LOOP
        -- Check if alert already exists
        IF NOT EXISTS (
            SELECT 1 FROM alerts 
            WHERE type = 'inventory' 
                AND branch_id = rec.branch_id
                AND category = rec.product_id::TEXT
                AND status = 'active'
        ) THEN
            -- Create new alert
            INSERT INTO alerts (
                type, severity, title, message, branch_id, category,
                threshold_value, current_value, action_required
            ) VALUES (
                'inventory',
                CASE 
                    WHEN rec.quantity = 0 THEN 'critical'
                    WHEN rec.quantity <= rec.min_stock_level * 0.5 THEN 'high'
                    ELSE 'medium'
                END,
                CASE 
                    WHEN rec.quantity = 0 THEN 'Out of Stock'
                    ELSE 'Low Stock Alert'
                END,
                rec.product_name || ' is ' || 
                CASE 
                    WHEN rec.quantity = 0 THEN 'out of stock'
                    ELSE 'running low (' || rec.quantity || ' remaining)'
                END || ' at ' || rec.branch_name,
                rec.branch_id,
                rec.product_id::TEXT,
                rec.min_stock_level,
                rec.quantity,
                TRUE
            );
            
            alert_count := alert_count + 1;
        END IF;
    END LOOP;
    
    RETURN alert_count;
END;
$$ LANGUAGE plpgsql;

-- Function to check budget overruns
CREATE OR REPLACE FUNCTION check_budget_alerts()
RETURNS INTEGER AS $$
DECLARE
    alert_count INTEGER := 0;
    rec RECORD;
    spent_amount DECIMAL(12,2);
    percentage_used DECIMAL(5,2);
BEGIN
    -- Loop through all active budgets
    FOR rec IN 
        SELECT 
            b.id,
            b.branch_id,
            b.category,
            b.budget_amount,
            b.period_start,
            b.period_end,
            br.name as branch_name
        FROM budgets b
        LEFT JOIN branches br ON b.branch_id = br.id
        WHERE b.period_start <= CURRENT_DATE 
            AND b.period_end >= CURRENT_DATE
    LOOP
        -- Calculate spent amount for this budget
        SELECT COALESCE(SUM(amount), 0) INTO spent_amount
        FROM expenses e
        WHERE e.category = rec.category
            AND (rec.branch_id IS NULL OR e.branch_id = rec.branch_id)
            AND e.expense_date BETWEEN rec.period_start AND rec.period_end;
        
        -- Calculate percentage used
        percentage_used := (spent_amount / rec.budget_amount * 100);
        
        -- Check if we need to create an alert
        IF percentage_used >= 80 THEN
            -- Check if alert already exists
            IF NOT EXISTS (
                SELECT 1 FROM alerts 
                WHERE type = 'budget' 
                    AND (branch_id = rec.branch_id OR (branch_id IS NULL AND rec.branch_id IS NULL))
                    AND category = rec.category
                    AND status = 'active'
            ) THEN
                -- Create new alert
                INSERT INTO alerts (
                    type, severity, title, message, branch_id, category,
                    threshold_value, current_value, action_required
                ) VALUES (
                    'budget',
                    CASE 
                        WHEN percentage_used >= 100 THEN 'critical'
                        WHEN percentage_used >= 90 THEN 'high'
                        ELSE 'medium'
                    END,
                    CASE 
                        WHEN percentage_used >= 100 THEN 'Budget Exceeded'
                        ELSE 'Budget Alert'
                    END,
                    rec.category || ' budget is ' || ROUND(percentage_used, 1) || '% used' ||
                    CASE 
                        WHEN rec.branch_name IS NOT NULL THEN ' at ' || rec.branch_name
                        ELSE ' (company-wide)'
                    END ||
                    ' ($' || spent_amount || ' of $' || rec.budget_amount || ')',
                    rec.branch_id,
                    rec.category,
                    rec.budget_amount,
                    spent_amount,
                    percentage_used >= 90
                );
                
                alert_count := alert_count + 1;
            END IF;
        END IF;
    END LOOP;
    
    RETURN alert_count;
END;
$$ LANGUAGE plpgsql;

-- Function to check performance alerts
CREATE OR REPLACE FUNCTION check_performance_alerts()
RETURNS INTEGER AS $$
DECLARE
    alert_count INTEGER := 0;
    rec RECORD;
    avg_daily_sales DECIMAL(10,2);
    recent_sales DECIMAL(10,2);
    performance_drop DECIMAL(5,2);
BEGIN
    -- Check each branch performance
    FOR rec IN 
        SELECT id, name FROM branches WHERE is_active = TRUE
    LOOP
        -- Calculate average daily sales for the past 30 days (excluding last 7 days)
        SELECT COALESCE(AVG(daily_sales), 0) INTO avg_daily_sales
        FROM (
            SELECT DATE(created_at) as sale_date, SUM(total_amount) as daily_sales
            FROM sales 
            WHERE branch_id = rec.id
                AND created_at >= CURRENT_DATE - INTERVAL '30 days'
                AND created_at < CURRENT_DATE - INTERVAL '7 days'
            GROUP BY DATE(created_at)
        ) daily_totals;
        
        -- Calculate recent sales (last 7 days average)
        SELECT COALESCE(AVG(daily_sales), 0) INTO recent_sales
        FROM (
            SELECT DATE(created_at) as sale_date, SUM(total_amount) as daily_sales
            FROM sales 
            WHERE branch_id = rec.id
                AND created_at >= CURRENT_DATE - INTERVAL '7 days'
            GROUP BY DATE(created_at)
        ) recent_totals;
        
        -- Calculate performance drop percentage
        IF avg_daily_sales > 0 THEN
            performance_drop := ((avg_daily_sales - recent_sales) / avg_daily_sales * 100);
            
            -- Create alert if performance dropped significantly
            IF performance_drop >= 20 THEN
                -- Check if alert already exists
                IF NOT EXISTS (
                    SELECT 1 FROM alerts 
                    WHERE type = 'performance' 
                        AND branch_id = rec.id
                        AND category = 'sales_performance'
                        AND status = 'active'
                ) THEN
                    INSERT INTO alerts (
                        type, severity, title, message, branch_id, category,
                        threshold_value, current_value, action_required
                    ) VALUES (
                        'performance',
                        CASE 
                            WHEN performance_drop >= 40 THEN 'critical'
                            WHEN performance_drop >= 30 THEN 'high'
                            ELSE 'medium'
                        END,
                        'Sales Performance Drop',
                        rec.name || ' sales have dropped by ' || ROUND(performance_drop, 1) || 
                        '% compared to the previous period (from $' || ROUND(avg_daily_sales, 2) || 
                        ' to $' || ROUND(recent_sales, 2) || ' daily average)',
                        rec.id,
                        'sales_performance',
                        avg_daily_sales,
                        recent_sales,
                        performance_drop >= 30
                    );
                    
                    alert_count := alert_count + 1;
                END IF;
            END IF;
        END IF;
    END LOOP;
    
    RETURN alert_count;
END;
$$ LANGUAGE plpgsql;

-- Function to run all alert checks
CREATE OR REPLACE FUNCTION run_alert_checks()
RETURNS TABLE (
    check_type VARCHAR,
    alerts_created INTEGER
) AS $$
DECLARE
    low_stock_alerts INTEGER;
    budget_alerts INTEGER;
    performance_alerts INTEGER;
BEGIN
    -- Run all alert checks
    SELECT check_low_stock_alerts() INTO low_stock_alerts;
    SELECT check_budget_alerts() INTO budget_alerts;
    SELECT check_performance_alerts() INTO performance_alerts;
    
    -- Return results
    RETURN QUERY VALUES 
        ('low_stock'::VARCHAR, low_stock_alerts),
        ('budget'::VARCHAR, budget_alerts),
        ('performance'::VARCHAR, performance_alerts);
END;
$$ LANGUAGE plpgsql;

-- Function to get product sales analytics
CREATE OR REPLACE FUNCTION get_product_analytics(
    p_product_id UUID,
    p_branch_id VARCHAR(50) DEFAULT NULL,
    p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
    total_sold BIGINT,
    total_revenue NUMERIC,
    avg_daily_sales NUMERIC,
    peak_day DATE,
    peak_day_sales BIGINT,
    current_stock INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(SUM(si.quantity), 0)::BIGINT as total_sold,
        COALESCE(SUM(si.total_price), 0) as total_revenue,
        COALESCE(SUM(si.quantity)::NUMERIC / p_days, 0) as avg_daily_sales,
        (SELECT DATE(s2.created_at) 
         FROM sales s2 
         JOIN sale_items si2 ON s2.id = si2.sale_id 
         WHERE si2.product_id = p_product_id
           AND (p_branch_id IS NULL OR s2.branch_id = p_branch_id)
           AND s2.created_at >= CURRENT_DATE - INTERVAL '1 day' * p_days
         GROUP BY DATE(s2.created_at)
         ORDER BY SUM(si2.quantity) DESC
         LIMIT 1) as peak_day,
        (SELECT SUM(si2.quantity)::BIGINT
         FROM sales s2 
         JOIN sale_items si2 ON s2.id = si2.sale_id 
         WHERE si2.product_id = p_product_id
           AND (p_branch_id IS NULL OR s2.branch_id = p_branch_id)
           AND s2.created_at >= CURRENT_DATE - INTERVAL '1 day' * p_days
         GROUP BY DATE(s2.created_at)
         ORDER BY SUM(si2.quantity) DESC
         LIMIT 1) as peak_day_sales,
        COALESCE((SELECT SUM(i.quantity) 
                  FROM inventory i 
                  WHERE i.product_id = p_product_id
                    AND (p_branch_id IS NULL OR i.branch_id = p_branch_id)), 0)::INTEGER as current_stock
    FROM sales s
    JOIN sale_items si ON s.id = si.sale_id
    WHERE si.product_id = p_product_id
        AND (p_branch_id IS NULL OR s.branch_id = p_branch_id)
        AND s.created_at >= CURRENT_DATE - INTERVAL '1 day' * p_days;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate branch profitability
CREATE OR REPLACE FUNCTION get_branch_profitability(
    p_branch_id VARCHAR(50),
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
    branch_name VARCHAR,
    total_revenue NUMERIC,
    total_expenses NUMERIC,
    gross_profit NUMERIC,
    profit_margin NUMERIC,
    transaction_count BIGINT,
    avg_transaction NUMERIC
) AS $$
DECLARE
    start_date DATE := COALESCE(p_start_date, CURRENT_DATE - INTERVAL '30 days');
    end_date DATE := COALESCE(p_end_date, CURRENT_DATE);
BEGIN
    RETURN QUERY
    SELECT 
        b.name as branch_name,
        COALESCE(SUM(s.total_amount), 0) as total_revenue,
        COALESCE(SUM(e.amount), 0) as total_expenses,
        COALESCE(SUM(s.total_amount), 0) - COALESCE(SUM(e.amount), 0) as gross_profit,
        CASE 
            WHEN COALESCE(SUM(s.total_amount), 0) > 0 
            THEN ((COALESCE(SUM(s.total_amount), 0) - COALESCE(SUM(e.amount), 0)) / SUM(s.total_amount) * 100)
            ELSE 0 
        END as profit_margin,
        COUNT(s.id)::BIGINT as transaction_count,
        COALESCE(AVG(s.total_amount), 0) as avg_transaction
    FROM branches b
    LEFT JOIN sales s ON b.id = s.branch_id 
        AND DATE(s.created_at) BETWEEN start_date AND end_date
    LEFT JOIN expenses e ON b.id = e.branch_id 
        AND e.expense_date BETWEEN start_date AND end_date
    WHERE b.id = p_branch_id
    GROUP BY b.id, b.name;
END;
$$ LANGUAGE plpgsql;

-- Create a function to clean up old resolved alerts
CREATE OR REPLACE FUNCTION cleanup_old_alerts(p_days INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM alerts 
    WHERE status IN ('resolved', 'dismissed')
        AND updated_at < CURRENT_DATE - INTERVAL '1 day' * p_days;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to generate SKU for new products
CREATE OR REPLACE FUNCTION generate_sku(p_category_name VARCHAR, p_color VARCHAR DEFAULT NULL, p_size VARCHAR DEFAULT NULL)
RETURNS VARCHAR AS $$
DECLARE
    category_code VARCHAR(3);
    color_code VARCHAR(2);
    size_code VARCHAR(2);
    sequence_num INTEGER;
    new_sku VARCHAR(100);
BEGIN
    -- Generate category code (first 3 letters, uppercase)
    category_code := UPPER(LEFT(REGEXP_REPLACE(p_category_name, '[^A-Za-z]', '', 'g'), 3));
    
    -- Generate color code if provided
    color_code := CASE 
        WHEN p_color IS NOT NULL AND p_color != '' THEN UPPER(LEFT(REGEXP_REPLACE(p_color, '[^A-Za-z]', '', 'g'), 2))
        ELSE ''
    END;
    
    -- Generate size code if provided
    size_code := CASE 
        WHEN p_size IS NOT NULL AND p_size != '' THEN UPPER(LEFT(REGEXP_REPLACE(p_size, '[^A-Za-z0-9]', '', 'g'), 2))
        ELSE ''
    END;
    
    -- Get next sequence number for this category
    SELECT COALESCE(MAX(CAST(RIGHT(sku, 4) AS INTEGER)), 0) + 1 
    INTO sequence_num
    FROM products 
    WHERE sku LIKE category_code || '%';
    
    -- Construct SKU
    new_sku := category_code || color_code || size_code || LPAD(sequence_num::TEXT, 4, '0');
    
    RETURN new_sku;
END;
$$ LANGUAGE plpgsql;

-- Function to get sales data for reports
CREATE OR REPLACE FUNCTION get_sales_data(
    p_branch_id VARCHAR(50) DEFAULT NULL,
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL,
    p_time_range VARCHAR(20) DEFAULT 'daily'
)
RETURNS TABLE (
    period_label VARCHAR,
    branch_id VARCHAR,
    branch_name VARCHAR,
    total_sales NUMERIC,
    transaction_count BIGINT,
    avg_transaction NUMERIC
) AS $$
DECLARE
    start_date DATE := COALESCE(p_start_date, CURRENT_DATE - INTERVAL '30 days');
    end_date DATE := COALESCE(p_end_date, CURRENT_DATE);
BEGIN
    RETURN QUERY
    SELECT 
        (CASE 
            WHEN p_time_range = 'daily' THEN TO_CHAR(DATE(s.created_at), 'Day')
            WHEN p_time_range = 'weekly' THEN 'Week ' || EXTRACT(WEEK FROM s.created_at)::TEXT
            WHEN p_time_range = 'monthly' THEN TO_CHAR(DATE(s.created_at), 'Month')
            ELSE DATE(s.created_at)::TEXT
        END)::VARCHAR as period_label,
        s.branch_id,
        b.name as branch_name,
        SUM(s.total_amount) as total_sales,
        COUNT(s.id)::BIGINT as transaction_count,
        AVG(s.total_amount) as avg_transaction
    FROM sales s
    JOIN branches b ON s.branch_id = b.id
    WHERE DATE(s.created_at) BETWEEN start_date AND end_date
        AND (p_branch_id IS NULL OR s.branch_id = p_branch_id)
    GROUP BY 
        CASE 
            WHEN p_time_range = 'daily' THEN DATE(s.created_at)
            WHEN p_time_range = 'weekly' THEN DATE_TRUNC('week', s.created_at)
            WHEN p_time_range = 'monthly' THEN DATE_TRUNC('month', s.created_at)
            ELSE DATE(s.created_at)
        END,
        s.branch_id,
        b.name,
        CASE 
            WHEN p_time_range = 'daily' THEN TO_CHAR(DATE(s.created_at), 'Day')
            WHEN p_time_range = 'weekly' THEN 'Week ' || EXTRACT(WEEK FROM s.created_at)::TEXT
            WHEN p_time_range = 'monthly' THEN TO_CHAR(DATE(s.created_at), 'Month')
            ELSE DATE(s.created_at)::TEXT
        END
    ORDER BY 
        CASE 
            WHEN p_time_range = 'daily' THEN DATE(s.created_at)
            WHEN p_time_range = 'weekly' THEN DATE_TRUNC('week', s.created_at)
            WHEN p_time_range = 'monthly' THEN DATE_TRUNC('month', s.created_at)
            ELSE DATE(s.created_at)
        END;
END;
$$ LANGUAGE plpgsql;

-- Function to get expense data for reports
CREATE OR REPLACE FUNCTION get_expense_data(
    p_branch_id VARCHAR(50) DEFAULT NULL,
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
    category VARCHAR,
    branch_id VARCHAR,
    branch_name VARCHAR,
    total_amount NUMERIC,
    expense_count BIGINT
) AS $$
DECLARE
    start_date DATE := COALESCE(p_start_date, CURRENT_DATE - INTERVAL '30 days');
    end_date DATE := COALESCE(p_end_date, CURRENT_DATE);
BEGIN
    RETURN QUERY
    SELECT 
        e.category,
        e.branch_id,
        COALESCE(b.name, 'All Branches') as branch_name,
        SUM(e.amount) as total_amount,
        COUNT(e.id)::BIGINT as expense_count
    FROM expenses e
    LEFT JOIN branches b ON e.branch_id = b.id
    WHERE e.expense_date BETWEEN start_date AND end_date
        AND (p_branch_id IS NULL OR e.branch_id = p_branch_id)
    GROUP BY e.category, e.branch_id, b.name
    ORDER BY total_amount DESC;
END;
$$ LANGUAGE plpgsql;
