export const dynamic = 'force-dynamic'
import { type NextRequest, NextResponse } from "next/server"
import { getUserFromRequest, hasPermissionForBranch } from "@/lib/auth"
import { query, transaction } from "@/lib/db"

// GET /api/stock-movements - Get stock movements
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = Number.parseInt(searchParams.get("page") || "1")
    const limit = Number.parseInt(searchParams.get("limit") || "50")
    const branchId = searchParams.get("branch_id")

    // Check permissions
    if (branchId && !hasPermissionForBranch(user, branchId)) {
      return NextResponse.json({ success: false, error: "Access denied to this branch" }, { status: 403 })
    }

    // Build WHERE clause for branch filtering
    const whereClause = branchId ? "WHERE sm.branch_id = $1" : ""
    const params = branchId ? [branchId] : []
    
    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM stock_movements sm
      ${whereClause}
    `
    const countResult = await query(countQuery, params)
    const total = countResult.rows[0]?.total || 0

    // Get stock movements with pagination
    const offset = (page - 1) * limit
    const movementsQuery = `
      SELECT 
        sm.id,
        sm.product_id,
        sm.movement_type,
        sm.quantity,
        sm.reason,
        sm.branch_id,
        sm.created_at,
        p.name as product_name,
        p.sku,
        b.name as branch_name
      FROM stock_movements sm
      JOIN products p ON sm.product_id = p.id
      JOIN branches b ON sm.branch_id = b.id
      ${whereClause}
      ORDER BY sm.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `
    
    const movementsParams = [...params, limit, offset]
    const movementsResult = await query(movementsQuery, movementsParams)

    return NextResponse.json({
      success: true,
      data: movementsResult.rows,
      pagination: {
        current_page: page,
        total_pages: Math.ceil(total / limit),
        total_count: total,
        limit
      }
    })
  } catch (error) {
    console.error("Stock movements fetch error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}

// POST /api/stock-movements - Create stock movement
export async function POST(request: NextRequest) {
  // Declare request-scoped variables so catch can safely reference them even if parsing fails
  let product_id: string | undefined
  let branch_id: string | undefined
  let movement_type: 'in' | 'out' | undefined
  let quantity: number | undefined
  let reason: string | undefined
  let variation_id: string | null | undefined
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    ;({ product_id, branch_id, movement_type, quantity, reason, variation_id } = body)

    // Validate required fields
    if (!product_id || !branch_id || !movement_type || !quantity || !reason) {
      return NextResponse.json({ 
        success: false, 
        error: "Missing required fields: product_id, branch_id, movement_type, quantity, reason" 
      }, { status: 400 })
    }

    // Check permissions
    if (!hasPermissionForBranch(user, branch_id)) {
      return NextResponse.json({ success: false, error: "Access denied to this branch" }, { status: 403 })
    }

    // Validate movement type
    if (!['in', 'out'].includes(movement_type)) {
      return NextResponse.json({ 
        success: false, 
        error: "Invalid movement_type. Must be 'in' or 'out'" 
      }, { status: 400 })
    }

    // Validate quantity
    if (typeof quantity !== 'number' || quantity <= 0) {
      return NextResponse.json({ 
        success: false, 
        error: "Quantity must be a positive number" 
      }, { status: 400 })
    }

    // Check if product exists
    const productCheck = await query("SELECT id FROM products WHERE id = $1", [product_id])
    if (productCheck.rows.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: "Product not found" 
      }, { status: 404 })
    }

    // Check if branch exists
    const branchCheck = await query("SELECT id FROM branches WHERE id = $1", [branch_id])
    if (branchCheck.rows.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: "Branch not found" 
      }, { status: 404 })
    }

    // Perform inventory change using direct SQL - triggers will handle logging automatically
    // Detect if product is uniform (no variations). If so, always operate on NULL-variation row
    const variationCountRes = await query(
      `SELECT COUNT(*)::int AS cnt FROM product_variations WHERE product_id = $1`,
      [product_id]
    )
    const isUniformProduct = (variationCountRes.rows[0]?.cnt || 0) === 0
    if (movement_type === 'in') {
      // Add stock - same as add stock flow
      if (variation_id && !isUniformProduct) {
        // Update variation inventory (upsert)
        await query(`
          INSERT INTO inventory (product_id, variation_id, branch_id, quantity, min_stock_level, max_stock_level)
          VALUES ($1, $2, $3, $4, 0, 1000)
          ON CONFLICT (product_id, variation_id, branch_id)
          DO UPDATE SET quantity = inventory.quantity + EXCLUDED.quantity,
                        updated_at = NOW()
        `, [product_id, variation_id, branch_id, quantity])
      } else {
        // Uniform products: upsert NULL-variation row
        const updated = await query(`
          UPDATE inventory 
          SET quantity = quantity + $2, updated_at = NOW()
          WHERE product_id = $1 AND variation_id IS NULL AND branch_id = $3
        `, [product_id, quantity, branch_id])
        if (updated.rowCount === 0) {
          await query(`
            INSERT INTO inventory (product_id, variation_id, branch_id, quantity, min_stock_level, max_stock_level)
            VALUES ($1, NULL, $2, $3, 0, 1000)
          `, [product_id, branch_id, quantity])
        }
      }
    } else {
      // Reduce stock - allow reduction as long as final quantity >= 0
      if (variation_id && !isUniformProduct) {
        // Try to find variation-specific row first
        let stockRow = await query(`
          SELECT id, quantity, variation_id FROM inventory 
          WHERE product_id = $1 AND variation_id = $2 AND branch_id = $3
        `, [product_id, variation_id, branch_id])

        // If missing or insufficient, try NULL-variation row (legacy uniform stock)
        let targetId: string | null = stockRow.rows[0]?.id || null
        let availableQty = stockRow.rows[0]?.quantity || 0
        if (!targetId || availableQty < quantity) {
          const nullRow = await query(`
            SELECT id, quantity FROM inventory
            WHERE product_id = $1 AND variation_id IS NULL AND branch_id = $2
          `, [product_id, branch_id])
          if (nullRow.rows.length > 0 && nullRow.rows[0].quantity >= quantity) {
            targetId = nullRow.rows[0].id
            availableQty = nullRow.rows[0].quantity
          }
        }

        // If still insufficient, pick the row with the highest quantity
        if (!targetId || availableQty < quantity) {
          const bestRow = await query(`
            SELECT id, quantity, variation_id FROM inventory
            WHERE product_id = $1 AND branch_id = $2
            ORDER BY quantity DESC
            LIMIT 1
          `, [product_id, branch_id])
          if (bestRow.rows.length > 0 && bestRow.rows[0].quantity >= quantity) {
            targetId = bestRow.rows[0].id
          }
        }

        if (!targetId) {
          const err: any = new Error('INSUFFICIENT_STOCK')
          err.code = 'INSUFFICIENT_STOCK'
          throw err
        }

        // Update the chosen row by id
        await query(`
          UPDATE inventory 
          SET quantity = quantity - $2, updated_at = NOW()
          WHERE id = $1
        `, [targetId, quantity])
      } else {
        // Try NULL-variation row first
        let nullRow = await query(`
          SELECT id, quantity FROM inventory 
          WHERE product_id = $1 AND variation_id IS NULL AND branch_id = $2
        `, [product_id, branch_id])

        let targetId: string | null = nullRow.rows[0]?.id || null
        let availableQty = nullRow.rows[0]?.quantity || 0

        // If NULL row missing or insufficient, pick the highest-quantity row for this product/branch
        if (!targetId || availableQty < quantity) {
          const bestRow = await query(`
            SELECT id, quantity FROM inventory
            WHERE product_id = $1 AND branch_id = $2
            ORDER BY quantity DESC
            LIMIT 1
          `, [product_id, branch_id])
          if (bestRow.rows.length > 0 && bestRow.rows[0].quantity >= quantity) {
            targetId = bestRow.rows[0].id
            availableQty = bestRow.rows[0].quantity
          }
        }

        if (!targetId) {
          const err: any = new Error('INSUFFICIENT_STOCK')
          err.code = 'INSUFFICIENT_STOCK'
          throw err
        }

        // Update the chosen row by id
        await query(`
          UPDATE inventory
          SET quantity = quantity - $2, updated_at = NOW()
          WHERE id = $1
        `, [targetId, quantity])
      }
    }

    return NextResponse.json({
      success: true,
      data: { ok: true },
      message: `Stock ${movement_type === 'in' ? 'added' : 'reduced'} successfully`
    })
  } catch (error: any) {
    // Always return JSON and avoid referencing possibly undefined variables
    if (error?.code === 'INSUFFICIENT_STOCK') {
      let currentStock = 0
      try {
        // Only attempt lookup if required identifiers exist
        if (product_id && branch_id) {
          const hasVariation = typeof variation_id !== 'undefined' && variation_id !== null
          const stockQuery = hasVariation
            ? `SELECT quantity FROM inventory WHERE product_id = $1 AND variation_id = $2 AND branch_id = $3`
            : `SELECT quantity FROM inventory WHERE product_id = $1 AND variation_id IS NULL AND branch_id = $2`
          const stockParams = hasVariation ? [product_id, variation_id, branch_id] : [product_id, branch_id]
          const stockResult = await query(stockQuery, stockParams)
          currentStock = stockResult.rows[0]?.quantity || 0
        }
      } catch (e) {
        // Swallow lookup errors; we still return a safe response
      }

      const attempted = Number.isFinite(Number(quantity)) ? Number(quantity) : 'unknown'
      return NextResponse.json({
        success: false,
        error: `Insufficient stock. Current stock: ${currentStock}, Attempted to reduce: ${attempted}`
      }, { status: 400 })
    }

    console.error("Stock movement creation error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
