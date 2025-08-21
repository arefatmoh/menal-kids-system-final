export const dynamic = 'force-dynamic'
import { type NextRequest, NextResponse } from "next/server"
import { getUserFromRequest, isOwner } from "@/lib/auth"
import { query } from "@/lib/db"

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user || !isOwner(user)) {
      return NextResponse.json({ success: false, error: "Access denied. Owner privileges required." }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const branchId = searchParams.get("branch_id")

    // Get all branches
    const branchesResult = await query("SELECT * FROM branches WHERE is_active = true")
    
    // Get inventory for specific branch or all branches
    let inventoryQuery = `
      SELECT 
        i.*,
        p.name as product_name,
        p.sku,
        b.name as branch_name,
        c.name as category_name
      FROM inventory i
      JOIN products p ON i.product_id = p.id
      JOIN branches b ON i.branch_id = b.id
      JOIN categories c ON p.category_id = c.id
      WHERE p.is_active = true
    `
    
    const params: any[] = []
    if (branchId) {
      inventoryQuery += " AND i.branch_id = $1"
      params.push(branchId)
    }
    
    inventoryQuery += " ORDER BY p.name, b.name"
    
    const inventoryResult = await query(inventoryQuery, params)
    
    // Get summary stats
    const summaryQuery = `
      SELECT 
        b.name as branch_name,
        COUNT(i.id) as inventory_count,
        COUNT(DISTINCT i.product_id) as unique_products
      FROM branches b
      LEFT JOIN inventory i ON b.id = i.branch_id
      WHERE b.is_active = true
      GROUP BY b.id, b.name
      ORDER BY b.name
    `
    
    const summaryResult = await query(summaryQuery)

    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          branch_id: user.branch_id
        },
        branches: branchesResult.rows,
        inventory: inventoryResult.rows,
        summary: summaryResult.rows,
        query_params: {
          branch_id: branchId
        }
      }
    })
  } catch (error) {
    console.error("Debug inventory error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
} 