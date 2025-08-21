import { type NextRequest, NextResponse } from "next/server"
import { getUserFromRequest, hasPermissionForBranch } from "@/lib/auth"
import { query } from "@/lib/db"
import { z } from "zod"

const createVariationSchema = z.object({
  color: z.string().optional(),
  size: z.string().optional(),
  price: z.number().positive().optional(),
  cost_price: z.number().positive().optional(),
  purchase_price: z.number().positive().optional(),
  initial_quantity: z.number().int().min(0, "Initial quantity must be 0 or greater"),
  min_stock_level: z.number().int().min(0).nullable().optional(),
  max_stock_level: z.number().int().min(0).nullable().optional(),
  branch_id: z.string().min(1, "Branch ID is required"),
})

const updateVariationSchema = z.object({
  color: z.string().optional(),
  size: z.string().optional(),
  price: z.number().positive().optional(),
  cost_price: z.number().positive().optional(),
  purchase_price: z.number().positive().optional(),
  min_stock_level: z.number().int().min(0).nullable().optional(),
  max_stock_level: z.number().int().min(0).nullable().optional(),
})

// GET /api/products/[id]/variations - Get all variations for a product
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const productId = params.id

    // Get product and its variations
    const result = await query(
      `SELECT 
        p.*,
        c.name as category_name,
        pv.id as variation_id,
        pv.sku as variation_sku,
        pv.color,
        pv.size,
        pv.price,
        pv.cost_price,
        pv.purchase_price,
        pv.is_active as variation_active,
        i.quantity,
        i.min_stock_level,
        i.max_stock_level,
        i.branch_id
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN product_variations pv ON p.id = pv.product_id
      LEFT JOIN inventory i ON pv.id = i.variation_id
      WHERE p.id = $1 AND p.is_active = true
      ORDER BY pv.created_at ASC`,
      [productId]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, error: "Product not found" }, { status: 404 })
    }

    // Transform the data to group variations
    const product = {
      id: result.rows[0].id,
      name: result.rows[0].name,
      sku: result.rows[0].sku,
      category_id: result.rows[0].category_id,
      category_name: result.rows[0].category_name,
      description: result.rows[0].description,
      image_url: result.rows[0].image_url,
      barcode: result.rows[0].barcode,
      brand: result.rows[0].brand,
      age_range: result.rows[0].age_range,
      gender: result.rows[0].gender,
      product_type: result.rows[0].product_type,
      is_active: result.rows[0].is_active,
      created_at: result.rows[0].created_at,
      updated_at: result.rows[0].updated_at,
      variations: result.rows
        .filter((row: any) => row.variation_id)
        .map((row: any) => ({
          id: row.variation_id,
          sku: row.variation_sku,
          color: row.color,
          size: row.size,
          price: row.price,
          cost_price: row.cost_price,
          purchase_price: row.purchase_price,
          is_active: row.variation_active,
          inventory: row.branch_id ? [{
            branch_id: row.branch_id,
            quantity: row.quantity,
            min_stock_level: row.min_stock_level,
            max_stock_level: row.max_stock_level,
          }] : [],
        }))
    }

    return NextResponse.json({
      success: true,
      data: product,
    })
  } catch (error) {
    console.error("Get variations error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}

// POST /api/products/[id]/variations - Add a new variation to a product
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const productId = params.id
    const body = await request.json()
    const validatedData = createVariationSchema.parse(body)

    // Check if product exists and user has permission
    const productResult = await query(
      "SELECT * FROM products WHERE id = $1 AND is_active = true",
      [productId]
    )

    if (productResult.rows.length === 0) {
      return NextResponse.json({ success: false, error: "Product not found" }, { status: 404 })
    }

    const product = productResult.rows[0]

    // Check branch permission
    if (!hasPermissionForBranch(user, validatedData.branch_id)) {
      return NextResponse.json({ success: false, error: "Access denied to this branch" }, { status: 403 })
    }

    // Start transaction
    await query('BEGIN')

    try {
      // Create variation
      const variationResult = await query(
        `INSERT INTO product_variations (product_id, sku, color, size, price, cost_price, purchase_price)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          productId,
          `${product.sku}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
          validatedData.color || null,
          validatedData.size || null,
          validatedData.price || null,
          validatedData.cost_price || null,
          validatedData.purchase_price || null,
        ]
      )

      const variation = variationResult.rows[0]

      // Create inventory record for this variation
      const initialQuantity = validatedData.initial_quantity || 0
      const minStockLevel = validatedData.min_stock_level || 5
      const maxStockLevel = validatedData.max_stock_level || 100

      await query(
        `INSERT INTO inventory (product_id, variation_id, branch_id, quantity, min_stock_level, max_stock_level)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (product_id, variation_id, branch_id)
         DO UPDATE SET 
           quantity = EXCLUDED.quantity,
           min_stock_level = EXCLUDED.min_stock_level,
           max_stock_level = EXCLUDED.max_stock_level,
           updated_at = NOW()`,
        [productId, variation.id, validatedData.branch_id, initialQuantity, minStockLevel, maxStockLevel]
      )

      await query('COMMIT')

      return NextResponse.json(
        {
          success: true,
          data: variation,
          message: "Variation created successfully",
        },
        { status: 201 },
      )
    } catch (error) {
      await query('ROLLBACK')
      throw error
    }
  } catch (error) {
    console.error("Create variation error:", error)

    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: error.errors[0].message }, { status: 400 })
    }

    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
