export const dynamic = 'force-dynamic'
import { type NextRequest, NextResponse } from "next/server"
import { getUserFromRequest, hasPermissionForBranch, isOwner } from "@/lib/auth"
import { query } from "@/lib/db"

// GET /api/reports/sales - Get sales reports
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

    // Get sales data using the database function
    const result = await query("SELECT * FROM get_sales_data($1, $2, $3, $4)", [
      branchId || null,
      startDate || null,
      endDate || null,
      timeRange,
    ])

    return NextResponse.json({
      success: true,
      data: result.rows,
    })
  } catch (error) {
    console.error("Get sales report error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
