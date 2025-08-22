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

    // Get branch_id from query params
    const { searchParams } = new URL(request.url)
    const branchId = searchParams.get("branch_id")

    // Check permissions
    if (branchId && !hasPermissionForBranch(user, branchId)) {
      return NextResponse.json({ success: false, error: "Access denied to this branch" }, { status: 403 })
    }

    // Get dashboard stats (cast param to varchar to avoid unknown/null type resolution issues)
    const result = await query("SELECT * FROM public.get_dashboard_stats($1::varchar)", [branchId || null])

    const stats = result.rows[0]

    return NextResponse.json(
      {
        success: true,
        data: stats,
      },
      {
        headers: {
          // Safe short-lived private caching to speed up navigation
          "Cache-Control": "private, max-age=10",
        },
      },
    )
  } catch (error) {
    console.error("Dashboard stats error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
