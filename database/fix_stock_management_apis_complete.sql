-- Comprehensive fix for all stock management APIs
-- This script fixes all database issues preventing stock operations from working

-- 1. Add missing variation_id column to stock_movements table
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'stock_movements' 
        AND column_name = 'variation_id'
    ) THEN
        ALTER TABLE stock_movements 
        ADD COLUMN variation_id UUID REFERENCES product_variations(id);
        
        RAISE NOTICE 'Added variation_id column to stock_movements table';
    ELSE
        RAISE NOTICE 'variation_id column already exists in stock_movements table';
    END IF;
END $$;

-- 2. Fix alerts table - add missing columns
DO $$ 
BEGIN
    -- Add category column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'alerts' 
        AND column_name = 'category'
    ) THEN
        ALTER TABLE alerts 
        ADD COLUMN category VARCHAR(100);
        
        RAISE NOTICE 'Added category column to alerts table';
    ELSE
        RAISE NOTICE 'category column already exists in alerts table';
    END IF;
    
    -- Add threshold_value column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'alerts' 
        AND column_name = 'threshold_value'
    ) THEN
        ALTER TABLE alerts 
        ADD COLUMN threshold_value DECIMAL(10,2);
        
        RAISE NOTICE 'Added threshold_value column to alerts table';
    ELSE
        RAISE NOTICE 'threshold_value column already exists in alerts table';
    END IF;
    
    -- Add current_value column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'alerts' 
        AND column_name = 'current_value'
    ) THEN
        ALTER TABLE alerts 
        ADD COLUMN current_value DECIMAL(10,2);
        
        RAISE NOTICE 'Added current_value column to alerts table';
    ELSE
        RAISE NOTICE 'current_value column already exists in alerts table';
    END IF;
    
    -- Add action_required column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'alerts' 
        AND column_name = 'action_required'
    ) THEN
        ALTER TABLE alerts 
        ADD COLUMN action_required BOOLEAN DEFAULT FALSE;
        
        RAISE NOTICE 'Added action_required column to alerts table';
    ELSE
        RAISE NOTICE 'action_required column already exists in alerts table';
    END IF;
    
    -- Add notes column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'alerts' 
        AND column_name = 'notes'
    ) THEN
        ALTER TABLE alerts 
        ADD COLUMN notes TEXT;
        
        RAISE NOTICE 'Added notes column to alerts table';
    ELSE
        RAISE NOTICE 'notes column already exists in alerts table';
    END IF;
    
    -- Add acknowledged_at column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'alerts' 
        AND column_name = 'acknowledged_at'
    ) THEN
        ALTER TABLE alerts 
        ADD COLUMN acknowledged_at TIMESTAMP;
        
        RAISE NOTICE 'Added acknowledged_at column to alerts table';
    ELSE
        RAISE NOTICE 'acknowledged_at column already exists in alerts table';
    END IF;
    
    -- Add resolved_at column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'alerts' 
        AND column_name = 'resolved_at'
    ) THEN
        ALTER TABLE alerts 
        ADD COLUMN resolved_at TIMESTAMP;
        
        RAISE NOTICE 'Added resolved_at column to alerts table';
    ELSE
        RAISE NOTICE 'resolved_at column already exists in alerts table';
    END IF;
    
    -- Add updated_at column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'alerts' 
        AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE alerts 
        ADD COLUMN updated_at TIMESTAMP DEFAULT NOW();
        
        RAISE NOTICE 'Added updated_at column to alerts table';
    ELSE
        RAISE NOTICE 'updated_at column already exists in alerts table';
    END IF;
END $$;

-- 3. Fix inventory table - add missing columns
DO $$ 
BEGIN
    -- Add updated_at column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'inventory' 
        AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE inventory 
        ADD COLUMN updated_at TIMESTAMP DEFAULT NOW();
        
        RAISE NOTICE 'Added updated_at column to inventory table';
    ELSE
        RAISE NOTICE 'updated_at column already exists in inventory table';
    END IF;
    
    -- Add min_stock_level and max_stock_level if they don't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'inventory' 
        AND column_name = 'min_stock_level'
    ) THEN
        ALTER TABLE inventory 
        ADD COLUMN min_stock_level INTEGER DEFAULT 0;
        
        RAISE NOTICE 'Added min_stock_level column to inventory table';
    ELSE
        RAISE NOTICE 'min_stock_level column already exists in inventory table';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'inventory' 
        AND column_name = 'max_stock_level'
    ) THEN
        ALTER TABLE inventory 
        ADD COLUMN max_stock_level INTEGER DEFAULT 1000;
        
        RAISE NOTICE 'Added max_stock_level column to inventory table';
    ELSE
        RAISE NOTICE 'max_stock_level column already exists in inventory table';
    END IF;
END $$;

-- 4. Ensure inventory table has proper unique constraints
-- Drop existing constraint if it exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'inventory_product_variation_branch_key'
    ) THEN
        ALTER TABLE inventory DROP CONSTRAINT inventory_product_variation_branch_key;
        RAISE NOTICE 'Dropped existing unique constraint';
    END IF;
END $$;

-- Add proper unique constraint that handles NULL variation_id correctly
ALTER TABLE inventory 
ADD CONSTRAINT inventory_product_variation_branch_key 
UNIQUE (product_id, COALESCE(variation_id, '00000000-0000-0000-0000-000000000000'::uuid), branch_id);

-- 5. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_inventory_product_branch ON inventory(product_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_inventory_variation_branch ON inventory(variation_id, branch_id) WHERE variation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_stock_movements_product_branch ON stock_movements(product_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_variation ON stock_movements(variation_id) WHERE variation_id IS NOT NULL;

-- 6. Fix the low stock trigger function
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
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error in low stock trigger: %', SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 7. Recreate the low stock trigger
DROP TRIGGER IF EXISTS low_stock_alert_trigger ON inventory;
CREATE TRIGGER low_stock_alert_trigger
    AFTER UPDATE ON inventory
    FOR EACH ROW
    EXECUTE FUNCTION trigger_check_low_stock();

-- 8. Create a function to safely update inventory
CREATE OR REPLACE FUNCTION update_inventory_safe(
    p_product_id UUID,
    p_variation_id UUID DEFAULT NULL,
    p_branch_id VARCHAR(50),
    p_quantity_change INTEGER,
    p_movement_type VARCHAR(10)
) RETURNS BOOLEAN AS $$
DECLARE
    current_quantity INTEGER;
    new_quantity INTEGER;
BEGIN
    -- Get current quantity
    SELECT COALESCE(quantity, 0) INTO current_quantity
    FROM inventory 
    WHERE product_id = p_product_id 
      AND variation_id IS NOT DISTINCT FROM p_variation_id 
      AND branch_id = p_branch_id;
    
    -- Calculate new quantity
    IF p_movement_type = 'in' THEN
        new_quantity := current_quantity + p_quantity_change;
    ELSE
        new_quantity := GREATEST(0, current_quantity - p_quantity_change);
    END IF;
    
    -- Update or insert inventory record
    IF current_quantity IS NULL THEN
        -- Insert new record
        INSERT INTO inventory (
            product_id, variation_id, branch_id, quantity, 
            min_stock_level, max_stock_level, created_at, updated_at
        ) VALUES (
            p_product_id, p_variation_id, p_branch_id, new_quantity,
            0, 1000, NOW(), NOW()
        );
    ELSE
        -- Update existing record
        UPDATE inventory 
        SET quantity = new_quantity, updated_at = NOW()
        WHERE product_id = p_product_id 
          AND variation_id IS NOT DISTINCT FROM p_variation_id 
          AND branch_id = p_branch_id;
    END IF;
    
    RETURN TRUE;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error updating inventory: %', SQLERRM;
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- 9. Verify the fixes
SELECT 'Database fixes completed successfully' as status;

-- Show table structure
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name IN ('stock_movements', 'inventory', 'alerts')
ORDER BY table_name, ordinal_position;

-- Show constraints
SELECT 
    tc.table_name,
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_name IN ('stock_movements', 'inventory', 'alerts')
ORDER BY tc.table_name, tc.constraint_name;
