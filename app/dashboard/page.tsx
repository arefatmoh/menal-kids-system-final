"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Package, AlertTriangle, TrendingUp, TrendingDown, Calendar, Activity, ShoppingBag, Loader2, BarChart3, Trophy, Settings, Target, Users, Truck, ChevronLeft, ChevronRight } from "lucide-react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import apiClient from "@/lib/api-client"
import { useLanguage } from "@/lib/language-context"
import { useToast } from "@/hooks/use-toast"
import { useBranch } from "@/lib/branch-context"
import { formatCurrency } from "@/lib/utils"

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
        // Fetch dashboard stats
        const statsResponse = await apiClient.getDashboardStats(currentBranch === "all" ? undefined : currentBranch)
        if (statsResponse.success) {
          const s = statsResponse.data as DashboardStats
          setStats(s)
          // Ensure employees also see today's sales (from stats)
          const todaySales = typeof s.total_sales_today === 'number' ? s.total_sales_today : Number((s as any).total_sales_today || 0)
          setSalesSummary(todaySales)
        }

        // Fetch recent activities (50 total, we'll paginate on frontend)
        const activitiesResponse = await apiClient.getRecentActivities(currentBranch === "all" ? undefined : currentBranch, 50)
        if (activitiesResponse.success) {
          const items = (activitiesResponse.data as unknown as RecentActivity[]) || []
          setRecentActivities(items)
          setTotalActivities(items.length)
        }

        // Fetch stock trend data for the last 7 days
        const stockTrendParams: any = {}
        if (currentBranch !== "all") {
          stockTrendParams.branch_id = currentBranch
        }
        const stockTrendResponse = await apiClient.getStockTrend(stockTrendParams)
        if (stockTrendResponse.success && stockTrendResponse.data && Array.isArray(stockTrendResponse.data)) {
          // Transform the data for the chart - ensure we have proper data
          const trendData = stockTrendResponse.data.map((day: any) => ({
            name: day.name,
            stock: day.net_change || 0, // Show net stock change for each day
            stock_in: day.stock_in || 0,
            stock_out: day.stock_out || 0,
            total_stock: day.total_stock || 0
          }))
          console.log('Stock trend data received:', stockTrendResponse.data)
          console.log('Transformed trend data:', trendData)
          setStockTrend(trendData)
        } else {
          console.log('Stock trend response:', stockTrendResponse)
          setStockTrend([])
        }

        // Fetch sales summary for today (owner-only endpoint).
        if (userRole === 'owner') {
          const salesParams: any = {}
          if (currentBranch !== "all") { salesParams.branch_id = currentBranch }
          const salesResponse = await apiClient.getSalesTotal(salesParams)
          if (salesResponse.success && salesResponse.data) {
            type SalesTotalResponse = { total_sales?: number }
            const data = salesResponse.data as unknown as SalesTotalResponse
            setSalesSummary(Number(data?.total_sales ?? 0))
          }
        }

        // Fetch top selling products for today
        const topSellingTodayParams: any = {}
        if (currentBranch !== "all") { topSellingTodayParams.branch_id = currentBranch }
        const topSellingTodayResponse = await apiClient.getTopSellingToday(topSellingTodayParams)
        if (topSellingTodayResponse.success && topSellingTodayResponse.data) {
          type TopSelling = { product_name: string; quantity_sold: number; total_amount: number; variation_info: string }
          const items = (topSellingTodayResponse.data as unknown) as TopSelling[]
          setTopSellingToday(Array.isArray(items) ? items : [])
        }

        // Fetch top selling products for this week
        const topSellingWeekParams: any = {}
        if (currentBranch !== "all") { topSellingWeekParams.branch_id = currentBranch }
        const topSellingWeekResponse = await apiClient.getTopSellingWeek(topSellingWeekParams)
        if (topSellingWeekResponse.success && topSellingWeekResponse.data) {
          type TopSelling = { product_name: string; quantity_sold: number; total_amount: number; variation_info: string }
          const items = (topSellingWeekResponse.data as unknown) as TopSelling[]
          setTopSellingWeek(Array.isArray(items) ? items : [])
        }

        // Fetch low stock products
        const lowStockParams: any = {}
        if (currentBranch !== "all") { lowStockParams.branch_id = currentBranch }
        const lowStockResponse = await apiClient.getLowStockProducts(lowStockParams)
        if (lowStockResponse.success && lowStockResponse.data) {
          type LowStock = { product_name: string; current_quantity: number; variation_info: string; category_info: string; days_since_restock: number }
          const items = (lowStockResponse.data as unknown) as LowStock[]
          setLowStockProducts(Array.isArray(items) ? items : [])
        }

        // Fetch recent product updates instead of high value inventory
        const recentUpdatesParams: any = {}
        if (currentBranch !== "all") { recentUpdatesParams.branch_id = currentBranch }
        const recentUpdatesResponse = await apiClient.getRecentProductUpdates(recentUpdatesParams)
        if (recentUpdatesResponse.success && recentUpdatesResponse.data) {
          type RecentUpdate = { product_name: string; update_type: string; updated_at: string; variation_info: string; category_info: string; change_details: string }
          const items = (recentUpdatesResponse.data as unknown) as RecentUpdate[]
          setRecentProductUpdates(Array.isArray(items) ? items : [])
        }

        // (Removed) Critical alerts fetch

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
            <CardTitle className="text-sm font-medium text-pink-700">{t("today") + " " + t("transfer")}</CardTitle>
            <BarChart3 className="h-4 w-4 text-pink-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-pink-900">{salesSummary !== null ? formatCurrency(Math.round(Number(salesSummary) || 0)) : "-"}</div>
            <p className="text-xs text-pink-600 mt-1">
              {userRole === "owner" ? t("allBranches") : t("branch1")} {t("today")}
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
                      <p className="text-sm font-medium text-gray-900 leading-tight">{activity.description}</p>
                      <p className="text-sm text-gray-500 truncate mt-1">{activity.branch_name} • {activity.user_name}</p>
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
                  Page {currentPage} of {totalPages}
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
                      {prod.variation_info !== 'Standard' && (
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
                      {prod.variation_info !== 'Standard' && (
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
                        {prod.variation_info !== 'Standard' && <span>{prod.variation_info} • </span>}
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
                        {update.variation_info !== 'Standard' && <span>{update.variation_info} • </span>}
                        <span>{update.category_info}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-purple-600 font-semibold">{update.update_type}</span>
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
