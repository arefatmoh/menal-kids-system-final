-- Fix branch IDs to match real names
-- This will make the branch context work with real names

-- First, let's see what we have
SELECT id, name, is_active FROM branches ORDER BY id;

-- Update branch IDs to match real names
UPDATE branches 
SET id = 'franko' 
WHERE id = 'branch1';

UPDATE branches 
SET id = 'mebrat-hayl' 
WHERE id = 'branch2';

-- Verify the changes
SELECT id, name, is_active FROM branches ORDER BY id;

-- Test the transfer function with new IDs
SELECT 'Testing with new branch IDs for franko:' as test_name;
SELECT get_transfer_fast_simple('franko') as result_franko;

SELECT 'Testing with new branch IDs for mebrat-hayl:' as test_name;
SELECT get_transfer_fast_simple('mebrat-hayl') as result_mebrat_hayl;