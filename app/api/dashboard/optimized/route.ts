export const dynamic = 'force-dynamic'
import { type NextRequest, NextResponse } from "next/server"
import { getUserFromRequest, hasPermissionForBranch } from "@/lib/auth"
import { query } from "@/lib/db"

// GET /api/dashboard/optimized - Get optimized dashboard data
export async function GET(request: NextRequest) {
  try {
    // Get user from request
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    // Get branch_id from query params
    const { searchParams } = new URL(request.url)
    const branchId = searchParams.get("branch_id")

    // Check permissions
    if (branchId && !hasPermissionForBranch(user, branchId)) {
      return NextResponse.json({ success: false, error: "Access denied to this branch" }, { status: 403 })
    }

    // Use optimized dashboard function
    const result = await query("SELECT get_dashboard_optimized($1::varchar)", [branchId || null])
    const dashboardData = result.rows[0].get_dashboard_optimized

    return NextResponse.json(
      {
        success: true,
        data: dashboardData,
      },
      {
        headers: {
          // Reduced cache time to ensure fresh data
          "Cache-Control": "private, max-age=5",
        },
      },
    )
  } catch (error) {
    console.error("Optimized dashboard error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
