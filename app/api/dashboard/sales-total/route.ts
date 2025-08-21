export const dynamic = 'force-dynamic'
import { type NextRequest, NextResponse } from "next/server"
import { getUserFromRequest, hasPermissionForBranch, isOwner } from "@/lib/auth"
import { query } from "@/lib/db"

// GET /api/dashboard/sales-total - Get today's sales total
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const branchId = searchParams.get("branch_id")

    // Check branch permission
    if (branchId && !hasPermissionForBranch(user, branchId)) {
      return NextResponse.json({ success: false, error: "Access denied to this branch" }, { status: 403 })
    }

    // Use the direct database function for accurate totals
    const result = await query("SELECT get_today_sales_total($1) as total_sales", [
      branchId || null
    ])

    const totalSales = result.rows[0]?.total_sales || 0

    return NextResponse.json({
      success: true,
      data: {
        total_sales: totalSales
      }
    })
  } catch (error) {
    console.error("Get sales total error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
