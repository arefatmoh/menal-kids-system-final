export const dynamic = 'force-dynamic'
import { type NextRequest, NextResponse } from "next/server"
import { getUserFromRequest, hasPermissionForBranch } from "@/lib/auth"
import { query } from "@/lib/db"

// GET /api/inventory/optimized - Get optimized inventory data
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = Number.parseInt(searchParams.get("page") || "1")
    const limit = Number.parseInt(searchParams.get("limit") || "20")
    const search = searchParams.get("search") || ""
    const branchId = searchParams.get("branch_id")
    const crossBranchSearch = searchParams.get("cross_branch") === "true"

    // Handle branch filtering and permissions
    let effectiveBranchId = branchId
    if (user.role === "employee" && !crossBranchSearch) {
      effectiveBranchId = user.branch_id || branchId
    }

    if (effectiveBranchId && !crossBranchSearch && !hasPermissionForBranch(user, effectiveBranchId)) {
      return NextResponse.json({ success: false, error: "Access denied to this branch" }, { status: 403 })
    }

    // Use optimized inventory function with safe types
    let result
    try {
      result = await query(
        "SELECT * FROM get_inventory_fast($1, $2, $3, $4::varchar, $5)",
        [page, limit, search || null, effectiveBranchId || null, crossBranchSearch]
      )
    } catch (err: any) {
      // Fallback to standard inventory endpoint when optimized function fails (e.g., operator mismatch)
      console.error("Optimized inventory error:", err)
      const base = new URL(request.url)
      base.pathname = "/api/inventory"
      // forward essential params
      const fallbackUrl = `${base.toString()}`
      const fallbackRes = await fetch(fallbackUrl, { headers: { authorization: request.headers.get("authorization") || "" } })
      const fallbackJson = await fallbackRes.json()
      return NextResponse.json(fallbackJson, { status: fallbackRes.status })
    }

    if (!result.rows || result.rows.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        pagination: {
          page,
          limit,
          total: 0,
          total_pages: 0,
          has_next: false,
          has_prev: false
        }
      }, {
        headers: {
          "Cache-Control": "private, max-age=10",
        },
      })
    }

    const inventoryData = result.rows[0]
    
    // Safely parse JSON with fallbacks
    let data, pagination
    try {
      data = inventoryData.data ? JSON.parse(inventoryData.data) : []
      pagination = inventoryData.pagination ? JSON.parse(inventoryData.pagination) : {
        page,
        limit,
        total: 0,
        total_pages: 0,
        has_next: false,
        has_prev: false
      }
    } catch (parseError) {
      console.error("JSON parse error:", parseError)
      // Fallback to empty data if parsing fails
      data = []
      pagination = {
        page,
        limit,
        total: 0,
        total_pages: 0,
        has_next: false,
        has_prev: false
      }
    }

    return NextResponse.json({
      success: true,
      data,
      pagination,
    }, {
      headers: {
        "Cache-Control": "private, max-age=10",
      },
    })
  } catch (error) {
    console.error("Optimized inventory error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
