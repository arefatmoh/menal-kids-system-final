-- Fix branch names to show real names instead of "Branch 1" and "Branch 2"

-- Update branch names to real names
UPDATE branches 
SET name = 'Franko' 
WHERE id = 'branch1';

UPDATE branches 
SET name = 'Mebrat Hayl' 
WHERE id = 'branch2';

-- Verify the changes
SELECT id, name, is_active FROM branches ORDER BY id;

-- Test the transfer function again
SELECT 'Testing with real branch names for branch1:' as test_name;
SELECT json_extract_path_text(get_transfer_fast_simple('branch1'), 'branches') as branches_branch1;

SELECT 'Testing with real branch names for branch2:' as test_name;
SELECT json_extract_path_text(get_transfer_fast_simple('branch2'), 'branches') as branches_branch2;