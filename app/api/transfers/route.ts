import { type NextRequest, NextResponse } from "next/server"
import { getUserFromRequest, hasPermissionForBranch } from "@/lib/auth"
import { query } from "@/lib/db"
import { z } from "zod"

// GET /api/transfers - Get transfers
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const fromBranchId = searchParams.get("from_branch_id")
    const toBranchId = searchParams.get("to_branch_id")
    const status = searchParams.get("status")
    const page = Number.parseInt(searchParams.get("page") || "1")
    const limit = Number.parseInt(searchParams.get("limit") || "20")

    let sql = `
      SELECT 
        t.id,
        t.from_branch_id,
        t.to_branch_id,
        t.status,
        t.notes as reason,
        t.transfer_date as requested_at,
        t.transfer_date as completed_at,
        t.user_id as requested_by,
        t.user_id as approved_by,
        fb.name as from_branch_name,
        tb.name as to_branch_name,
        u1.full_name as requested_by_name,
        u1.full_name as approved_by_name
      FROM transfers t
      LEFT JOIN branches fb ON t.from_branch_id = fb.id
      LEFT JOIN branches tb ON t.to_branch_id = tb.id
      LEFT JOIN users u1 ON t.user_id = u1.id
      WHERE 1=1
    `
    const params: any[] = []

    if (fromBranchId) {
      sql += " AND t.from_branch_id = $1"
      params.push(fromBranchId)
    }
    if (toBranchId) {
      sql += ` AND t.to_branch_id = $${params.length + 1}`
      params.push(toBranchId)
    }
    if (status) {
      sql += ` AND t.status = $${params.length + 1}`
      params.push(status)
    }

    // Check branch permissions
    if (fromBranchId && !hasPermissionForBranch(user, fromBranchId)) {
      return NextResponse.json({ success: false, error: "Access denied to from branch" }, { status: 403 })
    }
    if (toBranchId && !hasPermissionForBranch(user, toBranchId)) {
      return NextResponse.json({ success: false, error: "Access denied to to branch" }, { status: 403 })
    }

    sql += ` ORDER BY t.transfer_date DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`
    params.push(limit, (page - 1) * limit)

    const result = await query(sql, params)

    // Get transfer items for each transfer
    const transfersWithItems = await Promise.all(
      result.rows.map(async (transfer: any) => {
        const itemsResult = await query(`
          SELECT 
            ti.id,
            ti.product_id,
            ti.variation_id,
            ti.quantity,
            p.name as product_name,
            p.sku,
            CASE WHEN pv.id IS NOT NULL THEN 
              CONCAT(COALESCE(pv.color, ''), 
                    CASE WHEN pv.color IS NOT NULL AND pv.size IS NOT NULL THEN ' - ' ELSE '' END,
                    COALESCE(pv.size, ''))
            ELSE NULL END as variation_name
          FROM transfer_items ti
          LEFT JOIN products p ON ti.product_id = p.id
          LEFT JOIN product_variations pv ON ti.variation_id = pv.id
          WHERE ti.transfer_id = $1
        `, [transfer.id])
        
        return {
          ...transfer,
          items: itemsResult.rows
        }
      })
    )

    return NextResponse.json({
      success: true,
      data: transfersWithItems,
      pagination: {
        page,
        limit,
        total: result.rows.length,
        has_next: result.rows.length === limit,
        has_prev: page > 1,
      }
    })
  } catch (error) {
    console.error("Get transfers error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}

// POST /api/transfers - Create instant transfer
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()

    // Validate request body
    const transferSchema = z.object({
      from_branch_id: z.string(),
      to_branch_id: z.string(),
      reason: z.string().min(1),
      items: z.array(z.object({
        product_id: z.string(),
        variation_id: z.string().optional(),
        quantity: z.number().positive(),
      })).min(1),
    })

    const validatedData = transferSchema.parse(body)

    // Check branch permissions
    if (!hasPermissionForBranch(user, validatedData.from_branch_id)) {
      return NextResponse.json({ success: false, error: "Access denied to from branch" }, { status: 403 })
    }
    // For employees, allow transfers to other branches even if they don't have permission on the destination branch
    if (user.role !== 'employee' && !hasPermissionForBranch(user, validatedData.to_branch_id)) {
      return NextResponse.json({ success: false, error: "Access denied to to branch" }, { status: 403 })
    }

    // Check if branches are different
    if (validatedData.from_branch_id === validatedData.to_branch_id) {
      return NextResponse.json({ success: false, error: "From and to branches must be different" }, { status: 400 })
    }

    // Start transaction
    await query('BEGIN')

    try {
      // Check inventory availability for all items
      for (const item of validatedData.items) {
        let inventoryResult
        if (item.variation_id) {
          // Check specific variation inventory
          inventoryResult = await query(`
            SELECT quantity FROM inventory 
            WHERE product_id = $1 AND branch_id = $2 AND variation_id = $3
          `, [item.product_id, validatedData.from_branch_id, item.variation_id])
        } else {
          // Check total product inventory (sum of all variations + base product)
          inventoryResult = await query(`
            SELECT COALESCE(SUM(quantity), 0) as total_quantity FROM inventory 
            WHERE product_id = $1 AND branch_id = $2
          `, [item.product_id, validatedData.from_branch_id])
        }
        
        const availableQuantity = item.variation_id ? 
          (inventoryResult.rows[0]?.quantity || 0) : 
          (inventoryResult.rows[0]?.total_quantity || 0)
        
        if (availableQuantity < item.quantity) {
          await query('ROLLBACK')
          return NextResponse.json({ 
            success: false, 
            error: `Insufficient stock for product ${item.product_id}${item.variation_id ? ' variation' : ''}. Available: ${availableQuantity}, Requested: ${item.quantity}` 
          }, { status: 400 })
        }
      }

      // Create transfer record
      const transferResult = await query(`
        INSERT INTO transfers (from_branch_id, to_branch_id, notes, status, user_id, transfer_date)
        VALUES ($1, $2, $3, 'completed', $4, NOW())
        RETURNING id
      `, [validatedData.from_branch_id, validatedData.to_branch_id, validatedData.reason, user.id])

      const transferId = transferResult.rows[0].id

      // Process each item
      for (const item of validatedData.items) {
        // Create transfer item record
        await query(`
          INSERT INTO transfer_items (transfer_id, product_id, variation_id, quantity)
          VALUES ($1, $2, $3, $4)
        `, [transferId, item.product_id, item.variation_id || null, item.quantity])

        // Update source branch inventory (decrease) with safety check
        const updateSource = await query(`
          UPDATE inventory 
          SET quantity = quantity - $1, updated_at = NOW()
          WHERE product_id = $2 
            AND branch_id = $3 
            AND (
              ($4::uuid IS NOT NULL AND variation_id = $4::uuid)
              OR ($4::uuid IS NULL AND variation_id IS NULL)
            )
            AND quantity >= $1
          RETURNING quantity
        `, [item.quantity, item.product_id, validatedData.from_branch_id, item.variation_id || null])

        if (updateSource.rowCount === 0) {
          await query('ROLLBACK')
          return NextResponse.json({ success: false, error: `Insufficient stock for product ${item.product_id}` }, { status: 400 })
        }

        // Record stock movement for source branch (out)
        await query(`
          INSERT INTO stock_movements (product_id, branch_id, variation_id, user_id, movement_type, quantity, reason, reference_type, reference_id)
          VALUES ($1, $2, $3, $4, 'out', $5, $6, 'transfer', $7)
        `, [item.product_id, validatedData.from_branch_id, item.variation_id || null, user.id, item.quantity, `Transfer to ${validatedData.to_branch_id}`, transferId])

        // Update destination branch inventory (increase or create), copying min/max levels from source when creating new row
        // First try to update an existing destination row
        const upsertDest = await query(`
          UPDATE inventory 
          SET quantity = quantity + $4, last_restocked = NOW(), updated_at = NOW()
          WHERE product_id = $1 
            AND branch_id = $2 
            AND (
              ($3::uuid IS NOT NULL AND variation_id = $3::uuid)
              OR ($3::uuid IS NULL AND variation_id IS NULL)
            )
          RETURNING id
        `, [item.product_id, validatedData.to_branch_id, item.variation_id || null, item.quantity])

        if (upsertDest.rowCount === 0) {
          // No existing row, insert new one copying min/max from source branch if available
          await query(`
            INSERT INTO inventory (product_id, branch_id, variation_id, quantity, min_stock_level, max_stock_level, last_restocked)
            VALUES (
              $1,
              $2,
              $3::uuid,
              $4,
              (SELECT min_stock_level FROM inventory WHERE product_id = $1 AND branch_id = $5 AND (
                 ($3::uuid IS NOT NULL AND variation_id = $3::uuid) OR ($3::uuid IS NULL AND variation_id IS NULL)
               ) LIMIT 1),
              (SELECT max_stock_level FROM inventory WHERE product_id = $1 AND branch_id = $5 AND (
                 ($3::uuid IS NOT NULL AND variation_id = $3::uuid) OR ($3::uuid IS NULL AND variation_id IS NULL)
               ) LIMIT 1),
              NOW()
            )
          `, [item.product_id, validatedData.to_branch_id, item.variation_id || null, item.quantity, validatedData.from_branch_id])
        }

        // Record stock movement for destination branch (in)
        await query(`
          INSERT INTO stock_movements (product_id, branch_id, variation_id, user_id, movement_type, quantity, reason, reference_type, reference_id)
          VALUES ($1, $2, $3, $4, 'in', $5, $6, 'transfer', $7)
        `, [item.product_id, validatedData.to_branch_id, item.variation_id || null, user.id, item.quantity, `Transfer from ${validatedData.from_branch_id}`, transferId])
      }

      await query('COMMIT')

      // Fetch and return the full transfer record with items and product details
      const transferRow = await query(`
        SELECT 
          t.id,
          t.from_branch_id,
          t.to_branch_id,
          t.status,
          t.notes as reason,
          t.transfer_date as requested_at,
          t.transfer_date as completed_at,
          t.user_id as requested_by,
          t.user_id as approved_by,
          fb.name as from_branch_name,
          tb.name as to_branch_name,
          u1.full_name as requested_by_name,
          u1.full_name as approved_by_name
        FROM transfers t
        LEFT JOIN branches fb ON t.from_branch_id = fb.id
        LEFT JOIN branches tb ON t.to_branch_id = tb.id
        LEFT JOIN users u1 ON t.user_id = u1.id
        WHERE t.id = $1
      `, [transferId])

      const itemsResult = await query(`
        SELECT 
          ti.id,
          ti.product_id,
          ti.variation_id,
          ti.quantity,
          p.name as product_name,
          p.sku,
          CASE WHEN pv.id IS NOT NULL THEN 
            CONCAT(COALESCE(pv.color, ''), 
                  CASE WHEN pv.color IS NOT NULL AND pv.size IS NOT NULL THEN ' - ' ELSE '' END,
                  COALESCE(pv.size, ''))
          ELSE NULL END as variation_name,
          pv.color,
          pv.size
        FROM transfer_items ti
        LEFT JOIN products p ON ti.product_id = p.id
        LEFT JOIN product_variations pv ON ti.variation_id = pv.id
        WHERE ti.transfer_id = $1
      `, [transferId])

      return NextResponse.json({
        success: true,
        data: {
          ...transferRow.rows[0],
          items: itemsResult.rows
        },
        message: "Transfer completed successfully"
      })
    } catch (error) {
      await query('ROLLBACK')
      throw error
    }
  } catch (error) {
    console.error("Create transfer error:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: "Invalid request data" }, { status: 400 })
    }
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}