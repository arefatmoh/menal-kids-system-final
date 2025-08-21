import { type NextRequest, NextResponse } from "next/server"
import { getUserFromRequest, hasPermissionForBranch } from "@/lib/auth"
import { query } from "@/lib/db"
import { z } from "zod"

const createProductSchema = z.object({
  name: z.string().min(1, "Product name is required"),
  category_id: z.string().uuid("Invalid category ID"),
  description: z.string().optional(),
  image_url: z.string().url().optional(),
  barcode: z.string().optional(),
  brand: z.string().optional(),
  age_range: z.string().optional(),
  gender: z.enum(["boys", "girls", "unisex"]).optional(),
  product_type: z.enum(["uniform", "variation"]).default("uniform"),
  // For uniform products
  color: z.string().optional(),
  size: z.string().optional(),
  price: z.number().positive("Price must be positive").optional(),
  cost_price: z.number().positive().optional(),
  purchase_price: z.number().positive().optional(),
  initial_quantity: z.number().int().min(0, "Initial quantity must be 0 or greater").optional(),
  min_stock_level: z.number().int().min(0).nullable().optional(),
  max_stock_level: z.number().int().min(0).nullable().optional(),
  // For variation products
  variations: z.array(z.object({
    color: z.string().optional(),
    size: z.string().optional(),
    price: z.number().positive().optional(),
    cost_price: z.number().positive().optional(),
    purchase_price: z.number().positive().optional(),
    initial_quantity: z.number().int().min(0, "Initial quantity must be 0 or greater"),
    min_stock_level: z.number().int().min(0).nullable().optional(),
    max_stock_level: z.number().int().min(0).nullable().optional(),
  })).optional(),
  branch_id: z.string().min(1, "Branch ID is required"),
})

// GET /api/products - Get all products with filters
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = Number.parseInt(searchParams.get("page") || "1")
    const limit = Number.parseInt(searchParams.get("limit") || "20")
    const search = searchParams.get("search") || ""
    const searchType = searchParams.get("search_type") || "exact"
    const searchMode = searchParams.get("search_mode") || "exact"
    const categoryId = searchParams.get("category_id")
    const branchId = searchParams.get("branch_id")
    const crossBranchSearch = searchParams.get("cross_branch") === "true"
    
    // Filter parameters for cross-branch search
    const status = searchParams.get("status") || ""
    const brand = searchParams.get("brand") || ""
    const gender = searchParams.get("gender") || ""
    const ageRange = searchParams.get("age_range") || ""
    const size = searchParams.get("size") || ""
    const priceMin = searchParams.get("price_min")
    const priceMax = searchParams.get("price_max")
    const stockMin = searchParams.get("stock_min")
    const stockMax = searchParams.get("stock_max")

    const nameExact = searchParams.get("name_exact") === "true"
    const productType = searchParams.get("product_type")

    // For employees, always filter by their branch unless doing cross-branch search
    let effectiveBranchId = branchId
    if (user.role === "employee" && !crossBranchSearch) {
      effectiveBranchId = user.branch_id || branchId
    }

    // Check branch permission
    if (effectiveBranchId && !hasPermissionForBranch(user, effectiveBranchId)) {
      return NextResponse.json({ success: false, error: "Access denied to this branch" }, { status: 403 })
    }

    const offset = (page - 1) * limit

    let whereClause = "WHERE p.is_active = true"
    const params: any[] = []
    let paramCount = 0

    // Search functionality
    if (search) {
      paramCount++
      if (nameExact) {
        whereClause += ` AND p.name = $${paramCount}`
        params.push(search)
      } else {
        whereClause += ` AND (p.name ILIKE $${paramCount} OR p.sku ILIKE $${paramCount})`
        params.push(`%${search}%`)
      }
    }

    // Branch filtering
    if (effectiveBranchId && effectiveBranchId !== "all") {
      paramCount++
      whereClause += ` AND EXISTS (
        SELECT 1 FROM inventory i 
        WHERE i.product_id = p.id AND i.branch_id = $${paramCount}
      )`
      params.push(effectiveBranchId)
    }

    if (categoryId) {
      paramCount++
      whereClause += ` AND p.category_id = $${paramCount}`
      params.push(categoryId)
    }

    // Filter by product type
    if (productType) {
      paramCount++
      whereClause += ` AND p.product_type = $${paramCount}`
      params.push(productType)
    }

    // Filter conditions for cross-branch search
    if (brand && brand !== "all") {
      paramCount++
      whereClause += ` AND p.brand = $${paramCount}`
      params.push(brand)
    }

    if (gender && gender !== "all") {
      paramCount++
      whereClause += ` AND p.gender = $${paramCount}`
      params.push(gender)
    }

    if (ageRange && ageRange !== "all") {
      paramCount++
      whereClause += ` AND p.age_range = $${paramCount}`
      params.push(ageRange)
    }

    if (size && size !== "all") {
      paramCount++
      whereClause += ` AND p.size = $${paramCount}`
      params.push(size)
    }

    if (priceMin) {
      paramCount++
      whereClause += ` AND p.price >= $${paramCount}`
      params.push(parseFloat(priceMin))
    }

    if (priceMax) {
      paramCount++
      whereClause += ` AND p.price <= $${paramCount}`
      params.push(parseFloat(priceMax))
    }

    // Get products with inventory info and variation counts
    const productsQuery = `
      SELECT 
        p.*,
        c.name as category_name,
        COALESCE(SUM(CASE WHEN i.branch_id = $${paramCount + 1} THEN i.quantity ELSE 0 END), 0) as total_stock,
        COUNT(CASE WHEN i.branch_id = $${paramCount + 1} THEN i.id END) as branch_count,
        COUNT(DISTINCT i.branch_id) as total_branch_count,
        COALESCE(variation_counts.variation_count, 0) as variations_count
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN inventory i ON p.id = i.product_id
      LEFT JOIN (
        SELECT 
          product_id,
          COUNT(*) as variation_count
        FROM product_variations
        WHERE is_active = true
        GROUP BY product_id
      ) variation_counts ON p.id = variation_counts.product_id
      ${whereClause}
      GROUP BY p.id, c.name, variation_counts.variation_count
      ORDER BY p.created_at DESC
      LIMIT $${paramCount + 2} OFFSET $${paramCount + 3}
    `

    params.push(effectiveBranchId || "branch1", limit, offset)

    const result = await query(productsQuery, params)

    // Get total count
    const countQuery = `
      SELECT COUNT(DISTINCT p.id) as total
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      ${whereClause}
    `

    const countResult = await query(countQuery, params.slice(0, paramCount))
    const total = Number.parseInt(countResult.rows[0].total)

    return NextResponse.json({
      success: true,
      data: {
        products: result.rows,
        pagination: {
          page,
          limit,
          total,
          total_pages: Math.ceil(total / limit),
          has_next: page * limit < total,
          has_prev: page > 1,
        },
      },
    })
  } catch (error) {
    console.error("Get products error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}

// POST /api/products - Create new product
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = createProductSchema.parse(body)

    // Check branch permission for the specified branch
    if (!hasPermissionForBranch(user, validatedData.branch_id)) {
      return NextResponse.json({ success: false, error: "Access denied to this branch" }, { status: 403 })
    }

    // Start transaction
    await query('BEGIN')

    try {
      // Create product
      const result = await query(
        `INSERT INTO products (name, category_id, description, image_url, barcode, brand, age_range, gender, product_type)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          validatedData.name,
          validatedData.category_id,
          validatedData.description || null,
          validatedData.image_url || null,
          validatedData.barcode || null,
          validatedData.brand || null,
          validatedData.age_range || null,
          validatedData.gender || null,
          validatedData.product_type,
        ],
      )

      const product = result.rows[0]

      if (validatedData.product_type === "uniform") {
        // For uniform products, create a variation and inventory
        const variationResult = await query(
          `INSERT INTO product_variations (product_id, sku, color, size, price, cost_price, purchase_price)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING *`,
          [
            product.id,
            `${product.sku}-UNI`,
            validatedData.color || null,
            validatedData.size || null,
            validatedData.price || null,
            validatedData.cost_price || null,
            validatedData.purchase_price || null,
          ]
        )

        const variation = variationResult.rows[0]

        // Create inventory record for the uniform product
      const initialQuantity = validatedData.initial_quantity || 0
      const minStockLevel = validatedData.min_stock_level || 5
      const maxStockLevel = validatedData.max_stock_level || 100

        // Check if inventory record already exists for this product and branch
        const existingInventory = await query(
          `SELECT id FROM inventory WHERE product_id = $1 AND branch_id = $2`,
          [product.id, validatedData.branch_id]
        )

        if (existingInventory.rows.length === 0) {
          // Only create if it doesn't exist
          await query(
            `INSERT INTO inventory (product_id, variation_id, branch_id, quantity, min_stock_level, max_stock_level)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [product.id, variation.id, validatedData.branch_id, initialQuantity, minStockLevel, maxStockLevel]
          )
        } else {
          // Update existing inventory record
      await query(
            `UPDATE inventory SET 
               variation_id = $1,
               quantity = $2,
               min_stock_level = $3,
               max_stock_level = $4,
               updated_at = NOW()
             WHERE product_id = $5 AND branch_id = $6`,
            [variation.id, initialQuantity, minStockLevel, maxStockLevel, product.id, validatedData.branch_id]
          )
        }
      } else if (validatedData.product_type === "variation" && validatedData.variations) {
        // For variation products, create variations and inventory for each
        for (const variationData of validatedData.variations) {
          const variationResult = await query(
            `INSERT INTO product_variations (product_id, sku, color, size, price, cost_price, purchase_price)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [
              product.id,
              `${product.sku}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
              variationData.color || null,
              variationData.size || null,
              variationData.price || null,
              variationData.cost_price || null,
              variationData.purchase_price || null,
            ]
          )

          const variation = variationResult.rows[0]

          // Create inventory record for this variation
          const initialQuantity = variationData.initial_quantity || 0
          const minStockLevel = variationData.min_stock_level || 5
          const maxStockLevel = variationData.max_stock_level || 100

          // Check if inventory record already exists for this product, variation, and branch
          const existingInventory = await query(
            `SELECT id FROM inventory WHERE product_id = $1 AND variation_id = $2 AND branch_id = $3`,
            [product.id, variation.id, validatedData.branch_id]
          )

          if (existingInventory.rows.length === 0) {
            // Only create if it doesn't exist
            await query(
              `INSERT INTO inventory (product_id, variation_id, branch_id, quantity, min_stock_level, max_stock_level)
               VALUES ($1, $2, $3, $4, $5, $6)`,
              [product.id, variation.id, validatedData.branch_id, initialQuantity, minStockLevel, maxStockLevel]
            )
          } else {
            // Update existing inventory record
            await query(
              `UPDATE inventory SET 
                 quantity = $1,
                 min_stock_level = $2,
                 max_stock_level = $3,
                 updated_at = NOW()
               WHERE product_id = $4 AND variation_id = $5 AND branch_id = $6`,
              [initialQuantity, minStockLevel, maxStockLevel, product.id, variation.id, validatedData.branch_id]
            )
          }
        }
      }

      await query('COMMIT')

      return NextResponse.json(
        {
          success: true,
          data: product,
          message: "Product created successfully",
        },
        { status: 201 },
      )
    } catch (error) {
      await query('ROLLBACK')
      throw error
    }
  } catch (error) {
    console.error("Create product error:", error)

    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: error.errors[0].message }, { status: 400 })
    }

    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
