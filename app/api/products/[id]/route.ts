import { type NextRequest, NextResponse } from "next/server"
import { getUserFromRequest, hasPermissionForBranch } from "@/lib/auth"
import { query } from "@/lib/db"
import { z } from "zod"

const updateProductSchema = z.object({
  name: z.string().min(1, "Product name is required").optional(),
  category_id: z.string().uuid("Invalid category ID").optional().or(z.literal("")),
  // Note: price and variant-specific fields are handled at variation level, not on products table
  color: z.string().optional(),
  size: z.string().optional(),
  price: z.number().positive("Price must be positive").optional(),
  cost_price: z.number().positive().optional(),
  purchase_price: z.number().positive().optional(),
  description: z.string().optional(),
  image_url: z.string().url("Invalid URL format").optional().or(z.literal("")),
  barcode: z.string().optional(),
  brand: z.string().optional(),
  age_range: z.string().optional(),
  gender: z.enum(["boys", "girls", "unisex"]).optional(),
  // Inventory fields for linked updates
  inventory_updates: z.array(z.object({
    branch_id: z.string().min(1, "Branch ID is required"),
    quantity: z.number().int().min(0, "Quantity must be non-negative"),
    min_stock_level: z.number().int().min(0).optional(),
    max_stock_level: z.number().int().min(0).optional(),
  })).optional(),
})

// PUT /api/products/[id] - Update product and linked inventory
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const productId = params.id
    const body = await request.json()
    const validatedData = updateProductSchema.parse(body)

    // Start a transaction to ensure both product and inventory updates succeed or fail together
    await query("BEGIN")

    try {
      // Build dynamic update query for product
      const productUpdateFields: string[] = []
      const productUpdateValues: any[] = []
      let paramCount = 0

      // Add product fields to update
      if (validatedData.name !== undefined) {
        paramCount++
        productUpdateFields.push(`name = $${paramCount}`)
        productUpdateValues.push(validatedData.name)
      }
      if (validatedData.category_id !== undefined) {
        paramCount++
        productUpdateFields.push(`category_id = $${paramCount}`)
        productUpdateValues.push(validatedData.category_id === "" ? null : validatedData.category_id)
      }
      // Skip variant-specific fields on products table to avoid DB errors
      if (validatedData.description !== undefined) {
        paramCount++
        productUpdateFields.push(`description = $${paramCount}`)
        productUpdateValues.push(validatedData.description === "" ? null : validatedData.description)
      }
      if (validatedData.image_url !== undefined) {
        paramCount++
        productUpdateFields.push(`image_url = $${paramCount}`)
        productUpdateValues.push(validatedData.image_url === "" ? null : validatedData.image_url)
      }
      if (validatedData.barcode !== undefined) {
        paramCount++
        productUpdateFields.push(`barcode = $${paramCount}`)
        productUpdateValues.push(validatedData.barcode === "" ? null : validatedData.barcode)
      }
      if (validatedData.brand !== undefined) {
        paramCount++
        productUpdateFields.push(`brand = $${paramCount}`)
        productUpdateValues.push(validatedData.brand === "" ? null : validatedData.brand)
      }
      if (validatedData.age_range !== undefined) {
        paramCount++
        productUpdateFields.push(`age_range = $${paramCount}`)
        productUpdateValues.push(validatedData.age_range === "" ? null : validatedData.age_range)
      }
      if (validatedData.gender !== undefined) {
        paramCount++
        productUpdateFields.push(`gender = $${paramCount}`)
        productUpdateValues.push(validatedData.gender)
      }

      // Add updated_at field
      paramCount++
      productUpdateFields.push(`updated_at = $${paramCount}`)
      productUpdateValues.push(new Date())

      // Add product ID to values
      paramCount++
      productUpdateValues.push(productId)

      // Update product if there are fields to update
      if (productUpdateFields.length > 0) {
        const productUpdateQuery = `
          UPDATE products 
          SET ${productUpdateFields.join(", ")}
          WHERE id = $${paramCount}
          RETURNING *
        `
        const productResult = await query(productUpdateQuery, productUpdateValues)
        
        if (productResult.rows.length === 0) {
          await query("ROLLBACK")
          return NextResponse.json({ success: false, error: "Product not found" }, { status: 404 })
        }
      }

      // Update inventory if inventory_updates are provided
      if (validatedData.inventory_updates && validatedData.inventory_updates.length > 0) {
        for (const inventoryUpdate of validatedData.inventory_updates) {
          // Check branch permission
          if (!hasPermissionForBranch(user, inventoryUpdate.branch_id)) {
            await query("ROLLBACK")
            return NextResponse.json({ success: false, error: "Access denied to this branch" }, { status: 403 })
          }

          // Update or insert inventory
          await query(
            `INSERT INTO inventory (product_id, branch_id, quantity, min_stock_level, max_stock_level)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (product_id, branch_id)
             DO UPDATE SET
               quantity = EXCLUDED.quantity,
               min_stock_level = COALESCE(EXCLUDED.min_stock_level, inventory.min_stock_level),
               max_stock_level = COALESCE(EXCLUDED.max_stock_level, inventory.max_stock_level),
               updated_at = NOW()
             RETURNING *`,
            [
              productId,
              inventoryUpdate.branch_id,
              inventoryUpdate.quantity,
              inventoryUpdate.min_stock_level || 5,
              inventoryUpdate.max_stock_level || 100,
            ],
          )
        }
      }

      await query("COMMIT")

      // Get updated product with inventory info
      const updatedProductQuery = `
        SELECT 
          p.*,
          c.name as category_name,
          COALESCE(SUM(i.quantity), 0) as total_stock,
          COUNT(i.id) as branch_count
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        LEFT JOIN inventory i ON p.id = i.product_id
        WHERE p.id = $1
        GROUP BY p.id, c.name
      `
      const updatedProductResult = await query(updatedProductQuery, [productId])

      return NextResponse.json({
        success: true,
        data: updatedProductResult.rows[0],
        message: "Product updated successfully",
      })
    } catch (error) {
      await query("ROLLBACK")
      throw error
    }
  } catch (error) {
    console.error("Update product error:", error)

    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: error.errors[0].message }, { status: 400 })
    }

    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}

// DELETE /api/products/[id] - Delete product
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const productId = params.id
    const { searchParams } = new URL(request.url)
    const hardDelete = searchParams.get('hard') === 'true'

    // Start a transaction
    await query("BEGIN")

    try {
      // Check if product exists and get its details
      const productCheckQuery = `
        SELECT p.id, p.name, p.product_type, COUNT(i.id) as inventory_count, COUNT(pv.id) as variation_count
        FROM products p
        LEFT JOIN inventory i ON p.id = i.product_id
        LEFT JOIN product_variations pv ON p.id = pv.product_id AND pv.is_active = true
        WHERE p.id = $1
        GROUP BY p.id, p.name, p.product_type
      `
      const productCheck = await query(productCheckQuery, [productId])

      if (productCheck.rows.length === 0) {
        await query("ROLLBACK")
        return NextResponse.json({ success: false, error: "Product not found" }, { status: 404 })
      }

      const product = productCheck.rows[0]

      if (hardDelete) {
        // HARD DELETE - Permanently remove everything
        
        // Delete related inventory records first
        await query("DELETE FROM inventory WHERE product_id = $1", [productId])
        
        // Delete related stock movements
        await query("DELETE FROM stock_movements WHERE product_id = $1", [productId])
        
        // Delete related sale items
        await query("DELETE FROM sale_items WHERE product_id = $1", [productId])
        
        // Delete related transfer items
        await query("DELETE FROM transfer_items WHERE product_id = $1", [productId])
        
        // Delete product variations (this will cascade to inventory due to ON DELETE CASCADE)
        if (product.product_type === 'variation') {
          await query("DELETE FROM product_variations WHERE product_id = $1", [productId])
        }
        
        // Finally delete the product itself
        await query("DELETE FROM products WHERE id = $1", [productId])
        
        await query("COMMIT")
        
        return NextResponse.json({
          success: true,
          message: "Product permanently deleted from database",
          deletedProduct: {
            id: productId,
            name: product.name,
            productType: product.product_type,
            inventoryCount: product.inventory_count,
            variationCount: product.variation_count
          }
        })
      } else {
        // SOFT DELETE - Set is_active to false (current behavior)
        
        // Delete related inventory records first
        await query("DELETE FROM inventory WHERE product_id = $1", [productId])
        
        // Delete related stock movements
        await query("DELETE FROM stock_movements WHERE product_id = $1", [productId])
        
        // Soft delete product variations
        if (product.product_type === 'variation') {
          await query("UPDATE product_variations SET is_active = false, updated_at = NOW() WHERE product_id = $1", [productId])
        }
        
        // Soft delete the product (set is_active to false)
        await query("UPDATE products SET is_active = false, updated_at = NOW() WHERE id = $1", [productId])

        await query("COMMIT")

        return NextResponse.json({
          success: true,
          message: "Product deactivated (soft deleted)",
          deletedProduct: {
            id: productId,
            name: product.name,
            productType: product.product_type,
            inventoryCount: product.inventory_count,
            variationCount: product.variation_count
          }
        })
      }
    } catch (error) {
      await query("ROLLBACK")
      throw error
    }
  } catch (error) {
    console.error("Delete product error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
} 