#!/bin/bash

# =====================================================
# MENAL KIDS SYSTEM - DATABASE DEPLOYMENT SCRIPT
# =====================================================
# This script deploys the complete database schema and functions
# for production use
# =====================================================

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DB_NAME="menal_kids_shop"
DB_USER="postgres"
DB_HOST="localhost"
DB_PORT="5432"

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if PostgreSQL is running
check_postgres() {
    print_status "Checking PostgreSQL connection..."
    
    if ! pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" >/dev/null 2>&1; then
        print_error "PostgreSQL is not running or not accessible"
        print_error "Please ensure PostgreSQL is running and accessible"
        exit 1
    fi
    
    print_success "PostgreSQL connection successful"
}

# Function to check if database exists
check_database() {
    print_status "Checking if database '$DB_NAME' exists..."
    
    if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -lqt | cut -d \| -f 1 | grep -qw "$DB_NAME"; then
        print_warning "Database '$DB_NAME' already exists"
        read -p "Do you want to drop and recreate it? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            print_status "Dropping existing database..."
            dropdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME"
            print_success "Database dropped successfully"
        else
            print_warning "Using existing database. Some operations may fail if schema is incompatible."
        fi
    else
        print_status "Database '$DB_NAME' does not exist"
    fi
}

# Function to create database
create_database() {
    print_status "Creating database '$DB_NAME'..."
    
    if ! createdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME"; then
        print_error "Failed to create database"
        exit 1
    fi
    
    print_success "Database created successfully"
}

# Function to deploy schema
deploy_schema() {
    print_status "Deploying database schema..."
    
    if ! psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$SCRIPT_DIR/deployment-schema.sql"; then
        print_error "Failed to deploy schema"
        exit 1
    fi
    
    print_success "Schema deployed successfully"
}

# Function to deploy functions
deploy_functions() {
    print_status "Deploying database functions..."
    
    if ! psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$SCRIPT_DIR/deployment-functions.sql"; then
        print_error "Failed to deploy functions"
        exit 1
    fi
    
    print_success "Functions deployed successfully"
}

# Function to verify deployment
verify_deployment() {
    print_status "Verifying database deployment..."
    
    # Check table count
    TABLE_COUNT=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';" | xargs)
    
    # Check function count
    FUNCTION_COUNT=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema = 'public';" | xargs)
    
    # Check view count
    VIEW_COUNT=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM information_schema.views WHERE table_schema = 'public';" | xargs)
    
    print_success "Deployment verification complete:"
    echo "  - Tables: $TABLE_COUNT"
    echo "  - Functions: $FUNCTION_COUNT"
    echo "  - Views: $VIEW_COUNT"
    
    # Test a simple query
    if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 'Database deployment successful!' as status;" >/dev/null 2>&1; then
        print_success "Database is ready for use!"
    else
        print_error "Database verification failed"
        exit 1
    fi
}

# Function to create sample data (optional)
create_sample_data() {
    read -p "Do you want to create sample data for testing? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_status "Creating sample data..."
        
        # Create sample branch
        psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
        INSERT INTO branches (id, name, address, phone, email, manager_name) 
        VALUES ('BR001', 'Main Store', '123 Main Street', '+1234567890', 'main@menalkids.com', 'Store Manager')
        ON CONFLICT (id) DO NOTHING;"
        
        # Create sample category
        psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
        INSERT INTO categories (name, description) 
        VALUES ('Kids Clothing', 'Clothing for children of all ages')
        ON CONFLICT DO NOTHING;"
        
        print_success "Sample data created successfully"
    fi
}

# Function to show usage
show_usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -h, --host HOST     Database host (default: localhost)"
    echo "  -p, --port PORT     Database port (default: 5432)"
    echo "  -u, --user USER     Database user (default: postgres)"
    echo "  -d, --database DB   Database name (default: menal_kids_shop)"
    echo "  -s, --skip-verify   Skip deployment verification"
    echo "  --help              Show this help message"
    echo ""
    echo "Environment Variables:"
    echo "  PGPASSWORD         Database password"
    echo ""
    echo "Examples:"
    echo "  $0                                    # Use defaults"
    echo "  $0 -h localhost -u postgres          # Specify host and user"
    echo "  PGPASSWORD=mypass $0                 # Set password via environment"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--host)
            DB_HOST="$2"
            shift 2
            ;;
        -p|--port)
            DB_PORT="$2"
            shift 2
            ;;
        -u|--user)
            DB_USER="$2"
            shift 2
            ;;
        -d|--database)
            DB_NAME="$2"
            shift 2
            ;;
        -s|--skip-verify)
            SKIP_VERIFY=true
            shift
            ;;
        --help)
            show_usage
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Main deployment process
main() {
    echo "====================================================="
    echo "MENAL KIDS SYSTEM - DATABASE DEPLOYMENT"
    echo "====================================================="
    echo ""
    echo "Configuration:"
    echo "  Host: $DB_HOST"
    echo "  Port: $DB_PORT"
    echo "  User: $DB_USER"
    echo "  Database: $DB_NAME"
    echo ""
    
    # Check if password is set
    if [[ -z "$PGPASSWORD" ]]; then
        print_warning "PGPASSWORD environment variable not set"
        read -s -p "Enter database password: " PGPASSWORD
        echo
        export PGPASSWORD
    fi
    
    # Run deployment steps
    check_postgres
    check_database
    create_database
    deploy_schema
    deploy_functions
    
    if [[ "$SKIP_VERIFY" != "true" ]]; then
        verify_deployment
    fi
    
    create_sample_data
    
    echo ""
    echo "====================================================="
    print_success "Database deployment completed successfully!"
    echo "====================================================="
    echo ""
    echo "Next steps:"
    echo "1. Update your application's database connection settings"
    echo "2. Test the application with the new database"
    echo "3. Consider setting up regular backups"
    echo "4. Monitor database performance and adjust as needed"
    echo ""
}

# Run main function
main "$@"
