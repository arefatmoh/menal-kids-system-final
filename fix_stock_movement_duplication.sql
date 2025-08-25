-- Prevent stock movement duplication between sale and inventory triggers

-- 1) Update inventory API to not insert movements explicitly (done in code)
-- 2) Add guard flag to skip inventory trigger when sale trigger runs
-- 3) Ensure functions are in place

-- Recreate inventory trigger with guard
CREATE OR REPLACE FUNCTION trigger_inventory_stock_movement()
RETURNS TRIGGER AS $$
BEGIN
    IF current_setting('app.skip_inventory_trigger', true) = '1' THEN
        RETURN NEW;
    END IF;
    IF (TG_OP = 'UPDATE' AND OLD.quantity != NEW.quantity) THEN
        INSERT INTO stock_movements (
            id, product_id, branch_id, user_id, movement_type,
            quantity, reason, reference_type
        ) VALUES (
            uuid_generate_v4(),
            NEW.product_id,
            NEW.branch_id,
            COALESCE(current_setting('app.current_user_id', true)::UUID, (SELECT id FROM users WHERE role = 'owner' LIMIT 1)),
            CASE WHEN NEW.quantity > OLD.quantity THEN 'in' ELSE 'out' END,
            ABS(NEW.quantity - OLD.quantity),
            'Inventory adjustment',
            'adjustment'
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate sale trigger to set guard flag
CREATE OR REPLACE FUNCTION trigger_sale_inventory_update()
RETURNS TRIGGER AS $$
DECLARE
    sale_branch_id VARCHAR(50);
    sale_user_id UUID;
    rows_updated INTEGER;
BEGIN
    SELECT branch_id, user_id INTO sale_branch_id, sale_user_id FROM sales WHERE id = NEW.sale_id;

    PERFORM set_config('app.skip_inventory_trigger', '1', true);

    UPDATE inventory 
    SET quantity = quantity - NEW.quantity,
        updated_at = NOW()
    WHERE product_id = NEW.product_id 
        AND branch_id = sale_branch_id
        AND ((variation_id = NEW.variation_id) OR (variation_id IS NULL AND NEW.variation_id IS NULL))
        AND quantity >= NEW.quantity;

    GET DIAGNOSTICS rows_updated = ROW_COUNT;

    IF rows_updated = 0 AND NEW.variation_id IS NULL THEN
        WITH picked AS (
            SELECT id FROM inventory
            WHERE product_id = NEW.product_id AND branch_id = sale_branch_id AND quantity >= NEW.quantity
            ORDER BY quantity DESC
            LIMIT 1
        )
        UPDATE inventory i
        SET quantity = quantity - NEW.quantity,
            updated_at = NOW()
        FROM picked
        WHERE i.id = picked.id;
        GET DIAGNOSTICS rows_updated = ROW_COUNT;
    END IF;

    IF rows_updated = 0 THEN
        RAISE EXCEPTION 'Insufficient stock for product % (variation %)', NEW.product_id, NEW.variation_id;
    END IF;

    INSERT INTO stock_movements (
        id, product_id, branch_id, user_id, variation_id, movement_type,
        quantity, reason, reference_type, reference_id
    ) VALUES (
        uuid_generate_v4(), NEW.product_id, sale_branch_id, sale_user_id, NEW.variation_id,
        'out', NEW.quantity, 'Sale transaction', 'sale', NEW.sale_id
    );

    PERFORM set_config('app.skip_inventory_trigger', '0', true);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
