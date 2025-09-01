export const dynamic = 'force-dynamic'
import { type NextRequest, NextResponse } from "next/server"
import { getUserFromRequest, hasPermissionForBranch } from "@/lib/auth"
import { query } from "@/lib/db"

// GET /api/dashboard/daily-summary - Get daily summary data
export async function GET(request: NextRequest) {
  try {
    // Get user from request
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    // Get branch_id from query params
    const { searchParams } = new URL(request.url)
    const branchId = searchParams.get("branch_id")
    const date = searchParams.get("date") || new Date().toISOString().split('T')[0]

    // Check permissions
    if (branchId && !hasPermissionForBranch(user, branchId)) {
      return NextResponse.json({ success: false, error: "Access denied to this branch" }, { status: 403 })
    }

         // Get sales summary
     const salesQuery = branchId 
       ? `SELECT 
           COALESCE(SUM(s.total_amount), 0) as total_sales,
           COALESCE(COUNT(*), 0) as total_transactions,
           CASE WHEN COUNT(*) > 0 THEN COALESCE(SUM(s.total_amount) / COUNT(*), 0) ELSE 0 END as average_sale,
           json_build_object(
             'cash', COALESCE(SUM(CASE WHEN s.payment_method = 'cash' THEN s.total_amount ELSE 0 END), 0),
             'pos', COALESCE(SUM(CASE WHEN s.payment_method = 'pos' THEN s.total_amount ELSE 0 END), 0),
             'telebirr', COALESCE(SUM(CASE WHEN s.payment_method = 'telebirr' THEN s.total_amount ELSE 0 END), 0),
             'mobile_transfer', COALESCE(SUM(CASE WHEN s.payment_method = 'mobile_transfer' THEN s.total_amount ELSE 0 END), 0)
           ) as payment_methods
         FROM sales s
         WHERE DATE(s.created_at) = $1::date AND s.branch_id = $2`
             : `SELECT 
           COALESCE(SUM(s.total_amount), 0) as total_sales,
           COALESCE(COUNT(*), 0) as total_transactions,
           CASE WHEN COUNT(*) > 0 THEN COALESCE(SUM(s.total_amount) / COUNT(*), 0) ELSE 0 END as average_sale,
           json_build_object(
             'cash', COALESCE(SUM(CASE WHEN s.payment_method = 'cash' THEN s.total_amount ELSE 0 END), 0),
             'pos', COALESCE(SUM(CASE WHEN s.payment_method = 'pos' THEN s.total_amount ELSE 0 END), 0),
             'telebirr', COALESCE(SUM(CASE WHEN s.payment_method = 'telebirr' THEN s.total_amount ELSE 0 END), 0),
             'mobile_transfer', COALESCE(SUM(CASE WHEN s.payment_method = 'mobile_transfer' THEN s.total_amount ELSE 0 END), 0)
           ) as payment_methods
         FROM sales s
         WHERE DATE(s.created_at) = $1::date`
    const salesParams = branchId ? [date, branchId] : [date]
    const salesResult = await query(salesQuery, salesParams)
    const salesData = salesResult.rows[0]

    // Get all sold products today (not just top 5)
    const soldProductsQuery = branchId
      ? `SELECT 
          p.name as product_name,
          SUM(si.quantity) as quantity_sold,
          SUM(si.total_price) as total_amount,
          CASE 
            WHEN pv.id IS NOT NULL THEN 
              CONCAT(
                COALESCE(pv.color, ''), 
                CASE WHEN pv.color IS NOT NULL AND pv.size IS NOT NULL THEN ' - ' ELSE '' END,
                COALESCE(pv.size, '')
              )
            ELSE 'Standard'
          END as variation_info,
          json_build_object(
            'cash', COALESCE(SUM(CASE WHEN s.payment_method = 'cash' THEN si.total_price ELSE 0 END), 0),
            'pos', COALESCE(SUM(CASE WHEN s.payment_method = 'pos' THEN si.total_price ELSE 0 END), 0),
            'telebirr', COALESCE(SUM(CASE WHEN s.payment_method = 'telebirr' THEN si.total_price ELSE 0 END), 0),
            'mobile_transfer', COALESCE(SUM(CASE WHEN s.payment_method = 'mobile_transfer' THEN si.total_price ELSE 0 END), 0)
          ) as payment_breakdown
        FROM sale_items si
        JOIN sales s ON si.sale_id = s.id
        JOIN products p ON si.product_id = p.id
        LEFT JOIN product_variations pv ON si.variation_id = pv.id
        WHERE DATE(s.created_at) = $1::date AND s.branch_id = $2
        GROUP BY p.id, p.name, pv.id, pv.color, pv.size
        ORDER BY SUM(si.quantity) DESC`
      : `SELECT 
          p.name as product_name,
          SUM(si.quantity) as quantity_sold,
          SUM(si.total_price) as total_amount,
          CASE 
            WHEN pv.id IS NOT NULL THEN 
              CONCAT(
                COALESCE(pv.color, ''), 
                CASE WHEN pv.color IS NOT NULL AND pv.size IS NOT NULL THEN ' - ' ELSE '' END,
                COALESCE(pv.size, '')
              )
            ELSE 'Standard'
          END as variation_info,
          json_build_object(
            'cash', COALESCE(SUM(CASE WHEN s.payment_method = 'cash' THEN si.total_price ELSE 0 END), 0),
            'pos', COALESCE(SUM(CASE WHEN s.payment_method = 'pos' THEN si.total_price ELSE 0 END), 0),
            'telebirr', COALESCE(SUM(CASE WHEN s.payment_method = 'telebirr' THEN si.total_price ELSE 0 END), 0),
            'mobile_transfer', COALESCE(SUM(CASE WHEN s.payment_method = 'mobile_transfer' THEN si.total_price ELSE 0 END), 0)
          ) as payment_breakdown
        FROM sale_items si
        JOIN sales s ON si.sale_id = s.id
        JOIN products p ON si.product_id = p.id
        LEFT JOIN product_variations pv ON si.variation_id = pv.id
        WHERE DATE(s.created_at) = $1::date
        GROUP BY p.id, p.name, pv.id, pv.color, pv.size
        ORDER BY SUM(si.quantity) DESC`
    const soldProductsResult = await query(soldProductsQuery, salesParams)
    const soldProducts = soldProductsResult.rows

    // Get stock summary
    const stockQuery = branchId
      ? `SELECT 
          COALESCE(SUM(CASE WHEN sm.movement_type = 'in' THEN sm.quantity ELSE 0 END), 0) as stock_in,
          COALESCE(SUM(CASE WHEN sm.movement_type = 'out' THEN sm.quantity ELSE 0 END), 0) as stock_out,
          COALESCE(SUM(CASE WHEN sm.movement_type = 'adjustment' THEN ABS(sm.quantity) ELSE 0 END), 0) as stock_adjustments,
          COALESCE(COUNT(*), 0) as total_movements
        FROM stock_movements sm
        WHERE DATE(sm.created_at) = $1::date AND sm.branch_id = $2`
      : `SELECT 
          COALESCE(SUM(CASE WHEN sm.movement_type = 'in' THEN sm.quantity ELSE 0 END), 0) as stock_in,
          COALESCE(SUM(CASE WHEN sm.movement_type = 'out' THEN sm.quantity ELSE 0 END), 0) as stock_out,
          COALESCE(SUM(CASE WHEN sm.movement_type = 'adjustment' THEN ABS(sm.quantity) ELSE 0 END), 0) as stock_adjustments,
          COALESCE(COUNT(*), 0) as total_movements
        FROM stock_movements sm
        WHERE DATE(sm.created_at) = $1::date`
    const stockResult = await query(stockQuery, salesParams)
    const stockData = stockResult.rows[0]

    // Get recent stock movements
    const recentMovementsQuery = branchId
      ? `SELECT 
          p.name as product_name,
          sm.movement_type,
          sm.quantity,
          sm.reference_type,
          sm.created_at,
          u.full_name as user_name
        FROM stock_movements sm
        JOIN products p ON sm.product_id = p.id
        JOIN users u ON sm.user_id = u.id
        WHERE DATE(sm.created_at) = $1::date AND sm.branch_id = $2
        ORDER BY sm.created_at DESC
        LIMIT 10`
      : `SELECT 
          p.name as product_name,
          sm.movement_type,
          sm.quantity,
          sm.reference_type,
          sm.created_at,
          u.full_name as user_name
        FROM stock_movements sm
        JOIN products p ON sm.product_id = p.id
        JOIN users u ON sm.user_id = u.id
        WHERE DATE(sm.created_at) = $1::date
        ORDER BY sm.created_at DESC
        LIMIT 10`
    const recentMovementsResult = await query(recentMovementsQuery, salesParams)
    const recentMovements = recentMovementsResult.rows

    // Get transfers summary
    const transfersQuery = branchId
      ? `SELECT 
          COALESCE(COUNT(*), 0) as total_transfers,
          COALESCE(SUM(ti.quantity), 0) as total_items_transferred
        FROM transfers t
        JOIN transfer_items ti ON t.id = ti.transfer_id
        WHERE DATE(t.created_at) = $1::date 
        AND (t.from_branch_id = $2 OR t.to_branch_id = $2)`
      : `SELECT 
          COALESCE(COUNT(*), 0) as total_transfers,
          COALESCE(SUM(ti.quantity), 0) as total_items_transferred
        FROM transfers t
        JOIN transfer_items ti ON t.id = ti.transfer_id
        WHERE DATE(t.created_at) = $1::date`
    const transfersResult = await query(transfersQuery, salesParams)
    const transfersData = transfersResult.rows[0]

    // Get recent transfers
    const recentTransfersQuery = branchId
      ? `SELECT 
          fb.name as from_branch,
          tb.name as to_branch,
          ti.quantity as total_items,
          p.name as product_name,
          t.status,
          t.created_at
        FROM transfers t
        JOIN transfer_items ti ON t.id = ti.transfer_id
        JOIN products p ON ti.product_id = p.id
        JOIN branches fb ON t.from_branch_id = fb.id
        JOIN branches tb ON t.to_branch_id = tb.id
        WHERE DATE(t.created_at) = $1::date 
        AND (t.from_branch_id = $2 OR t.to_branch_id = $2)
        ORDER BY t.created_at DESC
        LIMIT 5`
      : `SELECT 
          fb.name as from_branch,
          tb.name as to_branch,
          ti.quantity as total_items,
          p.name as product_name,
          t.status,
          t.created_at
        FROM transfers t
        JOIN transfer_items ti ON t.id = ti.transfer_id
        JOIN products p ON ti.product_id = p.id
        JOIN branches fb ON t.from_branch_id = fb.id
        JOIN branches tb ON t.to_branch_id = tb.id
        WHERE DATE(t.created_at) = $1::date
        ORDER BY t.created_at DESC
        LIMIT 5`
    const recentTransfersResult = await query(recentTransfersQuery, salesParams)
    const recentTransfers = recentTransfersResult.rows

    // Get expenses summary
    const expensesQuery = branchId
      ? `SELECT 
          COALESCE(SUM(e.amount), 0) as total_expenses,
          COALESCE(COUNT(*), 0) as expense_count
        FROM expenses e
        WHERE DATE(e.created_at) = $1::date AND e.branch_id = $2`
      : `SELECT 
          COALESCE(SUM(e.amount), 0) as total_expenses,
          COALESCE(COUNT(*), 0) as expense_count
        FROM expenses e
        WHERE DATE(e.created_at) = $1::date`
    const expensesResult = await query(expensesQuery, salesParams)
    const expensesData = expensesResult.rows[0]

    // Get expense categories
    const expenseCategoriesQuery = branchId
      ? `SELECT 
          e.category,
          SUM(e.amount) as amount,
          COUNT(*) as count
        FROM expenses e
        WHERE DATE(e.created_at) = $1::date AND e.branch_id = $2
        GROUP BY e.category`
      : `SELECT 
          e.category,
          SUM(e.amount) as amount,
          COUNT(*) as count
        FROM expenses e
        WHERE DATE(e.created_at) = $1::date
        GROUP BY e.category`
    const expenseCategoriesResult = await query(expenseCategoriesQuery, salesParams)
    const expenseCategories = expenseCategoriesResult.rows

    // Get alerts summary
    const alertsQuery = branchId
      ? `SELECT 
          COALESCE(COUNT(*), 0) as total_alerts,
          COALESCE(COUNT(CASE WHEN a.severity = 'critical' THEN 1 END), 0) as critical_alerts,
          COALESCE(COUNT(CASE WHEN a.severity = 'high' THEN 1 END), 0) as high_alerts,
          COALESCE(COUNT(CASE WHEN a.severity = 'medium' THEN 1 END), 0) as medium_alerts,
          COALESCE(COUNT(CASE WHEN a.severity = 'low' THEN 1 END), 0) as low_alerts
        FROM alerts a
        WHERE DATE(a.created_at) = $1::date AND a.branch_id = $2`
      : `SELECT 
          COALESCE(COUNT(*), 0) as total_alerts,
          COALESCE(COUNT(CASE WHEN a.severity = 'critical' THEN 1 END), 0) as critical_alerts,
          COALESCE(COUNT(CASE WHEN a.severity = 'high' THEN 1 END), 0) as high_alerts,
          COALESCE(COUNT(CASE WHEN a.severity = 'medium' THEN 1 END), 0) as medium_alerts,
          COALESCE(COUNT(CASE WHEN a.severity = 'low' THEN 1 END), 0) as low_alerts
        FROM alerts a
        WHERE DATE(a.created_at) = $1::date`
    const alertsResult = await query(alertsQuery, salesParams)
    const alertsData = alertsResult.rows[0]

    // Get recent alerts
    const recentAlertsQuery = branchId
      ? `SELECT 
          a.message,
          a.severity,
          a.created_at
        FROM alerts a
        WHERE DATE(a.created_at) = $1::date AND a.branch_id = $2
        ORDER BY a.created_at DESC
        LIMIT 5`
      : `SELECT 
          a.message,
          a.severity,
          a.created_at
        FROM alerts a
        WHERE DATE(a.created_at) = $1::date
        ORDER BY a.created_at DESC
        LIMIT 5`
    const recentAlertsResult = await query(recentAlertsQuery, salesParams)
    const recentAlerts = recentAlertsResult.rows

    // Calculate profit
    const grossRevenue = salesData.total_sales
    const totalExpenses = expensesData.total_expenses
    const netProfit = grossRevenue - totalExpenses
    const profitMargin = grossRevenue > 0 ? (netProfit / grossRevenue) * 100 : 0

    // Build the final response
    const dailySummary = {
      date: date,
      sales_summary: {
        total_sales: grossRevenue,
        total_transactions: salesData.total_transactions,
        average_sale: salesData.average_sale,
        top_selling_products: soldProducts,
        payment_methods: salesData.payment_methods
      },
      stock_summary: {
        stock_in: stockData.stock_in,
        stock_out: stockData.stock_out,
        stock_adjustments: stockData.stock_adjustments,
        total_movements: stockData.total_movements,
        recent_movements: recentMovements
      },
      transfers_summary: {
        total_transfers: transfersData.total_transfers,
        total_items_transferred: transfersData.total_items_transferred,
        recent_transfers: recentTransfers
      },
      expenses_summary: {
        total_expenses: totalExpenses,
        expense_count: expensesData.expense_count,
        categories: expenseCategories
      },
      alerts_summary: {
        total_alerts: alertsData.total_alerts,
        critical_alerts: alertsData.critical_alerts,
        high_alerts: alertsData.high_alerts,
        medium_alerts: alertsData.medium_alerts,
        low_alerts: alertsData.low_alerts,
        recent_alerts: recentAlerts
      },
      profit_calculation: {
        gross_revenue: grossRevenue,
        total_expenses: totalExpenses,
        net_profit: netProfit,
        profit_margin: profitMargin
      }
    }

    return NextResponse.json(
      {
        success: true,
        data: dailySummary,
      },
      {
        headers: {
          "Cache-Control": "private, max-age=30",
        },
      },
    )
  } catch (error) {
    console.error("Daily summary error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
