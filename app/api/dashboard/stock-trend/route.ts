import { type NextRequest, NextResponse } from "next/server"
import { getUserFromRequest, hasPermissionForBranch } from "@/lib/auth"
import { query } from "@/lib/db"

// GET /api/dashboard/stock-trend - Get stock trend data for the last 7 days
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

    // Get stock trend data for the last 7 days
    const result = await query(`
      WITH daily_stock AS (
        SELECT 
          DATE(sm.created_at) as date,
          SUM(CASE WHEN sm.movement_type = 'in' THEN sm.quantity ELSE 0 END) as stock_in,
          SUM(CASE WHEN sm.movement_type = 'out' THEN sm.quantity ELSE 0 END) as stock_out
        FROM stock_movements sm
        WHERE sm.created_at >= CURRENT_DATE - INTERVAL '7 days'
          AND (sm.branch_id = $1 OR $1 IS NULL)
        GROUP BY DATE(sm.created_at)
        ORDER BY DATE(sm.created_at)
      ),
      current_total AS (
        SELECT COALESCE(SUM(i.quantity), 0) as total_stock
        FROM inventory i
        WHERE (i.branch_id = $1 OR $1 IS NULL)
      )
      SELECT 
        TO_CHAR(ds.date, 'Dy') as day_name,
        ds.date,
        ds.stock_in,
        ds.stock_out,
        (SELECT total_stock FROM current_total) as current_total_stock
      FROM daily_stock ds
      ORDER BY ds.date
    `, [branchId || null])

    // Process the data to create a trend
    const stockTrend = result.rows.map((row: any, index: number) => {
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
      const date = new Date(row.date)
      const dayName = dayNames[date.getDay()]
      
      // Calculate net stock change for this day
      const netChange = (row.stock_in || 0) - (row.stock_out || 0)
      
      return {
        name: dayName,
        date: row.date,
        stock_in: row.stock_in || 0,
        stock_out: row.stock_out || 0,
        net_change: netChange,
        total_stock: row.current_total_stock || 0
      }
    })

    // If we don't have 7 days of data, fill in missing days
    const today = new Date()
    const last7Days = []
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today)
      date.setDate(today.getDate() - i)
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
      const dayName = dayNames[date.getDay()]
      const dateStr = date.toISOString().split('T')[0]
      
      const existingData = stockTrend.find((item: any) => item.date === dateStr)
      if (existingData) {
        last7Days.push(existingData)
      } else {
        last7Days.push({
          name: dayName,
          date: dateStr,
          stock_in: 0,
          stock_out: 0,
          net_change: 0,
          total_stock: stockTrend.length > 0 ? stockTrend[0].total_stock : 0
        })
      }
    }

    return NextResponse.json({
      success: true,
      data: last7Days
    })
  } catch (error) {
    console.error("Get stock trend error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
