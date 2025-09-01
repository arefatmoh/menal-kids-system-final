"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Package, AlertTriangle, TrendingUp, TrendingDown, Calendar, Activity, ShoppingBag, Loader2, BarChart3, Trophy, Settings, Target, Users, Truck, ChevronLeft, ChevronRight, DollarSign, TrendingUp as TrendingUpIcon, TrendingDown as TrendingDownIcon, Package as PackageIcon, AlertCircle, FileText, ArrowUpDown, Clock, CheckCircle, XCircle, CreditCard } from "lucide-react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import apiClient from "@/lib/api-client"
import { useLanguage } from "@/lib/language-context"
import { useToast } from "@/hooks/use-toast"
import { useBranch } from "@/lib/branch-context"
import { formatCurrency, getBranchIdForDatabase } from "@/lib/utils"

interface DashboardStats {
  total_products: number
  low_stock_alerts: number
  out_of_stock_alerts: number
  stock_in_today: number
  stock_out_today: number
  total_sales_today: number
  transactions_today: number
  active_alerts: number
  critical_alerts: number
}

interface RecentActivity {
  activity_type: string
  description: string
  branch_name: string
  user_name: string
  created_at: string
  reference_id: string
}

interface DailySummary {
  date: string
  sales_summary: {
    total_sales: number
    total_transactions: number
    average_sale: number
    payment_methods: {
      cash: number
      pos: number
      telebirr: number
      mobile_transfer: number
    }
    top_selling_products: Array<{
      product_name: string
      quantity_sold: number
      total_amount: number
      variation_info: string
      payment_breakdown: {
        cash: number
        pos: number
        telebirr: number
        mobile_transfer: number
      }
    }>
  }
  stock_summary: {
    stock_in: number
    stock_out: number
    stock_adjustments: number
    total_movements: number
    recent_movements: Array<{
      product_name: string
      movement_type: string
      quantity: number
      reference_type: string
      created_at: string
      user_name: string
    }>
  }
  transfers_summary: {
    total_transfers: number
    total_items_transferred: number
    recent_transfers: Array<{
      from_branch: string
      to_branch: string
      total_items: number
      product_name: string
      status: string
      created_at: string
    }>
  }
  expenses_summary: {
    total_expenses: number
    expense_count: number
    categories: Array<{
      category: string
      amount: number
      count: number
    }>
  }
  alerts_summary: {
    total_alerts: number
    critical_alerts: number
    high_alerts: number
    medium_alerts: number
    low_alerts: number
    recent_alerts: Array<{
      message: string
      severity: string
      created_at: string
    }>
  }
  profit_calculation: {
    gross_revenue: number
    total_expenses: number
    net_profit: number
    profit_margin: number
  }
}

export default function Dashboard() {
  const { t } = useLanguage()
  const today = new Date()
  const todayStr = today.toISOString().split("T")[0]
  const [userRole, setUserRole] = useState<string | null>(null)
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()
  const { toast } = useToast()
  const { currentBranch } = useBranch()
  const [stockTrend, setStockTrend] = useState<{ name: string; stock: number; stock_in: number; stock_out: number; total_stock: number }[]>([])
  const [salesSummary, setSalesSummary] = useState<number | null>(null)
  // State for dashboard analytics
  const [topSellingToday, setTopSellingToday] = useState<{ product_name: string; quantity_sold: number; total_amount: number; variation_info: string }[]>([])
  const [topSellingWeek, setTopSellingWeek] = useState<{ product_name: string; quantity_sold: number; total_amount: number; variation_info: string }[]>([])
  const [lowStockProducts, setLowStockProducts] = useState<{ product_name: string; current_quantity: number; variation_info: string; category_info: string; days_since_restock: number }[]>([])
  const [recentProductUpdates, setRecentProductUpdates] = useState<{ product_name: string; update_type: string; updated_at: string; variation_info: string; category_info: string; change_details: string }[]>([])
  const [dailySummary, setDailySummary] = useState<DailySummary | null>(null)

  // Pagination state for all cards
  const [topSellingTodayPage, setTopSellingTodayPage] = useState(1)
  const [topSellingWeekPage, setTopSellingWeekPage] = useState(1)
  const [lowStockPage, setLowStockPage] = useState(1)
  const [recentUpdatesPage, setRecentUpdatesPage] = useState(1)
  const itemsPerPage = 7

  // Pagination state for recent activities (5 per page, max 10 pages)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalActivities, setTotalActivities] = useState(0)
  const activitiesPerPage = 5
  const maxPages = 10

  // Calculate pagination for each card
  const getPaginatedItems = (items: any[], currentPage: number) => {
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    return items.slice(startIndex, endIndex)
  }

  const getTotalPages = (items: any[]) => Math.min(Math.ceil(items.length / itemsPerPage), maxPages)

  // Pagination handlers for each card
  const goToPage = (setter: (page: number) => void, page: number, totalPages: number) => {
    if (page >= 1 && page <= totalPages) {
      setter(page)
    }
  }

  // Recent activities pagination handlers
  const goToActivitiesPage = (page: number) => {
    const totalPages = Math.min(Math.ceil(totalActivities / activitiesPerPage), maxPages)
    setCurrentPage(Math.max(1, Math.min(page, totalPages)))
  }

  const goToPreviousActivitiesPage = () => {
    setCurrentPage(prev => Math.max(1, prev - 1))
  }

  const goToNextActivitiesPage = () => {
    const totalPages = Math.min(Math.ceil(totalActivities / activitiesPerPage), maxPages)
    setCurrentPage(prev => Math.min(totalPages, prev + 1))
  }

  // Calculate recent activities pagination
  const totalPages = Math.min(Math.ceil(totalActivities / activitiesPerPage), maxPages)
  const startIndex = (currentPage - 1) * activitiesPerPage
  const endIndex = startIndex + activitiesPerPage
  const currentActivities = recentActivities.slice(startIndex, endIndex)

  // Reset to first page when branch changes
  useEffect(() => {
    setTopSellingTodayPage(1)
    setTopSellingWeekPage(1)
    setLowStockPage(1)
    setRecentUpdatesPage(1)
  }, [currentBranch])

  useEffect(() => {
    const role = localStorage.getItem("userRole")
    if (!role) {
      router.push("/")
      return
    }
    setUserRole(role)
  }, [router])

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!userRole) return

      setIsLoading(true)
      try {
        const branchParam = currentBranch === "all" ? undefined : getBranchIdForDatabase(currentBranch)

        // Use optimized single API call instead of multiple calls
        // Add cache-busting parameter to ensure fresh data
        const cacheBuster = Date.now()
        const dashboardResponse = await apiClient.getDashboardOptimized(branchParam, cacheBuster)

        if (dashboardResponse.success && dashboardResponse.data) {
          const data = dashboardResponse.data as any
          
          // Set stats
          if (data.stats) {
            setStats(data.stats)
            const todaySales = typeof data.stats.total_sales_today === 'number' 
              ? data.stats.total_sales_today 
              : Number((data.stats as any).total_sales_today || 0)
            setSalesSummary(todaySales)
          }

          // Set recent activities
          if (data.recent_activities) {
            setRecentActivities(data.recent_activities)
            setTotalActivities(data.recent_activities.length)
          }

          // Set stock trend
          if (data.stock_trend) {
            setStockTrend(data.stock_trend)
          }

          // Set top selling today
          if (data.top_selling_today) {
            setTopSellingToday(data.top_selling_today)
          }

          // Set top selling week
          if (data.top_selling_week) {
            setTopSellingWeek(data.top_selling_week)
          }

          // Set low stock products
          if (data.low_stock_products) {
            setLowStockProducts(data.low_stock_products)
          }

          // Set recent updates
          if (data.recent_updates) {
            setRecentProductUpdates(data.recent_updates)
          }
        }

        // Fetch daily summary data
        const dailySummaryResponse = await apiClient.getDailySummary({ 
          branch_id: branchParam,
          date: todayStr 
        })
        if (dailySummaryResponse.success) {
          setDailySummary(dailySummaryResponse.data as DailySummary)
        }

        // All data is now loaded from the single optimized API call above

        // Stock trend data is already loaded from the optimized API call

        // Sales summary is already loaded from the optimized API call

        // Top selling today data is already loaded from the optimized API call

        // if (topWeekResult?.status === 'fulfilled' && topWeekResult.value?.success) {
        //   type TopSelling = { product_name: string; quantity_sold: number; total_amount: number; variation_info: string }
        //   const items = (topWeekResult.value.data as unknown) as TopSelling[]
        //   setTopSellingWeek(Array.isArray(items) ? items : [])
        // }

        // if (lowStockResult?.status === 'fulfilled' && lowStockResult.value?.success) {
        //   type LowStock = { product_name: string; current_quantity: number; variation_info: string; category_info: string; days_since_restock: number }
        //   const items = (lowStockResult.value.data as unknown) as LowStock[]
        //   setLowStockProducts(Array.isArray(items) ? items : [])
        // }

        // if (recentUpdatesResult?.status === 'fulfilled' && recentUpdatesResult.value?.success) {
        //   type RecentUpdate = { product_name: string; update_type: string; updated_at: string; variation_info: string; category_info: string; change_details: string }
        //   const items = (recentUpdatesResult.value.data as unknown) as RecentUpdate[]
        //   setRecentProductUpdates(Array.isArray(items) ? items : [])
        // }

      } catch (error: any) {
        console.error("Dashboard data fetch error:", error)
        toast({
          title: "Error",
          description: "Failed to load dashboard data",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchDashboardData()
  }, [userRole, currentBranch, toast])

  if (!userRole) {
    return <div>Loading...</div>
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-pink-500" />
      </div>
    )
  }

  // Use real stock trend data or show empty state
  const stockData = stockTrend.length > 0 ? stockTrend : []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">{t("dashboard")}</h1>
        <p className="text-gray-600 mt-1">{t("welcomeMessage")}</p>
      </div>

      {/* Sales Summary Card and Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
        <Card className="border-0 shadow-lg bg-gradient-to-br from-pink-50 to-pink-100 hover:shadow-xl transition-shadow duration-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-pink-700">{t("salesToday")}</CardTitle>
            <BarChart3 className="h-4 w-4 text-pink-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-pink-900">{salesSummary !== null ? formatCurrency(Math.round(Number(salesSummary) || 0)) : "-"}</div>
            <p className="text-xs text-pink-600 mt-1">
              {userRole === "owner" 
                ? t("allBranches") 
                : currentBranch === "franko" 
                  ? t("frankoBranch") 
                  : currentBranch === "mebrat-hayl" 
                    ? t("mebrathaylBranch") 
                    : t("frankoBranch")
              } {t("today")}
            </p>
          </CardContent>
        </Card>
        {/* Summary Cards */}
        <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-blue-100 hover:shadow-xl transition-shadow duration-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-700">{t("totalProducts")}</CardTitle>
            <Package className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-900">{stats?.total_products || 0}</div>
            <p className="text-xs text-blue-600 mt-1">
              <TrendingUp className="inline h-3 w-3 mr-1" />
              {t("inventory")}
            </p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-gradient-to-br from-orange-50 to-orange-100 hover:shadow-xl transition-shadow duration-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-orange-700">{t("lowStockAlerts")}</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-900">{stats?.low_stock_alerts || 0}</div>
            <p className="text-xs text-orange-600 mt-1">{t("itemsNeedRestocking")}</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-gradient-to-br from-green-50 to-green-100 hover:shadow-xl transition-shadow duration-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-green-700">{t("stockInToday")}</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-900">{stats?.stock_in_today || 0}</div>
            <p className="text-xs text-green-600 mt-1">{t("unitsAddedToday")}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-lg bg-gradient-to-br from-purple-50 to-purple-100 hover:shadow-xl transition-shadow duration-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-purple-700">{t("stockOutToday")}</CardTitle>
            <TrendingDown className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-900">{stats?.stock_out_today || 0}</div>
            <p className="text-xs text-purple-600 mt-1">{t("unitsSoldToday")}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Stock Trend Chart */}
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Activity className="h-5 w-5 text-pink-500" />
              <span>{t("stockTrend")}</span>
            </CardTitle>
            <CardDescription>{t("dailyStockLevels")}</CardDescription>
          </CardHeader>
          <CardContent>
            {stockTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={stockTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis 
                    dataKey="name" 
                    stroke="#666"
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis 
                    stroke="#666"
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => `${value > 0 ? '+' : ''}${value}`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#fff",
                      border: "1px solid #e2e8f0",
                      borderRadius: "8px",
                      boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                    }}
                    formatter={(value: any, name: any) => [
                      `${value > 0 ? '+' : ''}${value} ${t("units")}`,
                      t("netStockChange")
                    ]}
                    labelFormatter={(label) => `${t("dayLabel")}: ${label}`}
                  />
                  <Line
                    type="monotone"
                    dataKey="stock"
                    stroke="#ec4899"
                    strokeWidth={3}
                    dot={{ fill: "#ec4899", strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6, stroke: "#ec4899", strokeWidth: 2 }}
                    connectNulls={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-64 text-gray-500">
                <div className="text-center">
                  <Activity className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p className="text-lg font-medium mb-2">{t("recentActivity")}</p>
                  <p className="text-sm">{t("latestStockMovements")}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Calendar className="h-5 w-5 text-purple-500" />
              <span>{t("recentActivity")}</span>
            </CardTitle>
            <CardDescription>{t("latestStockMovements")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {currentActivities.length > 0 ? (
                currentActivities.map((activity, index) => (
                  <div
                    key={index}
                    className="flex items-center space-x-4 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
                  >
                    <div
                      className={`p-2 rounded-full ${
                        activity.activity_type === "stock_in"
                          ? "bg-green-100 text-green-600"
                          : activity.activity_type === "stock_out"
                            ? "bg-red-100 text-red-600"
                          : activity.activity_type === "sale"
                            ? "bg-blue-100 text-blue-600"
                          : activity.activity_type === "product_created"
                            ? "bg-purple-100 text-purple-600"
                          : activity.activity_type === "variation_created"
                            ? "bg-indigo-100 text-indigo-600"
                          : activity.activity_type === "inventory_adjusted"
                            ? "bg-yellow-100 text-yellow-600"
                          : activity.activity_type === "user_activity"
                            ? "bg-gray-100 text-gray-600"
                          : activity.activity_type?.startsWith("transfer_")
                            ? "bg-orange-100 text-orange-600"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {activity.activity_type === "stock_in" ? (
                        <TrendingUp className="h-4 w-4" />
                      ) : activity.activity_type === "stock_out" ? (
                        <TrendingDown className="h-4 w-4" />
                      ) : activity.activity_type === "sale" ? (
                        <ShoppingBag className="h-4 w-4" />
                      ) : activity.activity_type === "product_created" ? (
                        <Package className="h-4 w-4" />
                      ) : activity.activity_type === "variation_created" ? (
                        <Settings className="h-4 w-4" />
                      ) : activity.activity_type === "inventory_adjusted" ? (
                        <Target className="h-4 w-4" />
                      ) : activity.activity_type === "user_activity" ? (
                        <Users className="h-4 w-4" />
                      ) : activity.activity_type?.startsWith("transfer_") ? (
                        <Truck className="h-4 w-4" />
                      ) : (
                        <Activity className="h-4 w-4" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 leading-tight">
                        {(() => {
                          // Translate activity descriptions based on activity_type
                          switch (activity.activity_type) {
                            case 'stock_in':
                              return t("stockAdded")
                            case 'stock_out':
                              return t("stockSold")
                            case 'sale':
                              return t("sale")
                            case 'product_created':
                              return t("productCreated")
                            case 'variation_created':
                              return t("variationCreated")
                            case 'inventory_adjusted':
                              return t("inventoryAdjusted")
                            case 'user_activity':
                              return t("userActivity")
                            default:
                              if (activity.activity_type?.startsWith('transfer_')) {
                                return t("transfer")
                              }
                              return activity.description || t("stockMovement")
                          }
                        })()}
                      </p>
                      <p className="text-sm text-gray-500 truncate mt-1">
                        {(() => {
                          // Translate branch names
                          if (activity.branch_name === 'Branch 1' || activity.branch_name === 'branch1' || activity.branch_name === 'franko') {
                            return t("frankoBranch")
                          } else if (activity.branch_name === 'Branch 2' || activity.branch_name === 'branch2' || activity.branch_name === 'mebrat-hayl') {
                            return t("mebrathaylBranch")
                          } else if (activity.branch_name === 'All Branches' || activity.branch_name === 'all') {
                            return t("allBranches")
                          }
                          return activity.branch_name
                        })()} • {activity.user_name}
                      </p>
                    </div>
                    <div className="text-xs text-gray-400">
                      {new Date(activity.created_at).toLocaleTimeString()}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center text-gray-500 py-8">
                  <Calendar className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                  <p>{t("noRecentActivity")}</p>
                </div>
              )}
            </div>
            {totalPages > 1 && (
              <div className="flex justify-center items-center mt-4 space-x-2">
                <button
                  onClick={goToPreviousActivitiesPage}
                  disabled={currentPage === 1}
                  className="p-2 rounded-full bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <span className="text-sm text-gray-700">
                  {t("page")} {currentPage} {t("of")} {totalPages}
                </span>
                <button
                  onClick={goToNextActivitiesPage}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-full bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Daily Summary Card */}
      <div className="mt-6">
        <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-indigo-50">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center space-x-2 text-2xl font-bold text-gray-800">
              <FileText className="h-6 w-6 text-blue-600" />
              <span>{t("dailySummary")}</span>
              <span className="text-sm font-normal text-gray-500 ml-2">
                {new Date(todayStr).toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </span>
            </CardTitle>
            <CardDescription className="text-gray-600">
              {t("dailySummaryDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {dailySummary ? (
              <div className="space-y-6">
                {/* Financial Summary */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">{t("grossRevenue")}</p>
                        <p className="text-2xl font-bold text-green-600">
                          ${formatCurrency(dailySummary.profit_calculation.gross_revenue)}
                        </p>
                      </div>
                      <DollarSign className="h-8 w-8 text-green-500" />
                    </div>
                  </div>
                  
                  <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">{t("totalExpenses")}</p>
                        <p className="text-2xl font-bold text-red-600">
                          ${formatCurrency(dailySummary.profit_calculation.total_expenses)}
                        </p>
                      </div>
                      <TrendingDownIcon className="h-8 w-8 text-red-500" />
                    </div>
                  </div>
                  
                  <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">{t("netProfit")}</p>
                        <p className={`text-2xl font-bold ${dailySummary.profit_calculation.net_profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          ${formatCurrency(dailySummary.profit_calculation.net_profit)}
                        </p>
                      </div>
                      <TrendingUpIcon className={`h-8 w-8 ${dailySummary.profit_calculation.net_profit >= 0 ? 'text-green-500' : 'text-red-500'}`} />
                    </div>
                  </div>
                  
                  <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">{t("profitMargin")}</p>
                        <p className={`text-2xl font-bold ${dailySummary.profit_calculation.profit_margin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {dailySummary.profit_calculation.profit_margin.toFixed(1)}%
                        </p>
                      </div>
                      <BarChart3 className={`h-8 w-8 ${dailySummary.profit_calculation.profit_margin >= 0 ? 'text-green-500' : 'text-red-500'}`} />
                    </div>
                  </div>
                </div>

                {/* Activity Summary */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                  <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">{t("totalTransactions")}</p>
                        <p className="text-2xl font-bold text-blue-600">
                          {dailySummary.sales_summary.total_transactions}
                        </p>
                        <p className="text-xs text-gray-500">
                          ${formatCurrency(dailySummary.sales_summary.average_sale)} {t("average")}
                        </p>
                      </div>
                      <ShoppingBag className="h-8 w-8 text-blue-500" />
                    </div>
                  </div>
                  
                  <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">{t("stockMovements")}</p>
                        <p className="text-2xl font-bold text-purple-600">
                          {dailySummary.stock_summary.total_movements}
                        </p>
                        <div className="text-xs text-gray-500 space-y-1">
                          <div className="flex justify-between">
                            <span>{t("in")}:</span>
                            <span className="text-green-600">+{dailySummary.stock_summary.stock_in}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>{t("out")}:</span>
                            <span className="text-red-600">-{dailySummary.stock_summary.stock_out}</span>
                          </div>
                        </div>
                      </div>
                      <ArrowUpDown className="h-8 w-8 text-purple-500" />
                    </div>
                  </div>
                  
                  <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">{t("transfers")}</p>
                        <p className="text-2xl font-bold text-orange-600">
                          {dailySummary.transfers_summary.total_transfers}
                        </p>
                        <p className="text-xs text-gray-500">
                          {dailySummary.transfers_summary.total_items_transferred} {t("items")}
                        </p>
                      </div>
                      <Truck className="h-8 w-8 text-orange-500" />
                    </div>
                  </div>
                  
                  <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">{t("alerts")}</p>
                        <p className="text-2xl font-bold text-yellow-600">
                          {dailySummary.alerts_summary.total_alerts}
                        </p>
                        <div className="text-xs text-gray-500 space-y-1">
                          <div className="flex justify-between">
                            <span>{t("critical")}:</span>
                            <span className="text-red-600">{dailySummary.alerts_summary.critical_alerts}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>{t("high")}:</span>
                            <span className="text-orange-600">{dailySummary.alerts_summary.high_alerts}</span>
                          </div>
                        </div>
                      </div>
                      <AlertCircle className="h-8 w-8 text-yellow-500" />
                    </div>
                  </div>
                  
                  {/* Payment Methods Summary */}
                  <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">{t("paymentMethods")}</p>
                        <div className="text-xs text-gray-500 space-y-1">
                          <div className="flex justify-between">
                            <span>💵 {t("cash")}:</span>
                            <span className="text-green-600">${formatCurrency(dailySummary.sales_summary.payment_methods.cash)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>💳 POS:</span>
                            <span className="text-blue-600">${formatCurrency(dailySummary.sales_summary.payment_methods.pos)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>📱 Telebirr:</span>
                            <span className="text-purple-600">${formatCurrency(dailySummary.sales_summary.payment_methods.telebirr)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>🏦 Mobile Transfer:</span>
                            <span className="text-orange-600">${formatCurrency(dailySummary.sales_summary.payment_methods.mobile_transfer)}</span>
                          </div>
                        </div>
                      </div>
                      <CreditCard className="h-8 w-8 text-indigo-500" />
                    </div>
                  </div>
                </div>

                {/* Detailed Sections */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Sold Products Today */}
                  <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
                    <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
                      <ShoppingBag className="h-5 w-5 text-green-500 mr-2" />
                      {t("soldProductsToday")}
                    </h3>
                    {dailySummary.sales_summary.top_selling_products && dailySummary.sales_summary.top_selling_products.length > 0 ? (
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {dailySummary.sales_summary.top_selling_products.map((product, idx) => (
                          <div key={idx} className="py-2 border-b border-gray-100 last:border-b-0">
                            <div className="flex justify-between items-center">
                              <div className="flex-1">
                                <span className="font-medium text-gray-800">{product.product_name}</span>
                                {product.variation_info !== 'Standard' && (
                                  <span className="text-xs text-gray-500 ml-1">({product.variation_info})</span>
                                )}
                              </div>
                              <div className="flex flex-wrap items-center gap-2 mx-4">
                                {product.payment_breakdown.cash > 0 && (
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                    {t("cash")} ${formatCurrency(product.payment_breakdown.cash)}
                                  </span>
                                )}
                                {product.payment_breakdown.pos > 0 && (
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                    POS ${formatCurrency(product.payment_breakdown.pos)}
                                  </span>
                                )}
                                {product.payment_breakdown.telebirr > 0 && (
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                    Telebirr ${formatCurrency(product.payment_breakdown.telebirr)}
                                  </span>
                                )}
                                {product.payment_breakdown.mobile_transfer > 0 && (
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                                    Mobile Transfer ${formatCurrency(product.payment_breakdown.mobile_transfer)}
                                  </span>
                                )}
                              </div>
                              <div className="text-right">
                                <p className="font-medium text-gray-600">{product.quantity_sold} {t("sold")}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 text-center py-4">{t("noSalesToday")}</p>
                    )}
                  </div>

                  {/* Recent Stock Movements */}
                  <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
                    <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
                      <PackageIcon className="h-5 w-5 text-blue-500 mr-2" />
                      {t("recentStockMovements")}
                    </h3>
                    {dailySummary.stock_summary.recent_movements && dailySummary.stock_summary.recent_movements.length > 0 ? (
                      <div className="space-y-2">
                        {dailySummary.stock_summary.recent_movements.slice(0, 5).map((movement, idx) => (
                          <div key={idx} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-b-0">
                            <div className="flex-1">
                              <p className="font-medium text-gray-800">{movement.product_name}</p>
                              <p className="text-xs text-gray-500">{movement.user_name}</p>
                            </div>
                            <div className="text-right">
                              <div className={`flex items-center space-x-1 ${
                                movement.movement_type === 'in' ? 'text-green-600' : 
                                movement.movement_type === 'out' ? 'text-red-600' : 'text-yellow-600'
                              }`}>
                                {movement.movement_type === 'in' ? (
                                  <TrendingUpIcon className="h-3 w-3" />
                                ) : movement.movement_type === 'out' ? (
                                  <TrendingDownIcon className="h-3 w-3" />
                                ) : (
                                  <Settings className="h-3 w-3" />
                                )}
                                <span className="font-medium">
                                  {movement.movement_type === 'in' ? '+' : movement.movement_type === 'out' ? '-' : '±'}{movement.quantity}
                                </span>
                              </div>
                              <p className="text-xs text-gray-500">{movement.reference_type}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 text-center py-4">{t("noStockMovements")}</p>
                    )}
                  </div>
                </div>

                {/* Recent Transfers and Alerts */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Recent Transfers */}
                  <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
                    <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
                      <Truck className="h-5 w-5 text-orange-500 mr-2" />
                      {t("recentTransfers")}
                    </h3>
                    {dailySummary.transfers_summary.recent_transfers && dailySummary.transfers_summary.recent_transfers.length > 0 ? (
                      <div className="space-y-2">
                        {dailySummary.transfers_summary.recent_transfers.slice(0, 3).map((transfer, idx) => (
                          <div key={idx} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-b-0">
                            <div className="flex-1">
                              <p className="font-medium text-gray-800">{transfer.product_name}</p>
                              <p className="text-xs text-gray-500">
                                {transfer.from_branch} → {transfer.to_branch}
                              </p>
                            </div>
                            <div className="text-right">
                              <div className={`flex items-center space-x-1 ${
                                transfer.status === 'completed' ? 'text-green-600' : 
                                transfer.status === 'pending' ? 'text-yellow-600' : 'text-red-600'
                              }`}>
                                {transfer.status === 'completed' ? (
                                  <CheckCircle className="h-3 w-3" />
                                ) : transfer.status === 'pending' ? (
                                  <Clock className="h-3 w-3" />
                                ) : (
                                  <XCircle className="h-3 w-3" />
                                )}
                                <span className="text-xs font-medium">{transfer.status}</span>
                              </div>
                              <p className="text-xs text-gray-500">{transfer.total_items} {t("items")}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 text-center py-4">{t("noTransfers")}</p>
                    )}
                  </div>

                  {/* Recent Alerts */}
                  <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
                    <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
                      <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
                      {t("recentAlerts")}
                    </h3>
                    {dailySummary.alerts_summary.recent_alerts && dailySummary.alerts_summary.recent_alerts.length > 0 ? (
                      <div className="space-y-2">
                        {dailySummary.alerts_summary.recent_alerts.slice(0, 3).map((alert, idx) => (
                          <div key={idx} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-b-0">
                            <div className="flex-1">
                              <p className="font-medium text-gray-800 truncate">{alert.message}</p>
                              <p className="text-xs text-gray-500">
                                {new Date(alert.created_at).toLocaleTimeString()}
                              </p>
                            </div>
                            <div className="text-right">
                              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                alert.severity === 'critical' ? 'bg-red-100 text-red-800' :
                                alert.severity === 'high' ? 'bg-orange-100 text-orange-800' :
                                alert.severity === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-blue-100 text-blue-800'
                              }`}>
                                {alert.severity}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 text-center py-4">{t("noAlerts")}</p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <Loader2 className="h-8 w-8 mx-auto mb-2 text-gray-400 animate-spin" />
                <p className="text-gray-500">{t("loadingDailySummary")}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Selling Products Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-6 mt-6">
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Trophy className="h-5 w-5 text-yellow-500" />
              <span>{t("topSellingToday")}</span>
            </CardTitle>
            <CardDescription>{t("topSellingTodaySubtitle")}</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-gray-200">
              {getPaginatedItems(topSellingToday, topSellingTodayPage).length > 0 ? 
                getPaginatedItems(topSellingToday, topSellingTodayPage).map((prod, idx) => (
                  <li key={idx} className="py-2 flex justify-between items-center">
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-gray-800 truncate block">{prod.product_name}</span>
                      {prod.variation_info !== t("standardVariation") && (
                        <span className="text-xs text-gray-500 block">{prod.variation_info}</span>
                      )}
                    </div>
                    <div className="text-right">
                      <span className="text-gray-500 font-medium">{prod.quantity_sold} {t("sold")}</span>
                      <div className="text-xs text-gray-400">${prod.total_amount}</div>
                    </div>
                  </li>
                )) : <li className="py-4 text-gray-400 text-center">{t("noSalesToday")}</li>
              }
            </ul>
            {getTotalPages(topSellingToday) > 1 && (
              <div className="flex justify-center items-center mt-3 space-x-1">
                <button
                  onClick={() => goToPage(setTopSellingTodayPage, topSellingTodayPage - 1, getTotalPages(topSellingToday))}
                  disabled={topSellingTodayPage === 1}
                  className="p-1 rounded-full bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="h-3 w-3" />
                </button>
                <span className="text-xs text-gray-500 px-2">
                  {topSellingTodayPage}/{getTotalPages(topSellingToday)}
                </span>
                <button
                  onClick={() => goToPage(setTopSellingTodayPage, topSellingTodayPage + 1, getTotalPages(topSellingToday))}
                  disabled={topSellingTodayPage === getTotalPages(topSellingToday)}
                  className="p-1 rounded-full bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="h-3 w-3" />
                </button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Trophy className="h-5 w-5 text-yellow-500" />
              <span>{t("topSellingWeek")}</span>
            </CardTitle>
            <CardDescription>{t("topSellingWeekSubtitle")}</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-gray-200">
              {getPaginatedItems(topSellingWeek, topSellingWeekPage).length > 0 ? 
                getPaginatedItems(topSellingWeek, topSellingWeekPage).map((prod, idx) => (
                  <li key={idx} className="py-2 flex justify-between items-center">
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-gray-800 truncate block">{prod.product_name}</span>
                      {prod.variation_info !== t("standardVariation") && (
                        <span className="text-xs text-gray-500 block">{prod.variation_info}</span>
                      )}
                    </div>
                    <div className="text-right">
                      <span className="text-gray-500 font-medium">{prod.quantity_sold} {t("sold")}</span>
                      <div className="text-xs text-gray-400">${prod.total_amount}</div>
                    </div>
                  </li>
                )) : <li className="py-4 text-gray-400 text-center">{t("noSalesWeek")}</li>
              }
            </ul>
            {getTotalPages(topSellingWeek) > 1 && (
              <div className="flex justify-center items-center mt-3 space-x-1">
                <button
                  onClick={() => goToPage(setTopSellingWeekPage, topSellingWeekPage - 1, getTotalPages(topSellingWeek))}
                  disabled={topSellingWeekPage === 1}
                  className="p-1 rounded-full bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="h-3 w-3" />
                </button>
                <span className="text-xs text-gray-500 px-2">
                  {topSellingWeekPage}/{getTotalPages(topSellingWeek)}
                </span>
                <button
                  onClick={() => goToPage(setTopSellingWeekPage, topSellingWeekPage + 1, getTotalPages(topSellingWeek))}
                  disabled={topSellingWeekPage === getTotalPages(topSellingWeek)}
                  className="p-1 rounded-full bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="h-3 w-3" />
                </button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              <span>{t("lowStockAlert")}</span>
            </CardTitle>
            <CardDescription>{t("lowStockSubtitle")}</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-gray-200">
              {getPaginatedItems(lowStockProducts, lowStockPage).length > 0 ? 
                getPaginatedItems(lowStockProducts, lowStockPage).map((prod, idx) => (
                  <li key={idx} className="py-2 flex justify-between items-center">
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-gray-800 truncate block">{prod.product_name}</span>
                      <div className="text-xs text-gray-500">
                        {prod.variation_info !== t("standardVariation") && <span>{prod.variation_info} • </span>}
                        <span>{prod.category_info}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-orange-600 font-semibold">{prod.current_quantity} {t("left")}</span>
                      <div className="text-xs text-gray-400">{(prod.days_since_restock || 0)} {t("daysAgo")}</div>
                    </div>
                  </li>
                )) : <li className="py-4 text-gray-400 text-center">{t("noLowStock")}</li>
              }
            </ul>
            {getTotalPages(lowStockProducts) > 1 && (
              <div className="flex justify-center items-center mt-3 space-x-1">
                <button
                  onClick={() => goToPage(setLowStockPage, lowStockPage - 1, getTotalPages(lowStockProducts))}
                  disabled={lowStockPage === 1}
                  className="p-1 rounded-full bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="h-3 w-3" />
                </button>
                <span className="text-xs text-gray-500 px-2">
                  {lowStockPage}/{getTotalPages(lowStockProducts)}
                </span>
                <button
                  onClick={() => goToPage(setLowStockPage, lowStockPage + 1, getTotalPages(lowStockProducts))}
                  disabled={lowStockPage === getTotalPages(lowStockProducts)}
                  className="p-1 rounded-full bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="h-3 w-3" />
                </button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <BarChart3 className="h-5 w-5 text-purple-500" />
              <span>{t("recentProductUpdates")}</span>
            </CardTitle>
            <CardDescription>{t("recentProductUpdatesSubtitle")}</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-gray-200">
              {getPaginatedItems(recentProductUpdates, recentUpdatesPage).length > 0 ? 
                getPaginatedItems(recentProductUpdates, recentUpdatesPage).map((update, idx) => (
                  <li key={idx} className="py-2 flex justify-between items-center">
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-gray-800 truncate block">{update.product_name}</span>
                      <div className="text-xs text-gray-500">
                        {update.variation_info !== t("standardVariation") && <span>{update.variation_info} • </span>}
                        <span>{update.category_info}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-purple-600 font-semibold">
                        {(() => {
                          // Translate update types
                          switch (update.update_type) {
                            case 'stock_update':
                              return t("stockLevelUpdated")
                            case 'product_update':
                              return t("productUpdated")
                            case 'variation_update':
                              return t("variationUpdated")
                            case 'inventory_update':
                              return t("inventoryUpdated")
                            default:
                              return update.update_type || t("stockLevelUpdated")
                          }
                        })()}
                      </span>
                      <div className="text-xs text-gray-400">{new Date(update.updated_at).toLocaleDateString()}</div>
                    </div>
                  </li>
                )) : <li className="py-4 text-gray-400 text-center">{t("noRecentUpdates")}</li>
              }
            </ul>
            {getTotalPages(recentProductUpdates) > 1 && (
              <div className="flex justify-center items-center mt-3 space-x-1">
                <button
                  onClick={() => goToPage(setRecentUpdatesPage, recentUpdatesPage - 1, getTotalPages(recentProductUpdates))}
                  disabled={recentUpdatesPage === 1}
                  className="p-1 rounded-full bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="h-3 w-3" />
                </button>
                <span className="text-xs text-gray-500 px-2">
                  {recentUpdatesPage}/{getTotalPages(recentProductUpdates)}
                </span>
                <button
                  onClick={() => goToPage(setRecentUpdatesPage, recentUpdatesPage + 1, getTotalPages(recentProductUpdates))}
                  disabled={recentUpdatesPage === getTotalPages(recentProductUpdates)}
                  className="p-1 rounded-full bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="h-3 w-3" />
                </button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
