-- Database Connection Pool Optimization
-- These settings should be applied to your database configuration

-- 1. Check current connection settings
SELECT 
    name,
    setting,
    unit,
    context,
    category
FROM pg_settings 
WHERE name IN (
    'max_connections',
    'shared_buffers',
    'effective_cache_size',
    'work_mem',
    'maintenance_work_mem',
    'checkpoint_completion_target',
    'wal_buffers',
    'default_statistics_target',
    'random_page_cost',
    'effective_io_concurrency'
);

-- 2. Recommended settings for better performance
-- (These are suggestions - apply them based on your server resources)

-- For a development environment with 4GB RAM:
-- max_connections = 100
-- shared_buffers = 256MB
-- effective_cache_size = 1GB
-- work_mem = 4MB
-- maintenance_work_mem = 64MB
-- checkpoint_completion_target = 0.9
-- wal_buffers = 16MB
-- default_statistics_target = 100
-- random_page_cost = 1.1
-- effective_io_concurrency = 200

-- For a production environment with 8GB+ RAM:
-- max_connections = 200
-- shared_buffers = 2GB
-- effective_cache_size = 6GB
-- work_mem = 8MB
-- maintenance_work_mem = 256MB
-- checkpoint_completion_target = 0.9
-- wal_buffers = 32MB
-- default_statistics_target = 500
-- random_page_cost = 1.1
-- effective_io_concurrency = 200

-- 3. Show current connection usage
SELECT 
    'Connection Usage' as category,
    COUNT(*) as active_connections,
    (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') as max_connections,
    ROUND(COUNT(*) * 100.0 / (SELECT setting::int FROM pg_settings WHERE name = 'max_connections'), 2) as usage_percent
FROM pg_stat_activity 
WHERE state = 'active';

-- 4. Show slow queries (if any)
SELECT 
    'Slow Queries' as category,
    query,
    calls,
    total_time,
    mean_time,
    rows
FROM pg_stat_statements 
WHERE mean_time > 100  -- queries taking more than 100ms on average
ORDER BY mean_time DESC 
LIMIT 10;

-- 5. Show table sizes and bloat
SELECT 
    'Table Sizes' as category,
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size,
    pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as table_size,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) as index_size
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
