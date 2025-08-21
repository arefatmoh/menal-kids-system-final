import { type NextRequest, NextResponse } from "next/server"
import { getUserFromRequest, isOwner } from "@/lib/auth"
import { query } from "@/lib/db"
import { z } from "zod"

const createBranchSchema = z.object({
  id: z.string().min(1, "Branch ID is required"),
  name: z.string().min(1, "Branch name is required"),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  manager_name: z.string().optional(),
})

// GET /api/branches - Get all branches
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const result = await query("SELECT * FROM branches WHERE is_active = true ORDER BY name")

    return NextResponse.json({
      success: true,
      data: result.rows,
    })
  } catch (error) {
    console.error("Get branches error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}

// POST /api/branches - Create new branch (owner only)
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user || !isOwner(user)) {
      return NextResponse.json({ success: false, error: "Access denied. Owner privileges required." }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = createBranchSchema.parse(body)

    // Check if branch ID already exists
    const existingBranch = await query("SELECT id FROM branches WHERE id = $1", [validatedData.id])

    if (existingBranch.rows.length > 0) {
      return NextResponse.json({ success: false, error: "Branch ID already exists" }, { status: 400 })
    }

    // Create branch
    const result = await query(
      `INSERT INTO branches (id, name, address, phone, email, manager_name)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        validatedData.id,
        validatedData.name,
        validatedData.address || null,
        validatedData.phone || null,
        validatedData.email || null,
        validatedData.manager_name || null,
      ],
    )

    return NextResponse.json(
      {
        success: true,
        data: result.rows[0],
        message: "Branch created successfully",
      },
      { status: 201 },
    )
  } catch (error) {
    console.error("Create branch error:", error)

    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: error.errors[0].message }, { status: 400 })
    }

    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
