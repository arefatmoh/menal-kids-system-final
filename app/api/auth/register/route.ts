import { type NextRequest, NextResponse } from "next/server"
import { hashPassword } from "@/lib/auth"
import { query } from "@/lib/db"
import { z } from "zod"

const registerSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  full_name: z.string().min(1, "Full name is required"),
  role: z.enum(["owner", "employee"]),
  branch_id: z.string().optional(),
  phone: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate input
    const validatedData = registerSchema.parse(body)

    // Check if email already exists
    const existingUser = await query("SELECT id FROM users WHERE email = $1", [validatedData.email])

    if (existingUser.rows.length > 0) {
      return NextResponse.json({ success: false, error: "Email already exists" }, { status: 400 })
    }

    // Validate branch_id for employees
    if (validatedData.role === "employee" && !validatedData.branch_id) {
      return NextResponse.json({ success: false, error: "Branch ID is required for employees" }, { status: 400 })
    }

    // Hash password
    const hashedPassword = await hashPassword(validatedData.password)

    // Create user
    const result = await query(
      `INSERT INTO users (email, password_hash, full_name, role, branch_id, phone)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, email, full_name, role, branch_id, phone, is_active, created_at`,
      [
        validatedData.email,
        hashedPassword,
        validatedData.full_name,
        validatedData.role,
        validatedData.branch_id || null,
        validatedData.phone || null,
      ],
    )

    const user = result.rows[0]

    return NextResponse.json(
      {
        success: true,
        data: user,
        message: "User created successfully",
      },
      { status: 201 },
    )
  } catch (error) {
    console.error("Registration error:", error)

    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: error.errors[0].message }, { status: 400 })
    }

    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
