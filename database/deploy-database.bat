@echo off
setlocal enabledelayedexpansion

REM =====================================================
REM MENAL KIDS SYSTEM - DATABASE DEPLOYMENT SCRIPT
REM =====================================================
REM This script deploys the complete database schema and functions
REM for production use on Windows
REM =====================================================

REM Configuration
set "SCRIPT_DIR=%~dp0"
set "DB_NAME=menal_kids_shop"
set "DB_USER=postgres"
set "DB_HOST=localhost"
set "DB_PORT=5432"

REM Colors for output (Windows 10+)
if "%TERM%"=="xterm" (
    set "RED=[91m"
    set "GREEN=[92m"
    set "YELLOW=[93m"
    set "BLUE=[94m"
    set "NC=[0m"
) else (
    set "RED="
    set "GREEN="
    set "YELLOW="
    set "BLUE="
    set "NC="
)

REM Function to print colored output
:print_status
echo %BLUE%[INFO]%NC% %~1
goto :eof

:print_success
echo %GREEN%[SUCCESS]%NC% %~1
goto :eof

REM Function to check if PostgreSQL is running
:check_postgres
call :print_status "Checking PostgreSQL connection..."

REM Check if psql is available
where psql >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo %RED%[ERROR]%NC% psql command not found. Please ensure PostgreSQL is installed and in PATH.
    exit /b 1
)

REM Test connection
echo exit | psql -h "%DB_HOST%" -p "%DB_PORT%" -U "%DB_USER%" -d postgres -c "SELECT 1;" >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo %RED%[ERROR]%NC% PostgreSQL connection failed
    echo %RED%[ERROR]%NC% Please ensure PostgreSQL is running and accessible
    exit /b 1
)

call :print_success "PostgreSQL connection successful"
goto :eof

REM Function to check if database exists
:check_database
call :print_status "Checking if database '%DB_NAME%' exists..."

echo exit | psql -h "%DB_HOST%" -p "%DB_PORT%" -U "%DB_USER%" -d "%DB_NAME%" -c "SELECT 1;" >nul 2>&1
if %ERRORLEVEL% equ 0 (
    echo %YELLOW%[WARNING]%NC% Database '%DB_NAME%' already exists
    set /p "DROP_DB=Do you want to drop and recreate it? (y/N): "
    if /i "!DROP_DB!"=="y" (
        call :print_status "Dropping existing database..."
        dropdb -h "%DB_HOST%" -p "%DB_PORT%" -U "%DB_USER%" "%DB_NAME%"
        if %ERRORLEVEL% equ 0 (
            call :print_success "Database dropped successfully"
        ) else (
            echo %RED%[ERROR]%NC% Failed to drop database
            exit /b 1
        )
    ) else (
        echo %YELLOW%[WARNING]%NC% Using existing database. Some operations may fail if schema is incompatible.
    )
) else (
    call :print_status "Database '%DB_NAME%' does not exist"
)
goto :eof

REM Function to create database
:create_database
call :print_status "Creating database '%DB_NAME%'..."

createdb -h "%DB_HOST%" -p "%DB_PORT%" -U "%DB_USER%" "%DB_NAME%"
if %ERRORLEVEL% neq 0 (
    echo %RED%[ERROR]%NC% Failed to create database
    exit /b 1
)

call :print_success "Database created successfully"
goto :eof

REM Function to deploy schema
:deploy_schema
call :print_status "Deploying database schema..."

psql -h "%DB_HOST%" -p "%DB_PORT%" -U "%DB_USER%" -d "%DB_NAME%" -f "%SCRIPT_DIR%deployment-schema.sql"
if %ERRORLEVEL% neq 0 (
    echo %RED%[ERROR]%NC% Failed to deploy schema
    exit /b 1
)

call :print_success "Schema deployed successfully"
goto :eof

REM Function to deploy functions
:deploy_functions
call :print_status "Deploying database functions..."

psql -h "%DB_HOST%" -p "%DB_PORT%" -U "%DB_USER%" -d "%DB_NAME%" -f "%SCRIPT_DIR%deployment-functions.sql"
if %ERRORLEVEL% neq 0 (
    echo %RED%[ERROR]%NC% Failed to deploy functions
    exit /b 1
)

call :print_success "Functions deployed successfully"
goto :eof

REM Function to verify deployment
:verify_deployment
call :print_status "Verifying database deployment..."

REM Check table count
for /f "tokens=*" %%i in ('psql -h "%DB_HOST%" -p "%DB_PORT%" -U "%DB_USER%" -d "%DB_NAME%" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';"') do set "TABLE_COUNT=%%i"

REM Check function count
for /f "tokens=*" %%i in ('psql -h "%DB_HOST%" -p "%DB_PORT%" -U "%DB_USER%" -d "%DB_NAME%" -t -c "SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema = 'public';"') do set "FUNCTION_COUNT=%%i"

REM Check view count
for /f "tokens=*" %%i in ('psql -h "%DB_HOST%" -p "%DB_PORT%" -U "%DB_USER%" -d "%DB_NAME%" -t -c "SELECT COUNT(*) FROM information_schema.views WHERE table_schema = 'public';"') do set "VIEW_COUNT=%%i"

call :print_success "Deployment verification complete:"
echo   - Tables: !TABLE_COUNT!
echo   - Functions: !FUNCTION_COUNT!
echo   - Views: !VIEW_COUNT!

REM Test a simple query
echo exit | psql -h "%DB_HOST%" -p "%DB_PORT%" -U "%DB_USER%" -d "%DB_NAME%" -c "SELECT 'Database deployment successful!' as status;" >nul 2>&1
if %ERRORLEVEL% equ 0 (
    call :print_success "Database is ready for use!"
) else (
    echo %RED%[ERROR]%NC% Database verification failed
    exit /b 1
)
goto :eof

REM Function to create sample data (optional)
:create_sample_data
set /p "CREATE_SAMPLE=Do you want to create sample data for testing? (y/N): "
if /i "!CREATE_SAMPLE!"=="y" (
    call :print_status "Creating sample data..."
    
    REM Create sample branch
    psql -h "%DB_HOST%" -p "%DB_PORT%" -U "%DB_USER%" -d "%DB_NAME%" -c "INSERT INTO branches (id, name, address, phone, email, manager_name) VALUES ('BR001', 'Main Store', '123 Main Street', '+1234567890', 'main@menalkids.com', 'Store Manager') ON CONFLICT (id) DO NOTHING;"
    
    REM Create sample category
    psql -h "%DB_HOST%" -p "%DB_PORT%" -U "%DB_USER%" -d "%DB_NAME%" -c "INSERT INTO categories (name, description) VALUES ('Kids Clothing', 'Clothing for children of all ages') ON CONFLICT DO NOTHING;"
    
    call :print_success "Sample data created successfully"
)
goto :eof

REM Function to show usage
:show_usage
echo Usage: %~nx0 [OPTIONS]
echo.
echo Options:
echo   -h HOST       Database host (default: localhost)
echo   -p PORT       Database port (default: 5432)
echo   -u USER       Database user (default: postgres)
echo   -d DATABASE   Database name (default: menal_kids_shop)
echo   -s            Skip deployment verification
echo   --help        Show this help message
echo.
echo Environment Variables:
echo   PGPASSWORD    Database password
echo.
echo Examples:
echo   %~nx0                    # Use defaults
echo   %~nx0 -h localhost      # Specify host
echo   set PGPASSWORD=mypass    # Set password
echo   %~nx0                   # Run with password set
goto :eof

REM Parse command line arguments
:parse_args
if "%~1"=="" goto :main
if "%~1"=="-h" (
    set "DB_HOST=%~2"
    shift
    shift
    goto :parse_args
)
if "%~1"=="-p" (
    set "DB_PORT=%~2"
    shift
    shift
    goto :parse_args
)
if "%~1"=="-u" (
    set "DB_USER=%~2"
    shift
    shift
    goto :parse_args
)
if "%~1"=="-d" (
    set "DB_NAME=%~2"
    shift
    shift
    goto :parse_args
)
if "%~1"=="-s" (
    set "SKIP_VERIFY=true"
    shift
    goto :parse_args
)
if "%~1"=="--help" (
    call :show_usage
    exit /b 0
)
echo %RED%[ERROR]%NC% Unknown option: %~1
call :show_usage
exit /b 1

REM Main deployment process
:main
echo =====================================================
echo MENAL KIDS SYSTEM - DATABASE DEPLOYMENT
echo =====================================================
echo.
echo Configuration:
echo   Host: %DB_HOST%
echo   Port: %DB_PORT%
echo   User: %DB_USER%
echo   Database: %DB_NAME%
echo.

REM Check if password is set
if "%PGPASSWORD%"=="" (
    echo %YELLOW%[WARNING]%NC% PGPASSWORD environment variable not set
    set /p "PGPASSWORD=Enter database password: "
    set "PGPASSWORD=!PGPASSWORD!"
)

REM Run deployment steps
call :check_postgres
if %ERRORLEVEL% neq 0 exit /b 1

call :check_database
if %ERRORLEVEL% neq 0 exit /b 1

call :create_database
if %ERRORLEVEL% neq 0 exit /b 1

call :deploy_schema
if %ERRORLEVEL% neq 0 exit /b 1

call :deploy_functions
if %ERRORLEVEL% neq 0 exit /b 1

if not defined SKIP_VERIFY (
    call :verify_deployment
    if %ERRORLEVEL% neq 0 exit /b 1
)

call :create_sample_data

echo.
echo =====================================================
call :print_success "Database deployment completed successfully!"
echo =====================================================
echo.
echo Next steps:
echo 1. Update your application's database connection settings
echo 2. Test the application with the new database
echo 3. Consider setting up regular backups
echo 4. Monitor database performance and adjust as needed
echo.

pause
