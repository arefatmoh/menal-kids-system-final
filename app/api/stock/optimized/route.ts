export const dynamic = 'force-dynamic'
import { type NextRequest, NextResponse } from "next/server"
import { getUserFromRequest, hasPermissionForBranch } from "@/lib/auth"
import { query } from "@/lib/db"

// GET /api/stock/optimized - Get optimized stock data
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = Number.parseInt(searchParams.get("page") || "1")
    const limit = Number.parseInt(searchParams.get("limit") || "50")
    const branchId = searchParams.get("branch_id")

    // Check permissions
    if (branchId && !hasPermissionForBranch(user, branchId)) {
      return NextResponse.json({ success: false, error: "Access denied to this branch" }, { status: 403 })
    }

    // Use optimized stock function
    const result = await query(
      "SELECT * FROM get_stock_fast($1, $2, $3)",
      [branchId || null, page, limit]
    )

    if (!result.rows || result.rows.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          products: [],
          movements: [],
          branches: []
        }
      })
    }

    const stockData = result.rows[0]
    
    // Debug logs removed for production cleanliness

    // Compute aggregate totals for the requested branch or across all branches
    let summary: any = undefined
    if (branchId) {
      const agg = await query(
        `SELECT COALESCE(SUM(i.quantity), 0) AS total_units,
                COUNT(DISTINCT i.product_id) AS distinct_products
         FROM inventory i
         WHERE i.branch_id = $1`,
        [branchId]
      )
      summary = agg.rows[0] || { total_units: 0, distinct_products: 0 }
    } else {
      const agg = await query(
        `SELECT COALESCE(SUM(i.quantity), 0) AS total_units,
                COUNT(DISTINCT i.product_id) AS distinct_products
         FROM inventory i`,
        []
      )
      summary = agg.rows[0] || { total_units: 0, distinct_products: 0 }
    }

    return NextResponse.json({
      success: true,
      data: { ...(stockData.data || {}), ...(summary ? { summary } : {}) },
      pagination: stockData.pagination || {}
    }, {
      headers: {
        "Cache-Control": "private, max-age=10",
      },
    })
  } catch (error) {
    console.error("Optimized stock error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
