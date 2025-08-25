-- Menal Kids Shop Database Triggers
-- Automated triggers for business logic

-- Trigger to automatically create stock movement records when inventory changes
CREATE OR REPLACE FUNCTION trigger_inventory_stock_movement()
RETURNS TRIGGER AS $$
BEGIN
    -- If sale trigger asked to skip inventory movement logging, do nothing
    IF current_setting('app.skip_inventory_trigger', true) = '1' THEN
        RETURN NEW;
    END IF;
    -- Only create movement record if quantity actually changed
    IF (TG_OP = 'UPDATE' AND OLD.quantity != NEW.quantity) THEN
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
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply the trigger to inventory table
DROP TRIGGER IF EXISTS inventory_movement_trigger ON inventory;
CREATE TRIGGER inventory_movement_trigger
    AFTER UPDATE ON inventory
    FOR EACH ROW
    EXECUTE FUNCTION trigger_inventory_stock_movement();

-- Trigger to automatically check for low stock alerts when inventory is updated
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

-- Trigger to automatically sync inventory when products are updated
CREATE OR REPLACE FUNCTION trigger_product_inventory_sync()
RETURNS TRIGGER AS $$
BEGIN
    -- When a product is updated, ensure inventory records are properly linked
    -- This trigger is now minimal since we handle inventory creation manually per branch
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply the product inventory sync trigger
DROP TRIGGER IF EXISTS product_inventory_sync_trigger ON products;
CREATE TRIGGER product_inventory_sync_trigger
    AFTER UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION trigger_product_inventory_sync();

-- Trigger to update inventory when a sale is completed
CREATE OR REPLACE FUNCTION trigger_sale_inventory_update()
RETURNS TRIGGER AS $$
DECLARE
    sale_branch_id VARCHAR(50);
    sale_user_id UUID;
    rows_updated INTEGER;
BEGIN
    -- Get sale details
    SELECT branch_id, user_id INTO sale_branch_id, sale_user_id
    FROM sales WHERE id = NEW.sale_id;
    
    -- Ask inventory trigger to skip logging movement because we log a sale movement here
    PERFORM set_config('app.skip_inventory_trigger', '1', true);

    -- Update inventory (variation-aware, guarded)
    UPDATE inventory 
    SET quantity = quantity - NEW.quantity,
        updated_at = NOW()
    WHERE product_id = NEW.product_id 
        AND branch_id = sale_branch_id
        AND ((variation_id = NEW.variation_id) OR (variation_id IS NULL AND NEW.variation_id IS NULL))
        AND quantity >= NEW.quantity;

    GET DIAGNOSTICS rows_updated = ROW_COUNT;

    -- Fallback for uniform products: if no NULL-variation row exists, decrement the largest available row
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
    
    -- Create stock movement record
    INSERT INTO stock_movements (
        id, product_id, branch_id, user_id, variation_id, movement_type,
        quantity, reason, reference_type, reference_id
    ) VALUES (
        uuid_generate_v4(),
        NEW.product_id,
        sale_branch_id,
        sale_user_id,
        NEW.variation_id,
        'out',
        NEW.quantity,
        'Sale transaction',
        'sale',
        NEW.sale_id
    );

    -- Re-enable inventory trigger logging for subsequent operations
    PERFORM set_config('app.skip_inventory_trigger', '0', true);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply the sale inventory trigger
DROP TRIGGER IF EXISTS sale_inventory_trigger ON sale_items;
CREATE TRIGGER sale_inventory_trigger
    AFTER INSERT ON sale_items
    FOR EACH ROW
    EXECUTE FUNCTION trigger_sale_inventory_update();

-- Trigger to validate sale items against available inventory
CREATE OR REPLACE FUNCTION trigger_validate_sale_inventory()
RETURNS TRIGGER AS $$
DECLARE
    available_quantity INTEGER;
    sale_branch_id VARCHAR(50);
    tmp_quantity INTEGER;
BEGIN
    -- Get sale branch
    SELECT branch_id INTO sale_branch_id
    FROM sales WHERE id = NEW.sale_id;
    
    -- Get available quantity
    SELECT quantity INTO available_quantity
    FROM inventory 
    WHERE product_id = NEW.product_id 
        AND branch_id = sale_branch_id
        AND ((variation_id = NEW.variation_id) OR (variation_id IS NULL AND NEW.variation_id IS NULL));
    
    -- If no inventory record exists, set available_quantity to 0
    IF available_quantity IS NULL THEN
        available_quantity := 0;
    END IF;

    -- Fallback for uniform products: if NULL-variation row missing, sum all rows for this product+branch
    IF available_quantity = 0 AND NEW.variation_id IS NULL THEN
        SELECT COALESCE(SUM(quantity), 0) INTO tmp_quantity
        FROM inventory
        WHERE product_id = NEW.product_id AND branch_id = sale_branch_id;
        available_quantity := tmp_quantity;
    END IF;
    
    -- Check if enough stock is available
    IF available_quantity < NEW.quantity THEN
        RAISE EXCEPTION 'Insufficient stock. Available: %, Requested: %', available_quantity, NEW.quantity;
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

-- Trigger to automatically calculate sale item total price
CREATE OR REPLACE FUNCTION trigger_calculate_sale_item_total()
RETURNS TRIGGER AS $$
BEGIN
    NEW.total_price := NEW.quantity * NEW.unit_price;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply the calculation trigger
DROP TRIGGER IF EXISTS calculate_sale_item_total_trigger ON sale_items;
CREATE TRIGGER calculate_sale_item_total_trigger
    BEFORE INSERT OR UPDATE ON sale_items
    FOR EACH ROW
    EXECUTE FUNCTION trigger_calculate_sale_item_total();

-- Trigger to check budget alerts when expenses are added
CREATE OR REPLACE FUNCTION trigger_check_budget_on_expense()
RETURNS TRIGGER AS $$
DECLARE
    budget_amount DECIMAL(12,2);
    spent_amount DECIMAL(12,2);
    percentage_used DECIMAL(5,2);
    branch_name VARCHAR(255);
    has_budget_amount BOOLEAN;
BEGIN
    -- Get budget for this category and branch
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'budgets' AND column_name = 'budget_amount'
    ) INTO has_budget_amount;

    IF has_budget_amount THEN
        SELECT b.budget_amount INTO budget_amount
        FROM budgets b
        WHERE b.category = NEW.category
            AND (b.branch_id = NEW.branch_id OR b.branch_id IS NULL)
            AND NEW.expense_date BETWEEN b.period_start AND b.period_end
        ORDER BY b.branch_id NULLS LAST -- Prefer branch-specific budget
        LIMIT 1;
    ELSE
        SELECT b.amount INTO budget_amount
        FROM budgets b
        WHERE b.category = NEW.category
            AND (b.branch_id = NEW.branch_id OR b.branch_id IS NULL)
            AND NEW.expense_date BETWEEN b.period_start AND b.period_end
        ORDER BY b.branch_id NULLS LAST -- Prefer branch-specific budget
        LIMIT 1;
    END IF;
    
    -- If budget exists, check spending
    IF budget_amount IS NOT NULL THEN
        -- Calculate total spent in this category
        SELECT COALESCE(SUM(amount), 0) INTO spent_amount
        FROM expenses e
        WHERE e.category = NEW.category
            AND (e.branch_id = NEW.branch_id OR (e.branch_id IS NULL AND NEW.branch_id IS NULL))
            AND e.expense_date BETWEEN 
                (SELECT period_start FROM budgets WHERE category = NEW.category 
                 AND (branch_id = NEW.branch_id OR branch_id IS NULL) 
                 ORDER BY branch_id NULLS LAST LIMIT 1)
                AND
                (SELECT period_end FROM budgets WHERE category = NEW.category 
                 AND (branch_id = NEW.branch_id OR branch_id IS NULL) 
                 ORDER BY branch_id NULLS LAST LIMIT 1);
        
        percentage_used := (spent_amount / budget_amount * 100);
        
        -- Create alert if over threshold
        IF percentage_used >= 80 THEN
            -- Get branch name if applicable
            SELECT name INTO branch_name FROM branches WHERE id = NEW.branch_id;
            
            -- Check if alert already exists
            IF NOT EXISTS (
                SELECT 1 FROM alerts 
                WHERE type = 'budget' 
                    AND (branch_id = NEW.branch_id OR (branch_id IS NULL AND NEW.branch_id IS NULL))
                    AND category = NEW.category
                    AND status = 'active'
            ) THEN
                INSERT INTO alerts (
                    type, severity, title, message, branch_id, category,
                    threshold_value, current_value, action_required
                ) VALUES (
                    'budget',
                    CASE 
                        WHEN percentage_used >= 100 THEN 'critical'
                        WHEN percentage_used >= 90 THEN 'high'
                        ELSE 'medium'
                    END,
                    CASE 
                        WHEN percentage_used >= 100 THEN 'Budget Exceeded'
                        ELSE 'Budget Alert'
                    END,
                    NEW.category || ' budget is ' || ROUND(percentage_used, 1) || '% used' ||
                    CASE 
                        WHEN branch_name IS NOT NULL THEN ' at ' || branch_name
                        ELSE ' (company-wide)'
                    END ||
                    ' ($' || spent_amount || ' of $' || budget_amount || ')',
                    NEW.branch_id,
                    NEW.category,
                    budget_amount,
                    spent_amount,
                    percentage_used >= 90
                );
            END IF;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply the budget check trigger
DROP TRIGGER IF EXISTS budget_check_trigger ON expenses;
CREATE TRIGGER budget_check_trigger
    AFTER INSERT OR UPDATE ON expenses
    FOR EACH ROW
    EXECUTE FUNCTION trigger_check_budget_on_expense();

-- Trigger to auto-generate SKU for new products if not provided
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

-- Trigger to refresh dashboard stats materialized view periodically
CREATE OR REPLACE FUNCTION trigger_refresh_dashboard_stats()
RETURNS TRIGGER AS $$
BEGIN
    -- Refresh the materialized view (this will be called by a scheduled job)
    PERFORM refresh_dashboard_stats();
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Function to set up periodic refresh of dashboard stats (call this manually or via cron)
CREATE OR REPLACE FUNCTION setup_dashboard_refresh()
RETURNS void AS $$
BEGIN
    -- This would typically be set up as a cron job or scheduled task
    -- For now, we'll just refresh it manually when needed
    PERFORM refresh_dashboard_stats();
END;
$$ LANGUAGE plpgsql;
