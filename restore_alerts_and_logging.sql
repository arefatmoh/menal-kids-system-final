-- Restore low stock alerts and automatic stock movement logging with proper fixes
-- This resolves the constraint violation while keeping the useful functionality

-- First, let's fix the alerts table constraint to be more permissive
ALTER TABLE alerts DROP CONSTRAINT IF EXISTS alerts_severity_check;
ALTER TABLE alerts ADD CONSTRAINT alerts_severity_check 
    CHECK (severity IN ('low', 'medium', 'high', 'critical', 'info', 'warning', 'error'));

-- Create a fixed version of the low stock trigger function
CREATE OR REPLACE FUNCTION trigger_check_low_stock()
RETURNS TRIGGER AS $$
DECLARE
    product_name VARCHAR(255);
    branch_name VARCHAR(255);
BEGIN
    -- Only check if quantity decreased or min_stock_level changed
    IF (TG_OP = 'UPDATE' AND NEW.quantity <= NEW.min_stock_level AND OLD.quantity > OLD.min_stock_level) THEN
        -- Get product and branch names
        SELECT p.name, b.name INTO product_name, branch_name
        FROM products p
        JOIN branches b ON b.id = NEW.branch_id
        WHERE p.id = NEW.product_id;
        
        -- Create low stock alert with proper severity values
        INSERT INTO alerts (
            type, severity, title, message, branch_id, category, status
        ) VALUES (
            'inventory',
            CASE 
                WHEN NEW.quantity = 0 THEN 'critical'
                WHEN NEW.quantity <= NEW.min_stock_level * 0.5 THEN 'high'
                ELSE 'medium'
            END,
            CASE 
                WHEN NEW.quantity = 0 THEN 'Out of Stock'
                ELSE 'Low Stock Alert'
            END,
            product_name || ' is ' ||
            CASE 
                WHEN NEW.quantity = 0 THEN 'out of stock'
                ELSE 'running low on stock (' || NEW.quantity || ' remaining)'
            END || ' at ' || branch_name,
            NEW.branch_id,
            NEW.product_id::TEXT,
            'active'
        );
    END IF;
    
    -- If stock is replenished above min level, resolve existing alerts
    IF (TG_OP = 'UPDATE' AND NEW.quantity > NEW.min_stock_level AND OLD.quantity <= OLD.min_stock_level) THEN
        UPDATE alerts 
        SET status = 'resolved', resolved_at = NOW(), updated_at = NOW()
        WHERE type = 'inventory' 
            AND branch_id = NEW.branch_id
            AND category = NEW.product_id::TEXT
            AND status = 'active';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a fixed version of the inventory movement trigger function
CREATE OR REPLACE FUNCTION trigger_inventory_stock_movement()
RETURNS TRIGGER AS $$
BEGIN
    -- Only create movement record if quantity actually changed
    IF (TG_OP = 'UPDATE' AND OLD.quantity != NEW.quantity) THEN
        -- Check if this is a manual adjustment by looking for recent manual stock movements
        -- If there's a manual movement within the last 5 seconds, skip this trigger
        IF NOT EXISTS (
            SELECT 1 FROM stock_movements 
            WHERE product_id = NEW.product_id 
              AND branch_id = NEW.branch_id 
              AND reference_type = 'manual'
              AND created_at > NOW() - INTERVAL '5 seconds'
        ) THEN
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

-- Apply the triggers
DROP TRIGGER IF EXISTS low_stock_alert_trigger ON inventory;
CREATE TRIGGER low_stock_alert_trigger
    AFTER UPDATE ON inventory
    FOR EACH ROW
    EXECUTE FUNCTION trigger_check_low_stock();

DROP TRIGGER IF EXISTS inventory_movement_trigger ON inventory;
CREATE TRIGGER inventory_movement_trigger
    AFTER UPDATE ON inventory
    FOR EACH ROW
    EXECUTE FUNCTION trigger_inventory_stock_movement();

-- Test that we can insert an alert with 'medium' severity
INSERT INTO alerts (type, severity, title, message, branch_id, status) 
VALUES ('inventory', 'medium', 'Test Alert', 'Test message', 'branch1', 'active')
ON CONFLICT DO NOTHING;

-- Clean up test data
DELETE FROM alerts WHERE title = 'Test Alert';

-- Verify the triggers are working
SELECT trigger_name, event_object_table, action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'inventory';

-- Success message
SELECT 'Low stock alerts and automatic stock movement logging restored with proper fixes!' as status;
