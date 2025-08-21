export const dynamic = 'force-dynamic'
import { type NextRequest, NextResponse } from "next/server"
import { getUserFromRequest, hasPermissionForBranch } from "@/lib/auth"
import { query } from "@/lib/db"
import { z } from "zod"

const updateInventorySchema = z.object({
  product_id: z.string().uuid("Invalid product ID"),
  variation_id: z.string().uuid("Invalid variation ID").optional(),
  branch_id: z.string().min(1, "Branch ID is required"),
  quantity: z.number().int().min(0, "Quantity must be non-negative"),
  min_stock_level: z.number().int().min(0).optional(),
  max_stock_level: z.number().int().min(0).optional(),
  delete_record: z.boolean().optional(),
})

// GET /api/inventory - Get inventory with filters
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
    const status = searchParams.get("status") || ""
    const category = searchParams.get("category") || ""
    const branchId = searchParams.get("branch_id")
    const crossBranchSearch = searchParams.get("cross_branch") === "true"
    const lowStockOnly = searchParams.get("low_stock_only") === "true"
    const productIdFilter = searchParams.get("product_id") || ""
    const variationIdFilter = searchParams.get("variation_id") || ""
    
    // New filter parameters
    const brand = searchParams.get("brand") || ""
    const gender = searchParams.get("gender") || ""
    const ageRange = searchParams.get("age_range") || ""
    const size = searchParams.get("size") || ""
    const color = searchParams.get("color") || ""
    const priceMin = searchParams.get("price_min")
    const priceMax = searchParams.get("price_max")
    const stockMin = searchParams.get("stock_min")
    const stockMax = searchParams.get("stock_max")

    // Handle branch filtering and permissions consistently for both search modes
    let effectiveBranchId = branchId
    if (user.role === "employee" && !crossBranchSearch) {
      effectiveBranchId = user.branch_id || branchId
    }

    // Permission check: same logic for both modes
    if (effectiveBranchId && !crossBranchSearch && !hasPermissionForBranch(user, effectiveBranchId)) {
      return NextResponse.json({ success: false, error: "Access denied to this branch" }, { status: 403 })
    }

    console.log('Inventory API - User:', user.role, 'Branch:', user.branch_id, 'CrossBranch:', crossBranchSearch, 'EffectiveBranchId:', effectiveBranchId, 'SearchMode:', crossBranchSearch ? 'Cross-Branch' : 'Current Branch')

    const offset = (page - 1) * limit

    let whereClause = "WHERE p.is_active = true"
    const params: any[] = []
    let paramCount = 0

    // Branch filtering: same logic for both search modes
    if (effectiveBranchId && !crossBranchSearch) {
      // Current branch search: filter by specific branch
      paramCount++
      whereClause += ` AND i.branch_id = $${paramCount}`
      params.push(effectiveBranchId)
    } else if (crossBranchSearch) {
      // Cross-branch search: no branch filtering, search across all branches
      // Note: No additional WHERE clause needed
    }

    // Explicit product/variation filters when provided
    if (productIdFilter) {
      paramCount++
      whereClause += ` AND p.id = $${paramCount}`
      params.push(productIdFilter)
    }
    if (variationIdFilter) {
      paramCount++
      whereClause += ` AND pv.id = $${paramCount}`
      params.push(variationIdFilter)
    }

    if (lowStockOnly) {
      whereClause += " AND i.quantity <= i.min_stock_level"
    }

    if (search) {
      paramCount++
      
      // Advanced search implementation based on search type and mode
      if (searchType === "exact" && searchMode === "exact") {
        // Exact match for < 3 characters: matches exact text in names, SKUs, brands, categories
        // Use word boundaries or exact matches for better precision
        whereClause += ` AND (
          p.name ILIKE $${paramCount} OR 
          p.name ILIKE $${paramCount + 1} OR 
          p.sku ILIKE $${paramCount} OR 
          pv.sku ILIKE $${paramCount} OR 
          p.brand ILIKE $${paramCount} OR 
          c.name ILIKE $${paramCount}
        )`
        params.push(`%${search}%`) // Contains anywhere
        params.push(`${search}%`)  // Starts with
        paramCount++
      } else if (searchType === "partial" && searchMode === "contains") {
        // Partial match for 3-5 characters: finds "dre" in "dress"
        // Searches in names, SKUs, brands, categories, colors, sizes
        whereClause += ` AND (
          p.name ILIKE $${paramCount} OR 
          p.sku ILIKE $${paramCount} OR 
          pv.sku ILIKE $${paramCount} OR 
          p.brand ILIKE $${paramCount} OR 
          c.name ILIKE $${paramCount} OR 
          pv.color ILIKE $${paramCount} OR 
          pv.size ILIKE $${paramCount}
        )`
        params.push(`%${search}%`)
      } else if (searchType === "phrase" && searchMode === "exact") {
        // Phrase match for 6+ characters: requires all words to be present
        const words = search.split(/\s+/).filter(word => word.length > 0)
        if (words.length > 1) {
          // Multiple words: require all words to be present in any field
          const wordConditions = words.map((_, index) => {
            paramCount++
            return `(
              p.name ILIKE $${paramCount} OR 
              p.sku ILIKE $${paramCount} OR 
              pv.sku ILIKE $${paramCount} OR 
              p.brand ILIKE $${paramCount} OR 
              c.name ILIKE $${paramCount} OR
              pv.color ILIKE $${paramCount} OR
              pv.size ILIKE $${paramCount}
            )`
          })
          whereClause += ` AND (${wordConditions.join(" AND ")})`
          words.forEach(word => params.push(`%${word}%`))
        } else {
          // Single word: comprehensive search across all fields
          whereClause += ` AND (
            p.name ILIKE $${paramCount} OR 
            p.sku ILIKE $${paramCount} OR 
            pv.sku ILIKE $${paramCount} OR 
            p.brand ILIKE $${paramCount} OR 
            c.name ILIKE $${paramCount} OR
            pv.color ILIKE $${paramCount} OR
            pv.size ILIKE $${paramCount}
          )`
          params.push(`%${search}%`)
        }
      } else {
        // Fallback: comprehensive search for any other combination
        whereClause += ` AND (
          p.name ILIKE $${paramCount} OR 
          p.sku ILIKE $${paramCount} OR 
          pv.sku ILIKE $${paramCount} OR 
          p.brand ILIKE $${paramCount} OR 
          c.name ILIKE $${paramCount} OR
          pv.color ILIKE $${paramCount} OR
          pv.size ILIKE $${paramCount}
        )`
        params.push(`%${search}%`)
      }
    }

    if (status && status !== "all") {
      if (status === "out_of_stock") {
        whereClause += " AND i.quantity = 0"
      } else if (status === "low_stock") {
        whereClause += " AND i.min_stock_level IS NOT NULL AND i.quantity <= i.min_stock_level AND i.quantity > 0"
      } else if (status === "overstock") {
        whereClause += " AND i.max_stock_level IS NOT NULL AND i.quantity >= i.max_stock_level"
      } else if (status === "normal") {
        whereClause += " AND ((i.min_stock_level IS NOT NULL AND i.max_stock_level IS NOT NULL AND i.quantity > i.min_stock_level AND i.quantity < i.max_stock_level) OR (i.min_stock_level IS NULL AND i.max_stock_level IS NULL AND i.quantity > 0))"
      }
    }

    if (category && category !== "all") {
      paramCount++
      // Support filtering by either category name or id passed as text
      whereClause += ` AND (c.id::text = $${paramCount} OR c.name = $${paramCount})`
      params.push(category)
    }

    // New filter conditions
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
      whereClause += ` AND pv.size = $${paramCount}`
      params.push(size)
    }

    if (color && color !== "all") {
      paramCount++
      whereClause += ` AND pv.color = $${paramCount}`
      params.push(color)
    }

    if (priceMin) {
      paramCount++
      whereClause += ` AND pv.price >= $${paramCount}`
      params.push(parseFloat(priceMin))
    }

    if (priceMax) {
      paramCount++
      whereClause += ` AND pv.price <= $${paramCount}`
      params.push(parseFloat(priceMax))
    }

    if (stockMin) {
      paramCount++
      whereClause += ` AND i.quantity >= $${paramCount}`
      params.push(parseInt(stockMin))
    }

    if (stockMax) {
      paramCount++
      whereClause += ` AND i.quantity <= $${paramCount}`
      params.push(parseInt(stockMax))
    }

    const inventoryQuery = `
      SELECT 
        i.*,
        p.id as product_id,
        p.name as product_name,
        p.sku as product_sku,
        p.product_type,
        p.brand,
        p.age_range,
        p.gender,
        p.description,
        p.image_url,
        pv.id as variation_id,
        pv.sku as variation_sku,
        pv.color,
        pv.size,
        pv.price,
        pv.cost_price,
        pv.purchase_price,
        b.name as branch_name,
        c.name as category_name,
        CASE 
          WHEN i.quantity = 0 THEN 'out_of_stock'
          WHEN i.min_stock_level IS NOT NULL AND i.quantity <= i.min_stock_level THEN 'low_stock'
          WHEN i.max_stock_level IS NOT NULL AND i.quantity >= i.max_stock_level THEN 'overstock'
          ELSE 'normal'
        END as stock_status
      FROM inventory i
      JOIN products p ON i.product_id = p.id
      LEFT JOIN product_variations pv ON i.variation_id = pv.id
      JOIN branches b ON i.branch_id = b.id
      JOIN categories c ON p.category_id = c.id
      ${whereClause}
      ORDER BY p.name ASC, pv.color ASC NULLS LAST, pv.size ASC NULLS LAST
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `

    params.push(limit, offset)

    const result = await query(inventoryQuery, params)

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM inventory i
      JOIN products p ON i.product_id = p.id
      LEFT JOIN product_variations pv ON i.variation_id = pv.id
      JOIN branches b ON i.branch_id = b.id
      JOIN categories c ON p.category_id = c.id
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
    console.error("Get inventory error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}

// PUT /api/inventory - Update inventory
export async function PUT(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = updateInventorySchema.parse(body)

    // Check branch permission
    if (!hasPermissionForBranch(user, validatedData.branch_id)) {
      return NextResponse.json({ success: false, error: "Access denied to this branch" }, { status: 403 })
    }

    // Start transaction
    await query('BEGIN')

    try {
      if (validatedData.delete_record) {
        // Delete inventory record
        await query(
          `DELETE FROM inventory WHERE product_id = $1 AND branch_id = $2`,
          [validatedData.product_id, validatedData.branch_id]
        )
      } else {
        // Update or insert inventory record
        if (validatedData.variation_id) {
          await query(
            `INSERT INTO inventory (product_id, variation_id, branch_id, quantity, min_stock_level, max_stock_level)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (product_id, variation_id, branch_id)
             DO UPDATE SET 
               quantity = EXCLUDED.quantity,
               min_stock_level = EXCLUDED.min_stock_level,
               max_stock_level = EXCLUDED.max_stock_level,
               updated_at = NOW()`,
            [
              validatedData.product_id,
              validatedData.variation_id,
              validatedData.branch_id,
              validatedData.quantity,
              validatedData.min_stock_level || 5,
              validatedData.max_stock_level || 100,
            ]
          )
        } else {
          // If no variation_id provided, perform an update by product + branch, else insert a new row with NULL variation
          const updateResult = await query(
            `UPDATE inventory 
             SET quantity = $1,
                 min_stock_level = $2,
                 max_stock_level = $3,
                 updated_at = NOW()
             WHERE product_id = $4 AND branch_id = $5`,
            [
              validatedData.quantity,
              validatedData.min_stock_level || 5,
              validatedData.max_stock_level || 100,
              validatedData.product_id,
              validatedData.branch_id,
            ]
          )
          if (updateResult.rowCount === 0) {
            await query(
              `INSERT INTO inventory (product_id, variation_id, branch_id, quantity, min_stock_level, max_stock_level)
               VALUES ($1, NULL, $2, $3, $4, $5)`,
              [
                validatedData.product_id,
                validatedData.branch_id,
                validatedData.quantity,
                validatedData.min_stock_level || 5,
                validatedData.max_stock_level || 100,
              ]
            )
          }
        }

        // Record stock movement
        await query(
          `INSERT INTO stock_movements (product_id, branch_id, user_id, movement_type, quantity, reason, reference_type)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            validatedData.product_id,
            validatedData.branch_id,
            user.id,
            validatedData.quantity > 0 ? 'in' : 'out',
            Math.abs(validatedData.quantity),
            'Manual adjustment',
            'adjustment'
          ]
        )
      }

      await query('COMMIT')

      return NextResponse.json({
        success: true,
        message: validatedData.delete_record ? "Inventory record deleted successfully" : "Inventory updated successfully",
      })
    } catch (error) {
      await query('ROLLBACK')
      throw error
    }
  } catch (error) {
    console.error("Update inventory error:", error)

    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: error.errors[0].message }, { status: 400 })
    }

    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
