-- Comprehensive Database Fix Script
-- This script fixes ALL missing columns and database issues

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Fix sales table missing columns
DO $$
BEGIN
    -- Add discount column if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'sales' AND column_name = 'discount'
    ) THEN
        ALTER TABLE sales ADD COLUMN discount DECIMAL(10,2) DEFAULT 0;
        RAISE NOTICE 'Added discount column to sales table';
    END IF;
    
    -- Add notes column if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'sales' AND column_name = 'notes'
    ) THEN
        ALTER TABLE sales ADD COLUMN notes TEXT;
        RAISE NOTICE 'Added notes column to sales table';
    END IF;
    
    -- Add updated_at column if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'sales' AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE sales ADD COLUMN updated_at TIMESTAMP DEFAULT NOW();
        RAISE NOTICE 'Added updated_at column to sales table';
    END IF;
END $$;

-- 2. Fix stock_movements table missing columns
DO $$
BEGIN
    -- Add reason column if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'stock_movements' AND column_name = 'reason'
    ) THEN
        ALTER TABLE stock_movements ADD COLUMN reason VARCHAR(500);
        RAISE NOTICE 'Added reason column to stock_movements table';
    END IF;
    
    -- Add reference_type column if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'stock_movements' AND column_name = 'reference_type'
    ) THEN
        ALTER TABLE stock_movements ADD COLUMN reference_type VARCHAR(50);
        RAISE NOTICE 'Added reference_type column to stock_movements table';
    END IF;
    
    -- Add reference_id column if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'stock_movements' AND column_name = 'reference_id'
    ) THEN
        ALTER TABLE stock_movements ADD COLUMN reference_id UUID;
        RAISE NOTICE 'Added reference_id column to stock_movements table';
    END IF;
    
    -- Add variation_id column if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'stock_movements' AND column_name = 'variation_id'
    ) THEN
        ALTER TABLE stock_movements ADD COLUMN variation_id UUID REFERENCES product_variations(id);
        CREATE INDEX IF NOT EXISTS idx_stock_movements_variation_id ON stock_movements(variation_id);
        RAISE NOTICE 'Added variation_id column to stock_movements table';
    END IF;
END $$;

-- 3. Fix inventory table missing columns
DO $$
BEGIN
    -- Add variation_id column if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'inventory' AND column_name = 'variation_id'
    ) THEN
        ALTER TABLE inventory ADD COLUMN variation_id UUID REFERENCES product_variations(id);
        CREATE INDEX IF NOT EXISTS idx_inventory_variation_id ON inventory(variation_id);
        RAISE NOTICE 'Added variation_id column to inventory table';
    END IF;
    
    -- Add updated_at column if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'inventory' AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE inventory ADD COLUMN updated_at TIMESTAMP DEFAULT NOW();
        RAISE NOTICE 'Added updated_at column to inventory table';
    END IF;
END $$;

-- 4. Fix sale_items table missing columns
DO $$
BEGIN
    -- Add variation_id column if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'sale_items' AND column_name = 'variation_id'
    ) THEN
        ALTER TABLE sale_items ADD COLUMN variation_id UUID REFERENCES product_variations(id);
        CREATE INDEX IF NOT EXISTS idx_sale_items_variation_id ON sale_items(variation_id);
        RAISE NOTICE 'Added variation_id column to sale_items table';
    END IF;
END $$;

-- 5. Fix transfer_items table missing columns
DO $$
BEGIN
    -- Add variation_id column if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'transfer_items' AND column_name = 'variation_id'
    ) THEN
        ALTER TABLE transfer_items ADD COLUMN variation_id UUID REFERENCES product_variations(id);
        CREATE INDEX IF NOT EXISTS idx_transfer_items_variation_id ON transfer_items(variation_id);
        RAISE NOTICE 'Added variation_id column to transfer_items table';
    END IF;
END $$;

-- 6. Fix transfers table missing columns
DO $$
BEGIN
    -- Add notes column if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'transfers' AND column_name = 'notes'
    ) THEN
        ALTER TABLE transfers ADD COLUMN notes TEXT;
        RAISE NOTICE 'Added notes column to transfers table';
    END IF;
    
    -- Add requested_at column if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'transfers' AND column_name = 'requested_at'
    ) THEN
        ALTER TABLE transfers ADD COLUMN requested_at TIMESTAMP DEFAULT NOW();
        RAISE NOTICE 'Added requested_at column to transfers table';
    END IF;
    
    -- Add approved_at column if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'transfers' AND column_name = 'approved_at'
    ) THEN
        ALTER TABLE transfers ADD COLUMN approved_at TIMESTAMP;
        RAISE NOTICE 'Added approved_at column to transfers table';
    END IF;
    
    -- Add completed_at column if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'transfers' AND column_name = 'completed_at'
    ) THEN
        ALTER TABLE transfers ADD COLUMN completed_at TIMESTAMP;
        RAISE NOTICE 'Added completed_at column to transfers table';
    END IF;
    
    -- Add updated_at column if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'transfers' AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE transfers ADD COLUMN updated_at TIMESTAMP DEFAULT NOW();
        RAISE NOTICE 'Added updated_at column to transfers table';
    END IF;
END $$;

-- 7. Fix alerts table missing columns
DO $$
BEGIN
    -- Add threshold_value column if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'alerts' AND column_name = 'threshold_value'
    ) THEN
        ALTER TABLE alerts ADD COLUMN threshold_value DECIMAL(10,2);
        RAISE NOTICE 'Added threshold_value column to alerts table';
    END IF;
    
    -- Add current_value column if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'alerts' AND column_name = 'current_value'
    ) THEN
        ALTER TABLE alerts ADD COLUMN current_value DECIMAL(10,2);
        RAISE NOTICE 'Added current_value column to alerts table';
    END IF;
    
    -- Add action_required column if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'alerts' AND column_name = 'action_required'
    ) THEN
        ALTER TABLE alerts ADD COLUMN action_required BOOLEAN DEFAULT FALSE;
        RAISE NOTICE 'Added action_required column to alerts table';
    END IF;
    
    -- Add acknowledged_at column if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'alerts' AND column_name = 'acknowledged_at'
    ) THEN
        ALTER TABLE alerts ADD COLUMN acknowledged_at TIMESTAMP;
        RAISE NOTICE 'Added acknowledged_at column to alerts table';
    END IF;
    
    -- Add resolved_at column if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'alerts' AND column_name = 'resolved_at'
    ) THEN
        ALTER TABLE alerts ADD COLUMN resolved_at TIMESTAMP;
        RAISE NOTICE 'Added resolved_at column to alerts table';
    END IF;
    
    -- Add updated_at column if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'alerts' AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE alerts ADD COLUMN updated_at TIMESTAMP DEFAULT NOW();
        RAISE NOTICE 'Added updated_at column to alerts table';
    END IF;
END $$;

-- 8. Create or replace essential functions
CREATE OR REPLACE FUNCTION generate_sku(p_category_name VARCHAR, p_color VARCHAR DEFAULT NULL, p_size VARCHAR DEFAULT NULL)
RETURNS VARCHAR AS $$
DECLARE
    category_code VARCHAR(3);
    color_code VARCHAR(2);
    size_code VARCHAR(2);
    sequence_num INTEGER;
    new_sku VARCHAR(100);
BEGIN
    -- Generate category code (first 3 letters, uppercase)
    category_code := UPPER(LEFT(REGEXP_REPLACE(p_category_name, '[^A-Za-z]', '', 'g'), 3));
    
    -- Generate color code if provided
    color_code := CASE 
        WHEN p_color IS NOT NULL AND p_color != '' THEN UPPER(LEFT(REGEXP_REPLACE(p_color, '[^A-Za-z]', '', 'g'), 2))
        ELSE ''
    END;
    
    -- Generate size code if provided
    size_code := CASE 
        WHEN p_size IS NOT NULL AND p_size != '' THEN UPPER(LEFT(REGEXP_REPLACE(p_size, '[^A-Za-z0-9]', '', 'g'), 2))
        ELSE ''
    END;
    
    -- Get next sequence number for this category
    SELECT COALESCE(MAX(CAST(RIGHT(sku, 4) AS INTEGER)), 0) + 1 
    INTO sequence_num
    FROM products 
    WHERE sku LIKE category_code || '%';
    
    -- Construct SKU
    new_sku := category_code || color_code || size_code || LPAD(sequence_num::TEXT, 4, '0');
    
    RETURN new_sku;
END;
$$ LANGUAGE plpgsql;

-- 9. Create or replace the SKU generation trigger
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

-- 10. Create or replace the tableHasColumn function (used by the API)
CREATE OR REPLACE FUNCTION tableHasColumn(p_table_name TEXT, p_column_name TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = p_table_name 
        AND column_name = p_column_name
    );
END;
$$ LANGUAGE plpgsql;

-- 11. Verify all required objects exist
SELECT 
    'Tables' as object_type,
    table_name as object_name,
    'OK' as status
FROM information_schema.tables 
WHERE table_name IN ('sales', 'sale_items', 'products', 'categories', 'inventory', 'stock_movements', 'transfers', 'transfer_items', 'users', 'branches', 'product_variations', 'alerts')
AND table_schema = 'public'

UNION ALL

SELECT 
    'Columns' as object_type,
    table_name || '.' || column_name as object_name,
    'OK' as status
FROM information_schema.columns 
WHERE table_name IN ('sales', 'sale_items', 'inventory', 'stock_movements', 'transfer_items', 'transfers', 'alerts')
AND column_name IN ('discount', 'notes', 'updated_at', 'variation_id', 'reason', 'reference_type', 'reference_id', 'requested_at', 'approved_at', 'completed_at', 'threshold_value', 'current_value', 'action_required', 'acknowledged_at', 'resolved_at')
AND table_schema = 'public'

UNION ALL

SELECT 
    'Functions' as object_type,
    routine_name as object_name,
    'OK' as status
FROM information_schema.routines 
WHERE routine_name IN ('generate_sku', 'trigger_generate_product_sku', 'tableHasColumn')
AND routine_schema = 'public'

ORDER BY object_type, object_name;
