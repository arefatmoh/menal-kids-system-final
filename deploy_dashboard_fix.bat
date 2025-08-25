@echo off
echo ========================================
echo MENAL KIDS - Dashboard Fix Deployment
echo ========================================
echo.
echo This script will fix the Total Products card
echo to show branch-specific data instead of combined data.
echo.

REM Check if psql is available
where psql >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo ERROR: psql command not found.
    echo Please ensure PostgreSQL is installed and in PATH.
    pause
    exit /b 1
)

echo Applying the fix...
echo.

REM Apply the fix
psql -h localhost -U postgres -d menal_kids_shop -f fix_total_products_branch_specific.sql

if %ERRORLEVEL% equ 0 (
    echo.
    echo SUCCESS: Dashboard fix applied successfully!
    echo.
    echo The Total Products card will now show:
    echo - Franko branch: Only products with inventory in Franko
    echo - Mebrathayl branch: Only products with inventory in Mebrathayl  
    echo - All branches: Total unique products across all branches
    echo.
) else (
    echo.
    echo ERROR: Failed to apply the fix.
    echo Please check your database connection and try again.
    echo.
)

pause
