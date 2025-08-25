# Dashboard Total Products Fix

## Problem Description

The "Total Products" card on the dashboard was showing the sum of products from both branches instead of showing branch-specific totals. This meant:

- **Franko branch** was showing: Total products from both Franko + Mebrathayl
- **Mebrathayl branch** was showing: Total products from both Franko + Mebrathayl  
- **Owner view (All branches)** was showing: Total unique products across all branches (correct)

## Root Cause

The issue was in the `get_dashboard_stats` function in the database. The logic for counting total products was:

```sql
AND (p_branch_id IS NULL OR i.branch_id = p_branch_id)
```

This condition was not properly filtering when a specific branch was requested. It would count products from all branches when `p_branch_id` was not NULL.

## Solution

Updated the `get_dashboard_stats` function with proper branch-specific logic:

```sql
AND (
  -- If specific branch is requested, only count products in that branch
  (p_branch_id IS NOT NULL AND i.branch_id = p_branch_id)
  OR 
  -- If all branches requested, count all products that have inventory anywhere
  (p_branch_id IS NULL)
)
```

## Files Modified

1. **`database/functions.sql`** - Updated the main function definition
2. **`fix_total_products_branch_specific.sql`** - Standalone fix script
3. **`deploy_dashboard_fix.bat`** - Deployment script for Windows
4. **`test_dashboard_stats.sql`** - Test script to verify the fix

## Expected Behavior After Fix

- **Franko branch**: Shows only products that have inventory in Franko branch
- **Mebrathayl branch**: Shows only products that have inventory in Mebrathayl branch
- **Owner view (All branches)**: Shows total unique products across all branches

## How to Apply the Fix

### Option 1: Using the Deployment Script (Recommended)
```bash
# Run the deployment script
deploy_dashboard_fix.bat
```

### Option 2: Manual Database Update
```bash
# Connect to your database and run the fix script
psql -h localhost -U postgres -d menal_kids_shop -f fix_total_products_branch_specific.sql
```

### Option 3: Using pgAdmin or Other Database Tool
1. Open your database management tool
2. Connect to the `menal_kids_shop` database
3. Run the contents of `fix_total_products_branch_specific.sql`

## Testing the Fix

After applying the fix, you can test it by:

1. **Login as Sarah (Franko branch)**: Check that Total Products shows only Franko products
2. **Login as Michael (Mebrathayl branch)**: Check that Total Products shows only Mebrathayl products  
3. **Login as Owner**: Check that Total Products shows the total unique products across all branches

## Verification Queries

You can run these queries to verify the fix is working:

```sql
-- Check Franko branch products only
SELECT COUNT(DISTINCT p.id) as franko_products
FROM products p
JOIN inventory i ON i.product_id = p.id
WHERE p.is_active = TRUE AND i.branch_id = 'branch1';

-- Check Mebrathayl branch products only
SELECT COUNT(DISTINCT p.id) as mebrathayl_products
FROM products p
JOIN inventory i ON i.product_id = p.id
WHERE p.is_active = TRUE AND i.branch_id = 'branch2';

-- Check total unique products across all branches
SELECT COUNT(DISTINCT p.id) as total_products
FROM products p
JOIN inventory i ON i.product_id = p.id
WHERE p.is_active = TRUE;
```

## Notes

- This fix only affects the "Total Products" card on the dashboard
- Other dashboard cards (Sales Today, Low Stock Alerts, etc.) were already working correctly
- The fix maintains backward compatibility and doesn't affect other parts of the system
