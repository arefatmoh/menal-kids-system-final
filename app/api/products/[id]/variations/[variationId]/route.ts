import { type NextRequest, NextResponse } from "next/server"
import { getUserFromRequest, hasPermissionForBranch } from "@/lib/auth"
import { query } from "@/lib/db"
import { z } from "zod"

const updateVariationSchema = z.object({
  color: z.string().optional(),
  size: z.string().optional(),
  price: z.number().positive().optional(),
  cost_price: z.number().positive().optional(),
  purchase_price: z.number().positive().optional(),
  min_stock_level: z.number().int().min(0).nullable().optional(),
  max_stock_level: z.number().int().min(0).nullable().optional(),
})

// GET /api/products/[id]/variations/[variationId] - Get a specific variation
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; variationId: string } }
) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const { id: productId, variationId } = params

    // Get variation with inventory info
    const result = await query(
      `SELECT 
        pv.*,
        p.name as product_name,
        p.sku as product_sku,
        i.quantity,
        i.min_stock_level,
        i.max_stock_level,
        i.branch_id,
        b.name as branch_name
      FROM product_variations pv
      JOIN products p ON pv.product_id = p.id
      LEFT JOIN inventory i ON pv.id = i.variation_id
      LEFT JOIN branches b ON i.branch_id = b.id
      WHERE pv.id = $1 AND pv.product_id = $2 AND pv.is_active = true`,
      [variationId, productId]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, error: "Variation not found" }, { status: 404 })
    }

    const variation = result.rows[0]

    return NextResponse.json({
      success: true,
      data: variation,
    })
  } catch (error) {
    console.error("Get variation error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}

// PUT /api/products/[id]/variations/[variationId] - Update a variation
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; variationId: string } }
) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const { id: productId, variationId } = params
    const body = await request.json()
    const validatedData = updateVariationSchema.parse(body)

    // Check if variation exists
    const variationResult = await query(
      "SELECT * FROM product_variations WHERE id = $1 AND product_id = $2 AND is_active = true",
      [variationId, productId]
    )

    if (variationResult.rows.length === 0) {
      return NextResponse.json({ success: false, error: "Variation not found" }, { status: 404 })
    }

    const variation = variationResult.rows[0]

    // Start transaction
    await query('BEGIN')

    try {
      // Update variation
      const updateFields: string[] = []
      const updateValues: any[] = []
      let paramCount = 0

      if (validatedData.color !== undefined) {
        paramCount++
        updateFields.push(`color = $${paramCount}`)
        updateValues.push(validatedData.color)
      }
      if (validatedData.size !== undefined) {
        paramCount++
        updateFields.push(`size = $${paramCount}`)
        updateValues.push(validatedData.size)
      }
      if (validatedData.price !== undefined) {
        paramCount++
        updateFields.push(`price = $${paramCount}`)
        updateValues.push(validatedData.price)
      }
      if (validatedData.cost_price !== undefined) {
        paramCount++
        updateFields.push(`cost_price = $${paramCount}`)
        updateValues.push(validatedData.cost_price)
      }
      if (validatedData.purchase_price !== undefined) {
        paramCount++
        updateFields.push(`purchase_price = $${paramCount}`)
        updateValues.push(validatedData.purchase_price)
      }

      if (updateFields.length > 0) {
        paramCount++
        updateFields.push(`updated_at = NOW()`)
        updateValues.push(variationId)

        await query(
          `UPDATE product_variations SET ${updateFields.join(', ')} WHERE id = $${paramCount}`,
          updateValues
        )
      }

      // Update inventory if stock levels are provided
      if (validatedData.min_stock_level !== undefined || validatedData.max_stock_level !== undefined) {
        const inventoryUpdateFields: string[] = []
        const inventoryUpdateValues: any[] = []
        let inventoryParamCount = 0

        if (validatedData.min_stock_level !== undefined) {
          inventoryParamCount++
          inventoryUpdateFields.push(`min_stock_level = $${inventoryParamCount}`)
          inventoryUpdateValues.push(validatedData.min_stock_level)
        }
        if (validatedData.max_stock_level !== undefined) {
          inventoryParamCount++
          inventoryUpdateFields.push(`max_stock_level = $${inventoryParamCount}`)
          inventoryUpdateValues.push(validatedData.max_stock_level)
        }

        if (inventoryUpdateFields.length > 0) {
          inventoryParamCount++
          inventoryUpdateFields.push(`updated_at = NOW()`)
          inventoryUpdateValues.push(variationId)

          await query(
            `UPDATE inventory SET ${inventoryUpdateFields.join(', ')} WHERE variation_id = $${inventoryParamCount}`,
            inventoryUpdateValues
          )
        }
      }

      await query('COMMIT')

      // Get updated variation
      const updatedResult = await query(
        "SELECT * FROM product_variations WHERE id = $1",
        [variationId]
      )

      return NextResponse.json(
        {
          success: true,
          data: updatedResult.rows[0],
          message: "Variation updated successfully",
        },
        { status: 200 },
      )
    } catch (error) {
      await query('ROLLBACK')
      throw error
    }
  } catch (error) {
    console.error("Update variation error:", error)

    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: error.errors[0].message }, { status: 400 })
    }

    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}

// DELETE /api/products/[id]/variations/[variationId] - Delete a variation
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; variationId: string } }
) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const { id: productId, variationId } = params

    // Check if variation exists
    const variationResult = await query(
      "SELECT * FROM product_variations WHERE id = $1 AND product_id = $2 AND is_active = true",
      [variationId, productId]
    )

    if (variationResult.rows.length === 0) {
      return NextResponse.json({ success: false, error: "Variation not found" }, { status: 404 })
    }

    // Start transaction
    await query('BEGIN')

    try {
      // Soft delete the variation
      await query(
        "UPDATE product_variations SET is_active = false, updated_at = NOW() WHERE id = $1",
        [variationId]
      )

      // Delete associated inventory records
      await query(
        "DELETE FROM inventory WHERE variation_id = $1",
        [variationId]
      )

      await query('COMMIT')

      return NextResponse.json(
        {
          success: true,
          message: "Variation deleted successfully",
        },
        { status: 200 },
      )
    } catch (error) {
      await query('ROLLBACK')
      throw error
    }
  } catch (error) {
    console.error("Delete variation error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
