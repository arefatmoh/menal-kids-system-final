import { type NextRequest, NextResponse } from "next/server"
import { getUserFromRequest, hasPermissionForBranch } from "@/lib/auth"
import { query, transaction } from "@/lib/db"
import { logActivity } from "@/lib/activity-log"
import { z } from "zod"

const createSaleSchema = z.object({
  branch_id: z.string().min(1, "Branch ID is required"),
  customer_name: z.string().optional(),
  customer_phone: z.string().optional(),
  payment_method: z.enum(["cash", "card", "mobile", "bank_transfer"]),
  discount: z.number().min(0).default(0),
  notes: z.string().optional(),
  items: z
    .array(
      z.object({
        product_id: z.string().uuid("Invalid product ID"),
        variation_id: z.string().uuid("Invalid variation ID").optional(),
        quantity: z.number().int().positive("Quantity must be positive"),
        unit_price: z.number().min(0, "Unit price must be 0 or greater"),
      }),
    )
    .min(1, "At least one item is required"),
})

// GET /api/sales - Get sales with filters
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
    const dateFrom = searchParams.get("date_from")
    const dateTo = searchParams.get("date_to")

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
      whereClause += ` AND s.branch_id = $${paramCount}`
      params.push(branchId)
    } else if (user.role === "employee") {
      paramCount++
      whereClause += ` AND s.branch_id = $${paramCount}`
      params.push(user.branch_id)
    }

    if (dateFrom) {
      paramCount++
      whereClause += ` AND DATE(s.created_at) >= $${paramCount}`
      params.push(dateFrom)
    }

    if (dateTo) {
      paramCount++
      whereClause += ` AND DATE(s.created_at) <= $${paramCount}`
      params.push(dateTo)
    }

    const salesQuery = `
      SELECT 
        s.*,
        b.name as branch_name,
        u.full_name as employee_name,
        COUNT(si.id) as item_count,
        SUM(si.quantity) as total_items,
        COALESCE(json_agg(
          json_build_object(
            'id', si.id,
            'product_id', si.product_id,
            'product_name', p.name,
            'variation_id', si.variation_id,
            'variation_name', CASE 
              WHEN pv.id IS NOT NULL THEN 
                CONCAT(
                  COALESCE(pv.color, ''), 
                  CASE WHEN pv.color IS NOT NULL AND pv.size IS NOT NULL THEN ', ' ELSE '' END,
                  COALESCE(pv.size, '')
                )
              ELSE NULL 
            END,
            'color', pv.color,
            'size', pv.size,
            'quantity', si.quantity,
            'unit_price', si.unit_price,
            'total_price', si.total_price
          ) 
        ) FILTER (WHERE si.id IS NOT NULL), '[]') as items
      FROM sales s
      JOIN branches b ON s.branch_id = b.id
      JOIN users u ON s.user_id = u.id
      LEFT JOIN sale_items si ON s.id = si.sale_id
      LEFT JOIN products p ON si.product_id = p.id
      LEFT JOIN product_variations pv ON si.variation_id = pv.id
      ${whereClause}
      GROUP BY s.id, b.name, u.full_name
      ORDER BY s.created_at DESC
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `

    params.push(limit, offset)

    const result = await query(salesQuery, params)

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM sales s
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
    console.error("Get sales error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}

async function tableHasColumn(table: string, column: string): Promise<boolean> {
  const res = await query(
    `SELECT 1 FROM information_schema.columns WHERE table_name = $1 AND column_name = $2 LIMIT 1`,
    [table, column],
  )
  return res.rowCount > 0
}

// POST /api/sales - Create new sale
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = createSaleSchema.parse(body)

    // Check branch permission
    if (!hasPermissionForBranch(user, validatedData.branch_id)) {
      return NextResponse.json({ success: false, error: "Access denied to this branch" }, { status: 403 })
    }

    // Calculate total amount
    const totalAmount =
      validatedData.items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0) - validatedData.discount

    // Pre-check table schemas to avoid failing statements inside a transaction
    const [hasSaleItemsVariation, hasInventoryVariation, hasStockMovementsVariation] = await Promise.all([
      tableHasColumn("sale_items", "variation_id"),
      tableHasColumn("inventory", "variation_id"),
      tableHasColumn("stock_movements", "variation_id"),
    ])

    // Create sale in transaction
    const result = await transaction(async (client) => {
      // Create sale
      const saleResult = await client.query(
        `INSERT INTO sales (branch_id, user_id, customer_name, customer_phone, payment_method, total_amount, discount, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          validatedData.branch_id,
          user.id,
          validatedData.customer_name || null,
          validatedData.customer_phone || null,
          validatedData.payment_method,
          totalAmount,
          validatedData.discount,
          validatedData.notes || null,
        ],
      )

      const sale = saleResult.rows[0]

      // Create sale items
      const saleItems = [] as any[]
      for (const item of validatedData.items) {
        if (hasSaleItemsVariation) {
          const itemResult = await client.query(
            `INSERT INTO sale_items (sale_id, product_id, variation_id, quantity, unit_price, total_price)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [sale.id, item.product_id, item.variation_id || null, item.quantity, item.unit_price, item.quantity * item.unit_price],
          )
          saleItems.push(itemResult.rows[0])
        } else {
          const itemResult = await client.query(
            `INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, total_price)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [sale.id, item.product_id, item.quantity, item.unit_price, item.quantity * item.unit_price],
          )
          saleItems.push(itemResult.rows[0])
        }
      }

      // NOTE:
      // We intentionally do NOT decrement inventory or insert stock movements here.
      // Database triggers handle both validation and inventory updates on sale_items insert:
      // - validate_sale_inventory_trigger (BEFORE INSERT) blocks insufficient stock
      // - sale_inventory_trigger (AFTER INSERT) decrements inventory and records stock movement

      return { sale, items: saleItems }
    })

    // Fire-and-forget activity log
    logActivity({
      type: 'sell',
      title: 'Sale completed',
      description: `Items: ${result.items.length}, Total: ${result.sale.total_amount}`,
      branch_id: result.sale.branch_id,
      user_id: result.sale.user_id,
      related_entity_type: 'sale',
      related_entity_id: result.sale.id,
      delta: {
        total_amount: result.sale.total_amount,
        discount: result.sale.discount,
        items: result.items.map((it: any) => ({ product_id: it.product_id, variation_id: it.variation_id, quantity: it.quantity, unit_price: it.unit_price }))
      }
    }).catch(() => {})

    return NextResponse.json(
      {
        success: true,
        data: result,
        message: "Sale created successfully",
      },
      { status: 201 },
    )
  } catch (error: any) {
    console.error("Create sale error:", error)

    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: error.errors[0].message }, { status: 400 })
    }

    // Map trigger/constraint errors to user-friendly insufficient stock message
    if (error.message && (error.message.includes("Insufficient stock") || error.message.includes("check_positive_quantity"))) {
      const message = error.message.includes("Insufficient stock") ? error.message : "Insufficient stock"
      return NextResponse.json({ success: false, error: message }, { status: 400 })
    }

    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
