-- Fix for missing get_sales_data function
-- Run this with: psql $CONN -f fix_reports_function.sql

-- Drop existing functions if they exist
DROP FUNCTION IF EXISTS get_sales_data(TEXT, DATE, DATE, TEXT);
DROP FUNCTION IF EXISTS get_expense_data(DATE, DATE, TEXT);

-- Create the missing get_sales_data function
CREATE OR REPLACE FUNCTION get_sales_data(
    p_branch_id TEXT DEFAULT NULL,
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL,
    p_time_range TEXT DEFAULT 'daily'
)
RETURNS TABLE (
    period_label TEXT,
    branch_id TEXT,
    branch_name TEXT,
    total_sales NUMERIC,
    transaction_count INTEGER,
    avg_transaction NUMERIC
) AS $$
BEGIN
    -- Set default dates if not provided
    IF p_start_date IS NULL THEN
        CASE p_time_range
            WHEN 'daily' THEN p_start_date := CURRENT_DATE - INTERVAL '30 days';
            WHEN 'weekly' THEN p_start_date := CURRENT_DATE - INTERVAL '12 weeks';
            WHEN 'monthly' THEN p_start_date := CURRENT_DATE - INTERVAL '12 months';
            ELSE p_start_date := CURRENT_DATE - INTERVAL '30 days';
        END CASE;
    END IF;
    
    IF p_end_date IS NULL THEN
        p_end_date := CURRENT_DATE;
    END IF;

    RETURN QUERY
    WITH date_ranges AS (
        SELECT generate_series(p_start_date, p_end_date, 
            CASE p_time_range
                WHEN 'daily' THEN INTERVAL '1 day'
                WHEN 'weekly' THEN INTERVAL '1 week'
                WHEN 'monthly' THEN INTERVAL '1 month'
                ELSE INTERVAL '1 day'
            END
        )::DATE as period_date
    ),
    sales_data AS (
        SELECT 
            CASE p_time_range
                WHEN 'daily' THEN TO_CHAR(s.sale_date, 'YYYY-MM-DD')
                WHEN 'weekly' THEN 'Week ' || TO_CHAR(s.sale_date, 'IYYY-IW')
                WHEN 'monthly' THEN TO_CHAR(s.sale_date, 'YYYY-MM')
                ELSE TO_CHAR(s.sale_date, 'YYYY-MM-DD')
            END as period_label,
            COALESCE(s.branch_id, 'unknown')::TEXT as branch_id,
            COALESCE(b.name, 'Unknown Branch')::TEXT as branch_name,
            SUM(si.quantity * si.unit_price) as total_sales,
            COUNT(DISTINCT s.id) as transaction_count,
            CASE 
                WHEN COUNT(DISTINCT s.id) > 0 THEN SUM(si.quantity * si.unit_price) / COUNT(DISTINCT s.id)
                ELSE 0 
            END as avg_transaction
        FROM sales s
        LEFT JOIN branches b ON s.branch_id = b.id
        LEFT JOIN sale_items si ON s.id = si.sale_id
        WHERE s.sale_date >= p_start_date
        AND s.sale_date <= p_end_date
        AND (p_branch_id IS NULL OR s.branch_id = p_branch_id)
        GROUP BY 
            CASE p_time_range
                WHEN 'daily' THEN TO_CHAR(s.sale_date, 'YYYY-MM-DD')
                WHEN 'weekly' THEN 'Week ' || TO_CHAR(s.sale_date, 'IYYY-IW')
                WHEN 'monthly' THEN TO_CHAR(s.sale_date, 'YYYY-MM')
                ELSE TO_CHAR(s.sale_date, 'YYYY-MM-DD')
            END,
            s.branch_id,
            b.name
    )
    SELECT 
        CASE p_time_range
            WHEN 'daily' THEN TO_CHAR(dr.period_date, 'YYYY-MM-DD')
            WHEN 'weekly' THEN 'Week ' || TO_CHAR(dr.period_date, 'IYYY-IW')
            WHEN 'monthly' THEN TO_CHAR(dr.period_date, 'YYYY-MM')
            ELSE TO_CHAR(dr.period_date, 'YYYY-MM-DD')
        END::TEXT as period_label,
        COALESCE(sd.branch_id, 'unknown')::TEXT as branch_id,
        COALESCE(sd.branch_name, 'Unknown Branch')::TEXT as branch_name,
        COALESCE(sd.total_sales, 0) as total_sales,
        COALESCE(sd.transaction_count, 0) as transaction_count,
        COALESCE(sd.avg_transaction, 0) as avg_transaction
    FROM date_ranges dr
    LEFT JOIN sales_data sd ON 
        CASE p_time_range
            WHEN 'daily' THEN TO_CHAR(dr.period_date, 'YYYY-MM-DD')
            WHEN 'weekly' THEN 'Week ' || TO_CHAR(dr.period_date, 'IYYY-IW')
            WHEN 'monthly' THEN TO_CHAR(dr.period_date, 'YYYY-MM')
            ELSE TO_CHAR(dr.period_date, 'YYYY-MM-DD')
        END = sd.period_label
    ORDER BY dr.period_date;
END;
$$ LANGUAGE plpgsql;

-- Create the missing get_expense_data function as well
CREATE OR REPLACE FUNCTION get_expense_data(
    p_branch_id TEXT DEFAULT NULL,
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
    category TEXT,
    branch_id TEXT,
    branch_name TEXT,
    total_amount NUMERIC,
    expense_count INTEGER
) AS $$
BEGIN
    -- Set default dates if not provided
    IF p_start_date IS NULL THEN
        p_start_date := CURRENT_DATE - INTERVAL '30 days';
    END IF;
    
    IF p_end_date IS NULL THEN
        p_end_date := CURRENT_DATE;
    END IF;

    RETURN QUERY
    SELECT 
        e.category::TEXT,
        COALESCE(e.branch_id, 'unknown')::TEXT as branch_id,
        COALESCE(b.name, 'Unknown Branch')::TEXT as branch_name,
        SUM(e.amount) as total_amount,
        COUNT(*) as expense_count
    FROM expenses e
    LEFT JOIN branches b ON e.branch_id = b.id
    WHERE e.expense_date >= p_start_date
    AND e.expense_date <= p_end_date
    AND (p_branch_id IS NULL OR e.branch_id = p_branch_id)
    GROUP BY e.category, e.branch_id, b.name
    ORDER BY total_amount DESC;
END;
$$ LANGUAGE plpgsql;

-- Test the functions
SELECT 'Testing get_sales_data function...' as message;
SELECT * FROM get_sales_data(NULL, NULL, NULL, 'daily') LIMIT 5;

SELECT 'Testing get_expense_data function...' as message;
SELECT * FROM get_expense_data(NULL, NULL, NULL) LIMIT 5;

SELECT 'Functions created successfully!' as status;
