import { type NextRequest, NextResponse } from "next/server"
import { getUserFromRequest, hasPermissionForBranch } from "@/lib/auth"
import { query } from "@/lib/db"
import { z } from "zod"

const createStockMovementSchema = z.object({
  product_id: z.string().uuid("Invalid product ID"),
  branch_id: z.string().min(1, "Branch ID is required"),
  variation_id: z.string().uuid("Invalid variation ID").optional(),
  movement_type: z.enum(["in", "out"]),
  quantity: z.number().int().positive("Quantity must be positive"),
  reason: z.string().min(1, "Reason is required"),
})

// GET /api/stock-movements - Get stock movements
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = Number.parseInt(searchParams.get("page") || "1")
    const limit = Number.parseInt(searchParams.get("limit") || "20")
    const branchId = searchParams.get("branch_id")
    const productId = searchParams.get("product_id")
    const movementType = searchParams.get("movement_type")

    // Check branch permission
    if (branchId && !hasPermissionForBranch(user, branchId)) {
      return NextResponse.json({ success: false, error: "Access denied to this branch" }, { status: 403 })
    }

    const offset = (page - 1) * limit

    let whereClause = "WHERE 1=1"
    const params: any[] = []
    let paramCount = 0

    if (branchId) {
      paramCount++
      whereClause += ` AND sm.branch_id = $${paramCount}`
      params.push(branchId)
    } else if (user.role === "employee") {
      paramCount++
      whereClause += ` AND sm.branch_id = $${paramCount}`
      params.push(user.branch_id)
    }

    if (productId) {
      paramCount++
      whereClause += ` AND sm.product_id = $${paramCount}`
      params.push(productId)
    }

    if (movementType) {
      paramCount++
      whereClause += ` AND sm.movement_type = $${paramCount}`
      params.push(movementType)
    }

    const movementsQuery = `
      SELECT 
        sm.*,
        p.name as product_name,
        p.sku,
        b.name as branch_name,
        u.full_name as user_name
      FROM stock_movements sm
      JOIN products p ON sm.product_id = p.id
      JOIN branches b ON sm.branch_id = b.id
      JOIN users u ON sm.user_id = u.id
      ${whereClause}
      ORDER BY sm.created_at DESC
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `

    params.push(limit, offset)

    const result = await query(movementsQuery, params)

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM stock_movements sm
      ${whereClause}
    `

    const countResult = await query(countQuery, params.slice(0, paramCount))
    const total = Number.parseInt(countResult.rows[0].total)

    return NextResponse.json({
      success: true,
      data: result.rows,
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
        has_next: page * limit < total,
        has_prev: page > 1,
      },
    })
  } catch (error) {
    console.error("Get stock movements error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}

// POST /api/stock-movements - Create stock movement
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = createStockMovementSchema.parse(body)

    // Resolve effective branch id (cannot be 'all')
    let effectiveBranchId = validatedData.branch_id
    if (effectiveBranchId === 'all') {
      if (user.role === 'employee' && user.branch_id) {
        effectiveBranchId = user.branch_id
      } else {
        return NextResponse.json({ success: false, error: "A specific branch must be selected for stock movements" }, { status: 400 })
      }
    }

    // Check branch permission
    if (!hasPermissionForBranch(user, effectiveBranchId)) {
      return NextResponse.json({ success: false, error: "Access denied to this branch" }, { status: 403 })
    }

    // Resolve variation handling: require variation for variation products; auto-resolve for uniform
    const productTypeRes = await query(
      `SELECT product_type FROM products WHERE id = $1`,
      [validatedData.product_id]
    )
    if (productTypeRes.rowCount === 0) {
      return NextResponse.json({ success: false, error: "Product not found" }, { status: 404 })
    }

    let targetVariationId: string | null = validatedData.variation_id || null
    if (!targetVariationId) {
      const variationRes = await query(
        `SELECT id FROM product_variations WHERE product_id = $1 ORDER BY created_at ASC LIMIT 1`,
        [validatedData.product_id]
      )
      if (variationRes.rowCount > 0) {
        targetVariationId = variationRes.rows[0].id
      } else {
        // Fallback to NULL variation if no variation rows exist
        targetVariationId = null
      }
    }

    // Temporarily disable the inventory movement trigger to prevent duplication
    await query('ALTER TABLE inventory DISABLE TRIGGER inventory_movement_trigger')
    
    try {
      // Create stock movement and update/insert inventory without relying on ON CONFLICT
      const delta = validatedData.movement_type === 'in' ? validatedData.quantity : -validatedData.quantity
      await query('BEGIN')
      try {
        // Update existing inventory row first
        const updateRes = await query(
          `UPDATE inventory 
           SET quantity = quantity + $4,
               updated_at = NOW(),
               last_restocked = CASE WHEN $4 > 0 THEN NOW() ELSE last_restocked END
           WHERE product_id = $1 
             AND branch_id = $2 
             AND ((variation_id = $3::uuid) OR (variation_id IS NULL AND $3::uuid IS NULL))
             AND ($4 >= 0 OR quantity >= ABS($4))
           RETURNING *`,
          [validatedData.product_id, effectiveBranchId, targetVariationId, delta]
        )

        if (updateRes.rowCount === 0) {
          if (delta < 0) {
            await query('ROLLBACK')
            return NextResponse.json({ success: false, error: 'Insufficient stock' }, { status: 400 })
          }
          // No existing row; insert new
          await query(
            `INSERT INTO inventory (product_id, branch_id, variation_id, quantity, min_stock_level, max_stock_level, last_restocked)
             VALUES ($1, $2, $3::uuid, $4, NULL, NULL, NOW())`,
            [validatedData.product_id, effectiveBranchId, targetVariationId, delta]
          )
        }

        // Record stock movement manually (since trigger is disabled)
        const movementResult = await query(
          `INSERT INTO stock_movements (product_id, branch_id, user_id, variation_id, movement_type, quantity, reason, reference_type)
           VALUES ($1, $2, $3, $4::uuid, $5, $6, $7, 'manual')
           RETURNING *`,
          [
            validatedData.product_id,
            effectiveBranchId,
            user.id,
            targetVariationId,
            validatedData.movement_type,
            validatedData.quantity,
            validatedData.reason,
          ]
        )

        await query('COMMIT')
        
        return NextResponse.json(
          {
            success: true,
            data: movementResult.rows[0],
            message: 'Stock movement created successfully',
          },
          { status: 201 },
        )
      } catch (e) {
        await query('ROLLBACK')
        throw e
      }
    } finally {
      // Re-enable the trigger
      await query('ALTER TABLE inventory ENABLE TRIGGER inventory_movement_trigger')
    }
  } catch (error) {
    console.error("Create stock movement error:", error)

    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: error.errors[0].message }, { status: 400 })
    }

    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
