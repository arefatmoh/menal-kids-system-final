-- Fix stock movement duplication by cleaning up duplicates and updating triggers

-- First, clean up duplicate stock movements from today
-- Keep only the first occurrence of each movement and delete duplicates
DELETE FROM stock_movements 
WHERE id IN (
  SELECT sm2.id 
  FROM stock_movements sm1
  JOIN stock_movements sm2 ON 
    sm1.product_id = sm2.product_id 
    AND sm1.branch_id = sm2.branch_id 
    AND sm1.movement_type = sm2.movement_type 
    AND sm1.quantity = sm2.quantity 
    AND sm1.reference_type = sm2.reference_type
    AND DATE(sm1.created_at) = DATE(sm2.created_at)
    AND sm1.id < sm2.id
    AND DATE(sm1.created_at) = CURRENT_DATE
);

-- Update the inventory movement trigger to be more selective
CREATE OR REPLACE FUNCTION trigger_inventory_stock_movement()
RETURNS TRIGGER AS $$
BEGIN
    -- Only create movement record if quantity actually changed
    -- AND if it's not a manual adjustment (those are handled by the API)
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
                id, product_id, branch_id, user_id, movement_type,
                quantity, reason, reference_type
            ) VALUES (
                uuid_generate_v4(),
                NEW.product_id,
                NEW.branch_id,
                COALESCE(current_setting('app.current_user_id', true)::UUID, 
                        (SELECT id FROM users WHERE role = 'owner' LIMIT 1)), -- Fallback to owner
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
