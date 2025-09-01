-- Fix alerts table severity constraint to match the trigger expectations
-- This resolves the "alerts_severity_check" constraint violation error

-- First, let's check what the current constraint is
SELECT conname, pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'alerts'::regclass AND conname = 'alerts_severity_check';

-- Drop the existing constraint
ALTER TABLE alerts DROP CONSTRAINT IF EXISTS alerts_severity_check;

-- Add the correct constraint that matches the trigger expectations
ALTER TABLE alerts ADD CONSTRAINT alerts_severity_check 
    CHECK (severity IN ('low', 'medium', 'high', 'critical'));

-- Verify the constraint was applied correctly
SELECT conname, pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'alerts'::regclass AND conname = 'alerts_severity_check';

-- Also, let's make sure the trigger is working correctly by checking its definition
SELECT prosrc FROM pg_proc WHERE proname = 'trigger_check_low_stock';

-- Test that we can insert an alert with 'medium' severity
INSERT INTO alerts (type, severity, title, message, branch_id, status) 
VALUES ('inventory', 'medium', 'Test Alert', 'Test message', 'branch1', 'active')
ON CONFLICT DO NOTHING;

-- Clean up test data
DELETE FROM alerts WHERE title = 'Test Alert';

-- Success message
SELECT 'Alerts severity constraint fixed successfully!' as status;
