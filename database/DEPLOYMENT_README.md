# 🚀 Menal Kids System - Database Deployment Guide

This guide explains how to deploy the production-ready database for the Menal Kids System.

## 📋 Overview

The database deployment has been cleaned and consolidated into essential, production-ready files:

- **`deployment-schema.sql`** - Complete database schema with all tables, indexes, constraints, and views
- **`deployment-functions.sql`** - Essential database functions and procedures
- **`deploy-database.sh`** - Linux/Mac deployment script
- **`deploy-database.bat`** - Windows deployment script

## 🎯 What's Included

### ✅ Production-Ready Schema
- **15 core tables** with proper relationships
- **Full variation support** for products (color, size, price)
- **Comprehensive indexing** for optimal performance
- **Data integrity constraints** and triggers
- **Reporting views** for analytics
- **Materialized views** for dashboard statistics

### ✅ Essential Functions
- **Inventory management** with automatic stock tracking
- **Sales processing** with inventory updates
- **Transfer management** between branches
- **Low stock alerts** and reporting
- **System maintenance** utilities

### ✅ Deployment Scripts
- **Cross-platform support** (Linux/Mac/Windows)
- **Automatic verification** of deployment
- **Error handling** and rollback support
- **Sample data creation** (optional)

## 🛠️ Prerequisites

### Required Software
- **PostgreSQL 12+** installed and running
- **psql** command-line client in PATH
- **createdb** and **dropdb** utilities

### System Requirements
- **RAM**: Minimum 2GB, Recommended 4GB+
- **Storage**: Minimum 10GB free space
- **OS**: Linux, macOS, or Windows 10+

## 🚀 Quick Deployment

### Option 1: Automated Script (Recommended)

#### Linux/Mac
```bash
# Make script executable
chmod +x database/deploy-database.sh

# Run deployment
cd database
./deploy-database.sh
```

#### Windows
```cmd
# Run deployment
cd database
deploy-database.bat
```

### Option 2: Manual SQL Execution

```bash
# Create database
createdb -U postgres menal_kids_shop

# Deploy schema
psql -U postgres -d menal_kids_shop -f deployment-schema.sql

# Deploy functions
psql -U postgres -d menal_kids_shop -f deployment-functions.sql
```

## ⚙️ Configuration Options

### Environment Variables
```bash
# Set database password
export PGPASSWORD="your_password"

# Custom database settings
export DB_HOST="localhost"
export DB_PORT="5432"
export DB_USER="postgres"
export DB_NAME="menal_kids_shop"
```

### Command Line Options
```bash
# Custom host and user
./deploy-database.sh -h localhost -u postgres

# Skip verification
./deploy-database.sh -s

# Custom database name
./deploy-database.sh -d my_custom_db

# Show help
./deploy-database.sh --help
```

## 📊 Deployment Verification

The deployment script automatically verifies:

- ✅ **Table count** (should be 15)
- ✅ **Function count** (should be 9+)
- ✅ **View count** (should be 3+)
- ✅ **Database connectivity**
- ✅ **Basic query execution**

### Manual Verification
```sql
-- Check table count
SELECT COUNT(*) as total_tables 
FROM information_schema.tables 
WHERE table_schema = 'public' AND table_type = 'BASE TABLE';

-- Check function count
SELECT COUNT(*) as total_functions 
FROM information_schema.routines 
WHERE routine_schema = 'public';

-- Check view count
SELECT COUNT(*) as total_views 
FROM information_schema.views 
WHERE table_schema = 'public';

-- Test system stats
SELECT * FROM get_system_stats();
```

## 🗂️ Database Structure

### Core Tables
| Table | Purpose | Key Features |
|-------|---------|--------------|
| `branches` | Store locations | Branch management |
| `users` | System users | Role-based access |
| `categories` | Product categories | Hierarchical support |
| `products` | Product catalog | Uniform/variation types |
| `product_variations` | Product variants | Color, size, price |
| `inventory` | Stock levels | Per-branch tracking |
| `sales` | Sales transactions | Customer information |
| `sale_items` | Sale line items | Variation support |
| `stock_movements` | Stock tracking | Audit trail |
| `transfers` | Inter-branch moves | Status tracking |
| `transfer_items` | Transfer details | Variation support |
| `budgets` | Budget allocation | Per-branch planning |
| `expenses` | Expense tracking | Receipt management |
| `alerts` | System notifications | Severity levels |

### Key Views
- **`v_inventory_status`** - Current stock levels and status
- **`v_sales_summary`** - Sales statistics and summaries
- **`v_transfer_summary`** - Transfer tracking and status
- **`mv_dashboard_stats`** - Materialized view for performance

## 🔧 Essential Functions

### Inventory Management
```sql
-- Update inventory quantity
SELECT update_inventory_quantity(
    'product_uuid', 'variation_uuid', 'BR001', 10, 'in', 'user_uuid'
);

-- Get low stock alerts
SELECT * FROM get_low_stock_alerts('BR001');

-- Calculate inventory value
SELECT * FROM calculate_inventory_value();
```

### Sales Processing
```sql
-- Create sale with items
SELECT create_sale(
    'BR001', 'user_uuid', 'John Doe', '+1234567890',
    'cash', '[{"product_id":"uuid","variation_id":"uuid","quantity":2,"unit_price":25.99}]'
);

-- Get sales summary
SELECT * FROM get_sales_summary('BR001', '2024-01-01', '2024-12-31');
```

### Transfer Management
```sql
-- Create transfer between branches
SELECT create_transfer(
    'BR001', 'BR002', 'user_uuid',
    '[{"product_id":"uuid","variation_id":"uuid","quantity":5}]',
    'Monthly restocking'
);
```

## 🚨 Troubleshooting

### Common Issues

#### Connection Failed
```bash
# Check PostgreSQL service
sudo systemctl status postgresql

# Test connection
psql -h localhost -U postgres -c "SELECT 1;"
```

#### Permission Denied
```bash
# Check user permissions
psql -U postgres -c "\du"

# Grant necessary permissions
GRANT ALL PRIVILEGES ON DATABASE menal_kids_shop TO your_user;
```

#### Schema Already Exists
```bash
# Drop and recreate
dropdb -U postgres menal_kids_shop
createdb -U postgres menal_kids_shop
```

### Error Logs
```bash
# Check PostgreSQL logs
sudo tail -f /var/log/postgresql/postgresql-*.log

# Check application logs
tail -f logs/application.log
```

## 🔄 Maintenance

### Regular Tasks
```sql
-- Refresh materialized views
SELECT refresh_materialized_views();

-- Clean up old data (keep last 365 days)
SELECT * FROM cleanup_old_data(365);

-- Get system statistics
SELECT * FROM get_system_stats();
```

### Backup Strategy
```bash
# Create backup
pg_dump -U postgres menal_kids_shop > backup_$(date +%Y%m%d).sql

# Restore backup
psql -U postgres -d menal_kids_shop < backup_20241201.sql
```

## 📈 Performance Optimization

### Indexes
- **Primary keys** on all tables
- **Foreign key indexes** for joins
- **Composite indexes** for common queries
- **Partial indexes** for active records

### Views
- **Materialized views** for dashboard stats
- **Regular views** for reporting
- **Automatic refresh** triggers

### Constraints
- **Check constraints** for data validation
- **Unique constraints** for data integrity
- **Foreign keys** for referential integrity

## 🔐 Security Considerations

### User Management
```sql
-- Create application user
CREATE USER app_user WITH PASSWORD 'secure_password';

-- Grant necessary permissions
GRANT CONNECT ON DATABASE menal_kids_shop TO app_user;
GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
```

### Connection Security
- Use **SSL connections** in production
- Implement **connection pooling**
- Set **connection limits**
- Use **environment variables** for credentials

## 📞 Support

### Documentation
- **Schema documentation** in SQL comments
- **Function documentation** with examples
- **Deployment guide** (this file)
- **API documentation** for application integration

### Next Steps
1. ✅ **Deploy database** using provided scripts
2. 🔧 **Update application** connection settings
3. 🧪 **Test functionality** with sample data
4. 📊 **Monitor performance** and adjust as needed
5. 🔄 **Set up backups** and maintenance schedules

---

**🎉 Congratulations!** Your database is now ready for production use.

For additional support or questions, please refer to the application documentation or contact the development team.
