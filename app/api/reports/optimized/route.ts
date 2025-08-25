export const dynamic = 'force-dynamic'
import { type NextRequest, NextResponse } from "next/server"
import { getUserFromRequest, hasPermissionForBranch, isOwner } from "@/lib/auth"
import { query } from "@/lib/db"

// GET /api/reports/optimized - Get optimized reports data
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user || !isOwner(user)) {
      return NextResponse.json({ success: false, error: "Access denied. Owner privileges required." }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const branchId = searchParams.get("branch_id")
    const startDate = searchParams.get("start_date")
    const endDate = searchParams.get("end_date")
    const timeRange = searchParams.get("time_range") || "daily"

    // Check branch permission
    if (branchId && !hasPermissionForBranch(user, branchId)) {
      return NextResponse.json({ success: false, error: "Access denied to this branch" }, { status: 403 })
    }

    // Use optimized reports function
    const result = await query("SELECT get_reports_fast($1, $2, $3, $4)", [
      timeRange,
      startDate || null,
      endDate || null,
      branchId || null,
    ])

    const reportsData = result.rows[0].get_reports_fast

    return NextResponse.json({
      success: true,
      data: reportsData,
    }, {
      headers: {
        "Cache-Control": "private, max-age=60", // Cache reports for 1 minute
      },
    })
  } catch (error) {
    console.error("Optimized reports error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
