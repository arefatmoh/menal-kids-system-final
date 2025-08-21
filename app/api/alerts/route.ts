import { type NextRequest, NextResponse } from "next/server"
import { getUserFromRequest, hasPermissionForBranch } from "@/lib/auth"
import { query } from "@/lib/db"

// GET /api/alerts - Get alerts
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const branchId = searchParams.get("branch_id")
    const status = searchParams.get("status") || "active"
    const severity = searchParams.get("severity")
    const type = searchParams.get("type")

    // Check branch permission
    if (branchId && !hasPermissionForBranch(user, branchId)) {
      return NextResponse.json({ success: false, error: "Access denied to this branch" }, { status: 403 })
    }

    let whereClause = "WHERE 1=1"
    const params: any[] = []
    let paramCount = 0

    if (status) {
      paramCount++
      whereClause += ` AND status = $${paramCount}`
      params.push(status)
    }

    if (branchId) {
      paramCount++
      whereClause += ` AND (branch_id = $${paramCount} OR branch_id IS NULL)`
      params.push(branchId)
    } else if (user.role === "employee") {
      paramCount++
      whereClause += ` AND (branch_id = $${paramCount} OR branch_id IS NULL)`
      params.push(user.branch_id)
    }

    if (severity) {
      paramCount++
      whereClause += ` AND severity = $${paramCount}`
      params.push(severity)
    }

    if (type) {
      paramCount++
      whereClause += ` AND type = $${paramCount}`
      params.push(type)
    }

    const alertsQuery = `
      SELECT 
        a.*,
        b.name as branch_name
      FROM alerts a
      LEFT JOIN branches b ON a.branch_id = b.id
      ${whereClause}
      ORDER BY 
        CASE severity
          WHEN 'critical' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          WHEN 'low' THEN 4
        END,
        a.created_at DESC
    `

    const result = await query(alertsQuery, params)

    return NextResponse.json({
      success: true,
      data: result.rows,
    })
  } catch (error) {
    console.error("Get alerts error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}

// PUT /api/alerts/[id] - Update alert status
export async function PUT(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { id, status, notes } = body

    if (!id || !status) {
      return NextResponse.json({ success: false, error: "Alert ID and status are required" }, { status: 400 })
    }

    // Get alert to check permissions
    const alertResult = await query("SELECT * FROM alerts WHERE id = $1", [id])

    if (alertResult.rows.length === 0) {
      return NextResponse.json({ success: false, error: "Alert not found" }, { status: 404 })
    }

    const alert = alertResult.rows[0]

    // Check branch permission
    if (alert.branch_id && !hasPermissionForBranch(user, alert.branch_id)) {
      return NextResponse.json({ success: false, error: "Access denied to this branch" }, { status: 403 })
    }

    // Update alert
    const updateResult = await query(
      `UPDATE alerts 
       SET status = $1, 
           notes = COALESCE($2, notes),
           acknowledged_at = CASE WHEN $1 = 'acknowledged' THEN NOW() ELSE acknowledged_at END,
           resolved_at = CASE WHEN $1 = 'resolved' THEN NOW() ELSE resolved_at END,
           updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [status, notes || null, id],
    )

    return NextResponse.json({
      success: true,
      data: updateResult.rows[0],
      message: "Alert updated successfully",
    })
  } catch (error) {
    console.error("Update alert error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
