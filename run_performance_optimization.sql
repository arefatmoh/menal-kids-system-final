-- Master Performance Optimization Script
-- This script runs all database performance optimizations

-- 1. Run the main performance optimization
\i optimize_database_performance.sql

-- 2. Run connection pool analysis
\i optimize_connection_pool.sql

-- 3. Additional performance optimizations

-- Enable query statistics (if not already enabled)
-- This helps identify slow queries
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Create function to get query performance stats
CREATE OR REPLACE FUNCTION get_slow_queries()
RETURNS TABLE (
    query_text TEXT,
    calls BIGINT,
    total_time DOUBLE PRECISION,
    mean_time DOUBLE PRECISION,
    rows BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        query::TEXT,
        calls,
        total_time,
        mean_time,
        rows
    FROM pg_stat_statements 
    WHERE mean_time > 50  -- queries taking more than 50ms on average
    ORDER BY mean_time DESC 
    LIMIT 20;
END;
$$ LANGUAGE plpgsql;

-- Create function to analyze table performance
CREATE OR REPLACE FUNCTION analyze_table_performance()
RETURNS TABLE (
    table_name TEXT,
    total_size TEXT,
    table_size TEXT,
    index_size TEXT,
    row_count BIGINT,
    last_vacuum TIMESTAMP,
    last_analyze TIMESTAMP
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.tablename::TEXT,
        pg_size_pretty(pg_total_relation_size(s.schemaname||'.'||t.tablename))::TEXT,
        pg_size_pretty(pg_relation_size(s.schemaname||'.'||t.tablename))::TEXT,
        pg_size_pretty(pg_total_relation_size(s.schemaname||'.'||t.tablename) - pg_relation_size(s.schemaname||'.'||t.tablename))::TEXT,
        s.n_tup_ins + s.n_tup_upd + s.n_tup_del as row_count,
        s.last_vacuum,
        s.last_analyze
    FROM pg_tables t
    JOIN pg_stat_user_tables s ON t.tablename = s.relname
    WHERE t.schemaname = 'public'
    ORDER BY pg_total_relation_size(s.schemaname||'.'||t.tablename) DESC;
END;
$$ LANGUAGE plpgsql;

-- 4. Show optimization summary
SELECT 'Performance Optimization Complete!' as status;

-- Show created indexes
SELECT 
    'Created Indexes' as category,
    COUNT(*) as count
FROM pg_indexes 
WHERE schemaname = 'public' 
AND indexname LIKE 'idx_%';

-- Show table performance summary
SELECT * FROM analyze_table_performance();

-- Show slow queries (if any)
SELECT * FROM get_slow_queries();

-- 5. Recommendations for further optimization
SELECT 
    'Optimization Recommendations' as category,
    '1. Monitor slow queries using get_slow_queries() function' as recommendation
UNION ALL
SELECT 
    'Optimization Recommendations',
    '2. Refresh materialized views periodically: SELECT refresh_inventory_summary();'
UNION ALL
SELECT 
    'Optimization Recommendations',
    '3. Consider adding more indexes based on slow query analysis'
UNION ALL
SELECT 
    'Optimization Recommendations',
    '4. Monitor connection pool usage and adjust settings if needed'
UNION ALL
SELECT 
    'Optimization Recommendations',
    '5. Run VACUUM ANALYZE periodically for table maintenance';
