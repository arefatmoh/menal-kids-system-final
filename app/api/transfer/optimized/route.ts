export const dynamic = 'force-dynamic'
import { type NextRequest, NextResponse } from "next/server"
import { getUserFromRequest, hasPermissionForBranch } from "@/lib/auth"
import { query } from "@/lib/db"

// GET /api/transfer/optimized - Get optimized transfer data
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const fromBranchId = searchParams.get("from_branch_id")

    // Check permissions
    if (fromBranchId && !hasPermissionForBranch(user, fromBranchId)) {
      return NextResponse.json({ success: false, error: "Access denied to this branch" }, { status: 403 })
    }

    // Use optimized transfer function
    const result = await query(
      "SELECT get_transfer_fast_simple($1)",
      [fromBranchId || null]
    )

    if (!result.rows[0] || !result.rows[0].get_transfer_fast_simple) {
      console.error('No data returned from get_transfer_fast_simple function')
      return NextResponse.json({ 
        success: false, 
        error: "Database function returned no data" 
      }, { status: 500 })
    }

    const transferData = result.rows[0].get_transfer_fast_simple

    // Ensure we have the expected structure
    if (!transferData || typeof transferData !== 'object') {
      console.error('Invalid data structure from get_transfer_fast:', transferData)
      return NextResponse.json({ 
        success: false, 
        error: "Invalid data structure from database function" 
      }, { status: 500 })
    }

    // Ensure all required arrays exist
    const safeData = {
      products: Array.isArray(transferData.products) ? transferData.products : [],
      variations: Array.isArray(transferData.variations) ? transferData.variations : [],
      transfers: Array.isArray(transferData.transfers) ? transferData.transfers : [],
      branches: Array.isArray(transferData.branches) ? transferData.branches : []
    }

    return NextResponse.json({
      success: true,
      data: safeData,
    }, {
      headers: {
        "Cache-Control": "private, max-age=10",
      },
    })
  } catch (error) {
    console.error("Optimized transfer error:", error)
    return NextResponse.json({ 
      success: false, 
      error: "Internal server error",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}
