import { type NextRequest, NextResponse } from "next/server"
import { getUserFromRequest, hasPermissionForBranch } from "@/lib/auth"
import { query } from "@/lib/db"

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const branchId = searchParams.get("branch_id")
    const limit = searchParams.get("limit") || "7"

    if (branchId && !hasPermissionForBranch(user, branchId)) {
      return NextResponse.json({ success: false, error: "Access denied to this branch" }, { status: 403 })
    }

    const result = await query("SELECT * FROM get_recent_product_updates($1, $2)", [
      branchId || null,
      parseInt(limit)
    ])

    return NextResponse.json(
      {
        success: true,
        data: result.rows
      },
      {
        headers: {
          "Cache-Control": "private, max-age=10",
        },
      },
    )
  } catch (error) {
    console.error("Get recent product updates error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
