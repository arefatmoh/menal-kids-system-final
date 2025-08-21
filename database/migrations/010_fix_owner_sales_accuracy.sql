-- Fix owner sales accuracy by creating a direct sales total function

-- Function to get accurate sales total for today (for dashboard)
CREATE OR REPLACE FUNCTION get_today_sales_total(p_branch_id VARCHAR(50) DEFAULT NULL)
RETURNS NUMERIC AS $$
DECLARE
    total_sales NUMERIC;
BEGIN
    SELECT COALESCE(SUM(s.total_amount), 0) INTO total_sales
    FROM sales s
    WHERE DATE(s.created_at) = CURRENT_DATE
      AND (p_branch_id IS NULL OR s.branch_id = p_branch_id);
    
    RETURN total_sales;
END;
$$ LANGUAGE plpgsql;

-- Update the get_sales_data function to be more accurate for daily totals
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
    -- For daily time range, return a single row with total across all branches
    IF p_time_range = 'daily' AND p_branch_id IS NULL THEN
        RETURN QUERY
        SELECT 
            'Today'::VARCHAR as period_label,
            'all'::VARCHAR as branch_id,
            'All Branches'::VARCHAR as branch_name,
            COALESCE(SUM(s.total_amount), 0) as total_sales,
            COUNT(s.id)::BIGINT as transaction_count,
            CASE WHEN COUNT(s.id) > 0 THEN AVG(s.total_amount) ELSE 0 END as avg_transaction
        FROM sales s
        WHERE DATE(s.created_at) = CURRENT_DATE;
    ELSE
        -- Original logic for other cases
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
    END IF;
END;
$$ LANGUAGE plpgsql;
