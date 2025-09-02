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
    if (movement_type === 'in') {
      // Add stock - same as add stock flow
      if (variation_id) {
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
      if (variation_id) {
        // Try to find variation-specific row first
        let stockRow = await query(`
          SELECT id, quantity, variation_id FROM inventory 
          WHERE product_id = $1 AND variation_id = $2 AND branch_id = $3
        `, [product_id, variation_id, branch_id])

        // Fallback for uniform products: if variation row missing, use NULL-variation row
        if (stockRow.rows.length === 0) {
          stockRow = await query(`
            SELECT id, quantity, variation_id FROM inventory 
            WHERE product_id = $1 AND variation_id IS NULL AND branch_id = $2
          `, [product_id, branch_id])
        }

        // If still missing, create the requested variation row at 0 to avoid negative
        if (stockRow.rows.length === 0) {
          await query(`
            INSERT INTO inventory (product_id, variation_id, branch_id, quantity, min_stock_level, max_stock_level)
            VALUES ($1, $2, $3, 0, 0, 1000)
          `, [product_id, variation_id, branch_id])
        }

        const availableQty = stockRow.rows[0]?.quantity || 0
        const finalQuantity = availableQty - quantity
        if (finalQuantity < 0) {
          const err: any = new Error('INSUFFICIENT_STOCK')
          err.code = 'INSUFFICIENT_STOCK'
          throw err
        }

        // Update whichever row we picked
        const targetVariationId = stockRow.rows[0]?.variation_id || null
        if (targetVariationId) {
          await query(`
            UPDATE inventory 
            SET quantity = quantity - $3, updated_at = NOW()
            WHERE product_id = $1 AND variation_id = $2 AND branch_id = $4
          `, [product_id, targetVariationId, quantity, branch_id])
        } else {
          await query(`
            UPDATE inventory 
            SET quantity = quantity - $2, updated_at = NOW()
            WHERE product_id = $1 AND variation_id IS NULL AND branch_id = $3
          `, [product_id, quantity, branch_id])
        }
      } else {
        // Check if we have enough stock first
        const currentStock = await query(`
          SELECT quantity FROM inventory 
          WHERE product_id = $1 AND variation_id IS NULL AND branch_id = $2
        `, [product_id, branch_id])
        
        if (currentStock.rows.length === 0) {
          // No inventory record exists, create one with 0 quantity
          await query(`
            INSERT INTO inventory (product_id, variation_id, branch_id, quantity, min_stock_level, max_stock_level)
            VALUES ($1, NULL, $2, 0, 0, 1000)
          `, [product_id, branch_id])
        }
        
        // Check if reduction would result in negative stock
        const finalQuantity = (currentStock.rows[0]?.quantity || 0) - quantity
        if (finalQuantity < 0) {
          const err: any = new Error('INSUFFICIENT_STOCK')
          err.code = 'INSUFFICIENT_STOCK'
          throw err
        }
        
        // Update uniform products
        await query(`
          UPDATE inventory 
          SET quantity = quantity - $2, updated_at = NOW()
          WHERE product_id = $1 AND variation_id IS NULL AND branch_id = $3
        `, [product_id, quantity, branch_id])
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
