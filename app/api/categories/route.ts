import { type NextRequest, NextResponse } from "next/server"
import { getUserFromRequest } from "@/lib/auth"
import { query } from "@/lib/db"
import { z } from "zod"

const createCategorySchema = z.object({
  name: z.string().min(1, "Category name is required"),
  description: z.string().optional(),
  parent_id: z.string().uuid().optional(),
})

// GET /api/categories - Get all categories
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const result = await query(
      `SELECT 
         c.*,
         pc.name as parent_name,
         COUNT(p.id) as product_count
       FROM categories c
       LEFT JOIN categories pc ON c.parent_id = pc.id
       LEFT JOIN products p ON c.id = p.category_id AND p.is_active = true
       WHERE c.is_active = true
       GROUP BY c.id, pc.name
       ORDER BY c.name`,
    )

    return NextResponse.json({
      success: true,
      data: result.rows,
    })
  } catch (error) {
    console.error("Get categories error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}

// POST /api/categories - Create new category
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = createCategorySchema.parse(body)

    // Create category
    const result = await query(
      `INSERT INTO categories (name, description, parent_id)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [validatedData.name, validatedData.description || null, validatedData.parent_id || null],
    )

    return NextResponse.json(
      {
        success: true,
        data: result.rows[0],
        message: "Category created successfully",
      },
      { status: 201 },
    )
  } catch (error) {
    console.error("Create category error:", error)

    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: error.errors[0].message }, { status: 400 })
    }

    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
