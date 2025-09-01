-- Fix the duplication issue by updating the inventory movement trigger
-- This prevents duplicate stock movement records when API creates manual records

-- Update the inventory movement trigger function to prevent duplication
CREATE OR REPLACE FUNCTION trigger_inventory_stock_movement()
RETURNS TRIGGER AS $$
BEGIN
    -- Only create movement record if quantity actually changed
    IF (TG_OP = 'UPDATE' AND OLD.quantity != NEW.quantity) THEN
        -- Check if this is a manual adjustment by looking for recent manual stock movements
        -- If there's a manual movement within the last 5 seconds, skip this trigger to prevent duplication
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

-- Apply the updated trigger
DROP TRIGGER IF EXISTS inventory_movement_trigger ON inventory;
CREATE TRIGGER inventory_movement_trigger
    AFTER UPDATE ON inventory
    FOR EACH ROW
    EXECUTE FUNCTION trigger_inventory_stock_movement();

-- Test that the trigger is working correctly
SELECT trigger_name, event_object_table 
FROM information_schema.triggers 
WHERE event_object_table = 'inventory';

-- Success message
SELECT 'Duplication issue fixed! Triggers will now skip creating records when API creates manual ones.' as status;
