-- Fix for the SKU generation trigger
-- This script fixes the error: "record 'new' has no field 'color'"

-- Drop the existing trigger first
DROP TRIGGER IF EXISTS generate_sku_trigger ON products;

-- Update the trigger function to remove references to color and size fields
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

-- Recreate the trigger
CREATE TRIGGER generate_sku_trigger
    BEFORE INSERT ON products
    FOR EACH ROW
    EXECUTE FUNCTION trigger_generate_product_sku();

-- Also update the generate_sku function to handle null color/size gracefully
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
