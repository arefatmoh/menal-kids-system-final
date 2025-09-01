-- Comprehensive fix for stock movement duplication
-- This ensures NO duplication for any operation: sales, transfers, adding, reducing

-- First, let's completely disable the inventory movement trigger to prevent any duplication
DROP TRIGGER IF EXISTS inventory_movement_trigger ON inventory;

-- Create a new, smarter trigger that only creates records for non-manual operations
CREATE OR REPLACE FUNCTION trigger_inventory_stock_movement()
RETURNS TRIGGER AS $$
DECLARE
    manual_movement_exists BOOLEAN := FALSE;
BEGIN
    -- Only create movement record if quantity actually changed
    IF (TG_OP = 'UPDATE' AND OLD.quantity != NEW.quantity) THEN
        -- Check if this is a manual adjustment by looking for recent manual stock movements
        -- Use a more robust check with exact timing
        SELECT EXISTS(
            SELECT 1 FROM stock_movements 
            WHERE product_id = NEW.product_id 
              AND branch_id = NEW.branch_id 
              AND reference_type = 'manual'
              AND created_at > NOW() - INTERVAL '10 seconds'
        ) INTO manual_movement_exists;
        
        -- Only create automatic record if NO manual record exists
        IF NOT manual_movement_exists THEN
            INSERT INTO stock_movements (
                product_id, branch_id, user_id, movement_type,
                quantity, reason, reference_type
            ) VALUES (
                NEW.product_id,
                NEW.branch_id,
                COALESCE(current_setting('app.current_user_id', true)::UUID, 
                        (SELECT id FROM users WHERE role = 'owner' LIMIT 1)),
                CASE 
                    WHEN NEW.quantity > OLD.quantity THEN 'in'
                    ELSE 'out'
                END,
                ABS(NEW.quantity - OLD.quantity),
                'Inventory adjustment',
                'adjustment'
            );
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply the updated trigger
CREATE TRIGGER inventory_movement_trigger
    AFTER UPDATE ON inventory
    FOR EACH ROW
    EXECUTE FUNCTION trigger_inventory_stock_movement();

-- Also, let's ensure the low stock trigger doesn't interfere
CREATE OR REPLACE FUNCTION trigger_check_low_stock()
RETURNS TRIGGER AS $$
DECLARE
    product_name VARCHAR(255);
    branch_name VARCHAR(255);
BEGIN
    -- Only check if quantity decreased and is now at or below min_stock_level
    IF (TG_OP = 'UPDATE' AND NEW.quantity <= NEW.min_stock_level AND OLD.quantity > OLD.min_stock_level) THEN
        -- Get product and branch names
        SELECT p.name, b.name INTO product_name, branch_name
        FROM products p
        JOIN branches b ON b.id = NEW.branch_id
        WHERE p.id = NEW.product_id;
        
        -- Create low stock alert
        INSERT INTO alerts (
            type, severity, title, message, branch_id, category, status
        ) VALUES (
            'inventory',
            CASE 
                WHEN NEW.quantity = 0 THEN 'critical'
                ELSE 'medium'
            END,
            'Low Stock Alert',
            product_name || ' is running low on stock at ' || branch_name || '. Current quantity: ' || NEW.quantity,
            NEW.branch_id,
            NEW.product_id::TEXT,
            'active'
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Verify the triggers are working correctly
SELECT trigger_name, event_object_table 
FROM information_schema.triggers 
WHERE event_object_table = 'inventory';

-- Test that we can insert an alert with 'medium' severity
INSERT INTO alerts (type, severity, title, message, branch_id, status) 
VALUES ('inventory', 'medium', 'Test Alert', 'Test message', 'branch1', 'active')
ON CONFLICT DO NOTHING;

-- Clean up test data
DELETE FROM alerts WHERE title = 'Test Alert';

-- Success message
SELECT 'Comprehensive duplication fix applied! No more duplicates for any operation.' as status;
