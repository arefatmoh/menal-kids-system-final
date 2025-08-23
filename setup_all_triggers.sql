-- Comprehensive Trigger Setup Script
-- This script ensures all required triggers exist for the application

-- 1. Inventory stock movement trigger
CREATE OR REPLACE FUNCTION trigger_inventory_stock_movement()
RETURNS TRIGGER AS $$
BEGIN
    -- Only create movement record if quantity actually changed
    IF (TG_OP = 'UPDATE' AND OLD.quantity != NEW.quantity) THEN
        INSERT INTO stock_movements (
            id, product_id, branch_id, user_id, movement_type,
            quantity, reason, reference_type, variation_id
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
            'adjustment',
            NEW.variation_id
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply the trigger to inventory table
DROP TRIGGER IF EXISTS inventory_movement_trigger ON inventory;
CREATE TRIGGER inventory_movement_trigger
    AFTER UPDATE ON inventory
    FOR EACH ROW
    EXECUTE FUNCTION trigger_inventory_stock_movement();

-- 2. Low stock alert trigger
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
        
        -- Create low stock alert
        INSERT INTO alerts (
            id, type, severity, title, message, branch_id, category, status, created_at, updated_at
        ) VALUES (
            uuid_generate_v4(),
            'inventory',
            CASE 
                WHEN NEW.quantity = 0 THEN 'critical'
                ELSE 'medium'
            END,
            'Low Stock Alert',
            product_name || ' is running low on stock at ' || branch_name || '. Current quantity: ' || NEW.quantity,
            NEW.branch_id,
            NEW.product_id::TEXT,
            'active',
            NOW(),
            NOW()
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

-- Apply the low stock trigger
DROP TRIGGER IF EXISTS low_stock_alert_trigger ON inventory;
CREATE TRIGGER low_stock_alert_trigger
    AFTER UPDATE ON inventory
    FOR EACH ROW
    EXECUTE FUNCTION trigger_check_low_stock();

-- 3. Sale inventory validation trigger
CREATE OR REPLACE FUNCTION trigger_validate_sale_inventory()
RETURNS TRIGGER AS $$
DECLARE
    available_quantity INTEGER;
    sale_branch_id VARCHAR(50);
BEGIN
    -- Get the branch_id from the sale
    SELECT branch_id INTO sale_branch_id FROM sales WHERE id = NEW.sale_id;
    
    -- Check available stock for this product and branch
    SELECT COALESCE(SUM(quantity), 0) INTO available_quantity
    FROM inventory 
    WHERE product_id = NEW.product_id 
        AND branch_id = sale_branch_id
        AND (variation_id = NEW.variation_id OR (NEW.variation_id IS NULL AND variation_id IS NULL));
    
    -- If insufficient stock, raise error
    IF available_quantity < NEW.quantity THEN
        RAISE EXCEPTION 'Insufficient stock for product %: requested %, available %', 
            NEW.product_id, NEW.quantity, available_quantity;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply the validation trigger
DROP TRIGGER IF EXISTS validate_sale_inventory_trigger ON sale_items;
CREATE TRIGGER validate_sale_inventory_trigger
    BEFORE INSERT ON sale_items
    FOR EACH ROW
    EXECUTE FUNCTION trigger_validate_sale_inventory();

-- 4. Sale inventory update trigger
CREATE OR REPLACE FUNCTION trigger_sale_inventory_update()
RETURNS TRIGGER AS $$
DECLARE
    sale_branch_id VARCHAR(50);
BEGIN
    -- Get the branch_id from the sale
    SELECT branch_id INTO sale_branch_id FROM sales WHERE id = NEW.sale_id;
    
    -- Update inventory by decrementing stock
    WITH picked AS (
        SELECT id FROM inventory
        WHERE product_id = NEW.product_id AND branch_id = sale_branch_id AND quantity >= NEW.quantity
        AND (variation_id = NEW.variation_id OR (NEW.variation_id IS NULL AND variation_id IS NULL))
        ORDER BY quantity DESC
        LIMIT 1
    )
    UPDATE inventory i
    SET quantity = quantity - NEW.quantity,
        updated_at = NOW()
    FROM picked
    WHERE i.id = picked.id;
    
    -- Record stock movement
    INSERT INTO stock_movements (
        id, product_id, branch_id, user_id, movement_type,
        quantity, reason, reference_type, reference_id, variation_id
    ) VALUES (
        uuid_generate_v4(),
        NEW.product_id,
        sale_branch_id,
        (SELECT user_id FROM sales WHERE id = NEW.sale_id),
        'out',
        NEW.quantity,
        'Sale',
        'sale',
        NEW.sale_id,
        NEW.variation_id
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply the inventory update trigger
DROP TRIGGER IF EXISTS sale_inventory_trigger ON sale_items;
CREATE TRIGGER sale_inventory_trigger
    AFTER INSERT ON sale_items
    FOR EACH ROW
    EXECUTE FUNCTION trigger_sale_inventory_update();

-- 5. SKU generation trigger (already created in the main script, but ensure it exists)
CREATE OR REPLACE FUNCTION trigger_generate_product_sku()
RETURNS TRIGGER AS $$
DECLARE
    category_name VARCHAR(255);
BEGIN
    -- Only generate SKU if not provided
    IF NEW.sku IS NULL OR NEW.sku = '' THEN
        -- Get category name
        SELECT name INTO category_name FROM categories WHERE id = NEW.category_id;
        
        -- Generate SKU without color and size (these are now in variations)
        NEW.sku := generate_sku(category_name);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply the SKU generation trigger
DROP TRIGGER IF EXISTS generate_sku_trigger ON products;
CREATE TRIGGER generate_sku_trigger
    BEFORE INSERT ON products
    FOR EACH ROW
    EXECUTE FUNCTION trigger_generate_product_sku();

-- 6. Verify all triggers exist
SELECT 
    'Triggers' as object_type,
    trigger_name as object_name,
    'OK' as status
FROM information_schema.triggers 
WHERE trigger_name IN ('inventory_movement_trigger', 'low_stock_alert_trigger', 'validate_sale_inventory_trigger', 'sale_inventory_trigger', 'generate_sku_trigger')
AND trigger_schema = 'public'

ORDER BY trigger_name;
