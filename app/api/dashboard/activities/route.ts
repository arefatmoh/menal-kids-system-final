export const dynamic = 'force-dynamic'
import { type NextRequest, NextResponse } from "next/server"
import { getUserFromRequest, hasPermissionForBranch } from "@/lib/auth"
import { query } from "@/lib/db"

export async function GET(request: NextRequest) {
  try {
    // Get user from request
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    // Get parameters from query
    const { searchParams } = new URL(request.url)
    const branchId = searchParams.get("branch_id")
    const limit = Number.parseInt(searchParams.get("limit") || "10")

    // Check permissions
    if (branchId && !hasPermissionForBranch(user, branchId)) {
      return NextResponse.json({ success: false, error: "Access denied to this branch" }, { status: 403 })
    }

    // Get recent activities using the database function
    const result = await query("SELECT * FROM get_recent_activities($1, $2)", [branchId || null, limit])

    return NextResponse.json({
      success: true,
      data: result.rows,
    })
  } catch (error) {
    console.error("Dashboard activities error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
} 