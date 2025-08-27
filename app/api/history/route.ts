export const dynamic = 'force-dynamic'
import { type NextRequest, NextResponse } from "next/server"
import { getUserFromRequest, hasPermissionForBranch } from "@/lib/auth"
import { query } from "@/lib/db"

// GET /api/history - list recent activities with optional filters
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = Math.min(Number(searchParams.get("limit") ?? 100), 200)
    const type = searchParams.get("type")
    let branchId = searchParams.get("branch_id")
    const userId = searchParams.get("user_id")

    // Default employees to their own branch when none is provided
    if (!branchId && user.role === 'employee') {
      branchId = user.branch_id || null
    }

    if (branchId && !hasPermissionForBranch(user, branchId)) {
      return NextResponse.json({ success: false, error: "Access denied to this branch" }, { status: 403 })
    }

    const result = await query(
      "SELECT * FROM get_recent_activities($1::int, $2::text, $3::text, $4::text)",
      [limit || 100, type || null, branchId || null, userId || null]
    )

    return NextResponse.json({ success: true, data: result.rows })
  } catch (error) {
    console.error("History list error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}


