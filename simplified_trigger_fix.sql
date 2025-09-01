-- Simplified trigger for manual adjustments
-- This creates stock movements for manual add/reduce operations

CREATE OR REPLACE FUNCTION trigger_inventory_stock_movement()
RETURNS TRIGGER AS $$
BEGIN
    -- Only create movement record if quantity actually changed
    IF (TG_OP = 'UPDATE' AND OLD.quantity != NEW.quantity) THEN
        -- Create stock movement record for manual adjustments
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
            'Manual inventory adjustment',
            'manual'
        );
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

-- Verify the triggers are working correctly
SELECT trigger_name, event_object_table 
FROM information_schema.triggers 
WHERE event_object_table = 'inventory';

-- Success message
SELECT 'Simplified trigger applied! Manual adjustments will now work like sales and transfers.' as status;
