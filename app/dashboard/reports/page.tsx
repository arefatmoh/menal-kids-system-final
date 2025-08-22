"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Line,
  ComposedChart,
  Area,
  AreaChart,
} from "recharts"
import {
  Download,
  TrendingUp,
  TrendingDown,
  Package,
  DollarSign,
  FileText,
  Building2,
  Target,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
} from "lucide-react"
import { useLanguage } from "@/lib/language-context"
import { AlertsPanel } from "@/components/alerts-panel"
import apiClient from "@/lib/api-client"
import type { ExpenseReport as ExpenseReportType, SalesReport as SalesReportType } from "@/lib/types"
import { useToast } from "@/hooks/use-toast"
import { useBranch } from "@/lib/branch-context"

type SalesReport = SalesReportType
type ExpenseReport = ExpenseReportType

export default function ReportsPage() {
  const { t } = useLanguage()
  const [userRole, setUserRole] = useState<string | null>(null)
  const [timeRange, setTimeRange] = useState("daily")
  const [customDateFrom, setCustomDateFrom] = useState("")
  const [customDateTo, setCustomDateTo] = useState("")
  const [activeTab, setActiveTab] = useState("overview")
  const [salesData, setSalesData] = useState<SalesReport[]>([])
  const [expenseData, setExpenseData] = useState<ExpenseReport[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  // const { t } = useLanguage()
  const { toast } = useToast()
  const { currentBranch } = useBranch()

  // Helper function for generating random colors
  const getRandomColor = () => {
    const colors = ["#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#6b7280"]
    return colors[Math.floor(Math.random() * colors.length)]
  }

  // Money helpers: coerce to number and format without cents or leading zeros
  const toNumber = (value: unknown): number => {
    if (typeof value === "number") return value
    if (typeof value === "string") {
      const parsed = Number(value)
      return Number.isFinite(parsed) ? parsed : 0
    }
    return 0
  }

  const formatMoney = (value: unknown): string => {
    const num = toNumber(value)
    return new Intl.NumberFormat("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(num)
  }

  useEffect(() => {
    const role = localStorage.getItem("userRole")
    if (!role) {
      router.push("/")
      return
    }
    if (role !== "owner") {
      router.push("/dashboard")
      return
    }
    setUserRole(role)
  }, [router])

  useEffect(() => {
    if (userRole === "owner") {
      fetchReportsData()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userRole, timeRange, customDateFrom, customDateTo, currentBranch])

  const fetchReportsData = async (): Promise<void> => {
    setIsLoading(true)
    try {
      // Fetch sales report data
      const salesParams: Record<string, unknown> = {
        time_range: timeRange,
      }

      if (timeRange === "custom" && customDateFrom && customDateTo) {
        salesParams.start_date = customDateFrom
        salesParams.end_date = customDateTo
      }

      if (currentBranch !== "all") {
        salesParams.branch_id = currentBranch
      }

      const salesResponse = await apiClient.getSalesReport(salesParams)
      if (salesResponse.success) {
        setSalesData((salesResponse.data as SalesReport[]) || [])
      }

      // Fetch expense report data
      const expenseParams: Record<string, unknown> = {}
      if (timeRange === "custom" && customDateFrom && customDateTo) {
        expenseParams.start_date = customDateFrom
        expenseParams.end_date = customDateTo
      }

      if (currentBranch !== "all") {
        expenseParams.branch_id = currentBranch
      }

      const expenseResponse = await apiClient.getExpenseReport(expenseParams)
      if (expenseResponse.success) {
        setExpenseData((expenseResponse.data as ExpenseReport[]) || [])
      }
    } catch (error: unknown) {
      console.error("Reports fetch error:", error)
      toast({
        title: "Error",
        description: "Failed to load reports data",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleDownloadReport = (reportType: string) => {
    alert(`Downloading ${reportType} report...`)
  }

  if (!userRole) {
    return <div>Loading...</div>
  }

  // Transform API data for charts using real data (directly inline where needed)

  // Calculate totals for each branch
  const branchTotals = salesData.reduce((acc, item) => {
    if (!acc[item.branch_name]) {
      acc[item.branch_name] = {
        totalSales: 0,
        totalTransactions: 0,
      }
    }
    acc[item.branch_name].totalSales += toNumber(item.total_sales)
    acc[item.branch_name].totalTransactions += toNumber(item.transaction_count)
    return acc
  }, {} as Record<string, { totalSales: number; totalTransactions: number }>)

  // Get unique branch names
  const branchNames = [...new Set(salesData.map(item => item.branch_name))]

  // Calculate cash flow from real data
  const calculateCashFlow = (): Array<{
    period: string;
    cashIn: number;
    cashOut: number;
    profit: number;
  }> => {
    const cashFlowData: Array<{
      period: string;
      cashIn: number;
      cashOut: number;
      profit: number;
    }> = []
    
    // Group sales by period
    const salesByPeriod = salesData.reduce((acc, item) => {
      if (!acc[item.period_label]) {
        acc[item.period_label] = { cashIn: 0, cashOut: 0 }
      }
      acc[item.period_label].cashIn += toNumber(item.total_sales)
      return acc
    }, {} as Record<string, { cashIn: number; cashOut: number }>)

    // Group expenses by period (assuming expenses are monthly for now)
    const expensesByPeriod = expenseData.reduce((acc, item) => {
      const period = 'Monthly' // You might want to adjust this based on your expense data structure
      if (!acc[period]) {
        acc[period] = 0
      }
      acc[period] += toNumber(item.total_amount)
      return acc
    }, {} as Record<string, number>)

    // Combine sales and expenses
    Object.keys(salesByPeriod).forEach(period => {
      const cashIn = salesByPeriod[period].cashIn
      const cashOut = expensesByPeriod[period] || 0
      const profit = cashIn - cashOut
      
      cashFlowData.push({
        period,
        cashIn,
        cashOut,
        profit
      })
    })

    // If no real data, return empty array
    return cashFlowData.length > 0 ? cashFlowData : []
  }

  const cashFlowData = calculateCashFlow()

  // Transform expense data for charts
  const expensesData = expenseData.length > 0 
    ? expenseData.map(item => ({
        category: item.category,
        amount: toNumber(item.total_amount),
        color: getRandomColor(),
      }))
    : []

  // Create branch comparison data from real data
  const branchComparisonData = branchNames.map(branchName => {
    const branchData = branchTotals[branchName] || { totalSales: 0, totalTransactions: 0 }
    const avgOrder = branchData.totalTransactions > 0 ? branchData.totalSales / branchData.totalTransactions : 0
    
    return {
      metric: branchName,
      totalSales: branchData.totalSales,
      totalTransactions: branchData.totalTransactions,
      avgOrder: avgOrder,
      unit: "Birr"
    }
  })

  // Prepare chart data for sales performance
  const salesChartData = salesData.map(item => ({
    period: item.period_label,
    [item.branch_name]: toNumber(item.total_sales),
  }))

  return (
    <div className="space-y-6 px-4 sm:px-6">
      <div className="flex flex-col space-y-4 sm:space-y-0 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{t("reports")}</h1>
          <p className="text-gray-600 mt-1 text-sm sm:text-base">{t("financialOverview" as any)}</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center space-y-2 sm:space-y-0 sm:space-x-3">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-full sm:w-40 rounded-xl border-gray-200 focus:border-pink-300 focus:ring-pink-200">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="custom">Custom Range</SelectItem>
            </SelectContent>
          </Select>
          <Button
            onClick={() => handleDownloadReport("complete")}
            className="w-full sm:w-auto bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white rounded-xl"
          >
            <Download className="h-4 w-4 mr-2" />
            {t("downloadCompleteReport" as any)}
          </Button>
        </div>
      </div>

      {/* Custom Date Range */}
      {timeRange === "custom" && (
        <Card className="border-0 shadow-lg">
          <CardContent className="pt-6">
            <div className="flex flex-col space-y-4 sm:space-y-0 sm:flex-row sm:gap-4 sm:items-end">
              <div className="flex-1">
                <Label htmlFor="dateFrom" className="text-sm font-medium text-gray-700 mb-2 block">From Date</Label>
                <Input
                  id="dateFrom"
                  type="date"
                  value={customDateFrom}
                  onChange={(e) => setCustomDateFrom(e.target.value)}
                  className="w-full rounded-xl border-gray-200 focus:border-pink-300 focus:ring-pink-200"
                />
              </div>
              <div className="flex-1">
                <Label htmlFor="dateTo" className="text-sm font-medium text-gray-700 mb-2 block">To Date</Label>
                <Input
                  id="dateTo"
                  type="date"
                  value={customDateTo}
                  onChange={(e) => setCustomDateTo(e.target.value)}
                  className="w-full rounded-xl border-gray-200 focus:border-pink-300 focus:ring-pink-200"
                />
              </div>
              <Button
                className="w-full sm:w-auto bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl"
                disabled={!customDateFrom || !customDateTo}
                onClick={fetchReportsData}
              >
                Apply Range
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading && (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-pink-500" />
        </div>
      )}

      {!isLoading && (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-1 sm:grid-cols-3 gap-2 overflow-x-auto">
            <TabsTrigger value="overview" className="text-xs sm:text-sm whitespace-nowrap">{t("financialOverview" as any)}</TabsTrigger>
            <TabsTrigger value="finance" className="text-xs sm:text-sm whitespace-nowrap">Finance & Budget</TabsTrigger>
            <TabsTrigger value="comparison" className="text-xs sm:text-sm whitespace-nowrap">Branch Comparison</TabsTrigger>
          </TabsList>

          {/* Sales Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Today's Sales Summary */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-blue-100">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xs sm:text-sm font-medium text-blue-700">{t("totalSales" as any)}</CardTitle>
                  <DollarSign className="h-4 w-4 text-blue-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-lg sm:text-2xl font-bold text-blue-900">
                    {formatMoney(Object.values(branchTotals).reduce((sum, branch) => sum + branch.totalSales, 0))} ብር
                  </div>
                  <p className="text-xs text-blue-600 mt-1">
                    <TrendingUp className="inline h-3 w-3 mr-1" />
                    {t("salesTransactions" as any)}
                  </p>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-lg bg-gradient-to-br from-green-50 to-green-100">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xs sm:text-sm font-medium text-green-700">{t("salesTransactions" as any)}</CardTitle>
                  <Package className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-lg sm:text-2xl font-bold text-green-900">
                    {Object.values(branchTotals).reduce((sum, branch) => sum + branch.totalTransactions, 0)}
                  </div>
                  <p className="text-xs text-green-600 mt-1">
                    <TrendingUp className="inline h-3 w-3 mr-1" />
                    Across all branches
                  </p>
                </CardContent>
              </Card>

              {branchNames.slice(0, 2).map((branchName, index) => (
                <Card key={branchName} className={`border-0 shadow-lg bg-gradient-to-br ${
                  index === 0 ? 'from-purple-50 to-purple-100' : 'from-orange-50 to-orange-100'
                }`}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className={`text-xs sm:text-sm font-medium ${
                      index === 0 ? 'text-purple-700' : 'text-orange-700'
                    }`}>{branchName} Sales</CardTitle>
                    <Building2 className={`h-4 w-4 ${
                      index === 0 ? 'text-purple-600' : 'text-orange-600'
                    }`} />
                </CardHeader>
                <CardContent>
                    <div className={`text-lg sm:text-2xl font-bold ${
                      index === 0 ? 'text-purple-900' : 'text-orange-900'
                    }`}>
                      {formatMoney(branchTotals[branchName]?.totalSales || 0)} ብር
                    </div>
                    <p className={`text-xs ${
                      index === 0 ? 'text-purple-600' : 'text-orange-600'
                    } mt-1`}>
                      {branchTotals[branchName]?.totalTransactions || 0} transactions
                    </p>
                </CardContent>
              </Card>
              ))}
            </div>

            {/* Sales Chart */}
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <BarChart className="h-5 w-5 text-pink-500" />
                  <span className="text-lg sm:text-xl">{t("salesPerformanceByBranch" as any)}</span>
                </CardTitle>
                <CardDescription className="text-sm">Compare sales performance across branches over time</CardDescription>
              </CardHeader>
              <CardContent>
                {salesChartData.length > 0 ? (
                  <div className="w-full h-64 sm:h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={salesChartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="period" className="text-xs" />
                        <YAxis className="text-xs" />
                        <Tooltip />
                        {branchNames.map((branchName, index) => (
                          <Bar
                            key={branchName}
                            dataKey={branchName}
                            fill={getRandomColor()}
                            radius={[4, 4, 0, 0]}
                          />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <BarChart className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500 text-sm sm:text-base">No sales data available for the selected time range</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Finance & Budget Tab */}
          <TabsContent value="finance" className="space-y-6">
            {/* Financial Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              <Card className="border-0 shadow-lg bg-gradient-to-br from-green-50 to-green-100">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xs sm:text-sm font-medium text-green-700">Total Sales</CardTitle>
                  <TrendingUp className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-lg sm:text-2xl font-bold text-green-900">
                    {formatMoney(Object.values(branchTotals).reduce((sum, branch) => sum + branch.totalSales, 0))} ብር
                  </div>
                  <p className="text-xs text-green-600 mt-1">
                    <ArrowUpRight className="inline h-3 w-3 mr-1" />
                    Real-time data
                  </p>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-lg bg-gradient-to-br from-red-50 to-red-100">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xs sm:text-sm font-medium text-red-700">Total Expenses</CardTitle>
                  <TrendingDown className="h-4 w-4 text-red-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-lg sm:text-2xl font-bold text-red-900">
                    {formatMoney(expenseData.reduce((sum, expense) => sum + (typeof expense.total_amount === 'number' ? expense.total_amount : Number(expense.total_amount)), 0))} ብር
                  </div>
                  <p className="text-xs text-red-600 mt-1">
                    <ArrowDownRight className="inline h-3 w-3 mr-1" />
                    Real-time data
                  </p>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-blue-100">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xs sm:text-sm font-medium text-blue-700">Net Profit</CardTitle>
                  <Target className="h-4 w-4 text-blue-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-lg sm:text-2xl font-bold text-blue-900">
                    {(() => {
                      const totalSales = Object.values(branchTotals).reduce((sum, branch) => sum + branch.totalSales, 0)
                      const totalExpenses = expenseData.reduce((sum, expense) => sum + (typeof expense.total_amount === 'number' ? expense.total_amount : Number(expense.total_amount)), 0)
                      const netProfit = totalSales - totalExpenses
                      return formatMoney(netProfit)
                    })()} ብር
                  </div>
                  <p className="text-xs text-blue-600 mt-1">
                    Sales minus expenses
                  </p>
                </CardContent>
              </Card>

              {/* Average Order Value */}
              <Card className="border-0 shadow-lg bg-gradient-to-br from-amber-50 to-amber-100">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xs sm:text-sm font-medium text-amber-700">Average Order Value</CardTitle>
                  <DollarSign className="h-4 w-4 text-amber-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-lg sm:text-2xl font-bold text-amber-900">
                    {(() => {
                      const totalSales = Object.values(branchTotals).reduce((sum, b) => sum + b.totalSales, 0)
                      const totalTransactions = Object.values(branchTotals).reduce((sum, b) => sum + b.totalTransactions, 0)
                      const aov = totalTransactions > 0 ? totalSales / totalTransactions : 0
                      return formatMoney(aov)
                    })()} ብር
                  </div>
                  <p className="text-xs text-amber-600 mt-1">Sales / transactions</p>
                </CardContent>
              </Card>

              {/* Expense Entries Count */}
              <Card className="border-0 shadow-lg bg-gradient-to-br from-slate-50 to-slate-100">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xs sm:text-sm font-medium text-slate-700">Expense Entries</CardTitle>
                  <FileText className="h-4 w-4 text-slate-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-lg sm:text-2xl font-bold text-slate-900">
                    {expenseData.reduce((sum, e) => sum + (typeof e.expense_count === 'number' ? e.expense_count : Number(e.expense_count)), 0)}
                  </div>
                  <p className="text-xs text-slate-600 mt-1">Count of expenses in range</p>
                </CardContent>
              </Card>

              {/* Expenses to Sales Ratio */}
              <Card className="border-0 shadow-lg bg-gradient-to-br from-fuchsia-50 to-fuchsia-100">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xs sm:text-sm font-medium text-fuchsia-700">Expenses / Sales</CardTitle>
                  <TrendingDown className="h-4 w-4 text-fuchsia-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-lg sm:text-2xl font-bold text-fuchsia-900">
                    {(() => {
                      const totalSales = Object.values(branchTotals).reduce((sum, b) => sum + b.totalSales, 0)
                      const totalExpenses = expenseData.reduce((sum, e) => sum + (typeof e.total_amount === 'number' ? e.total_amount : Number(e.total_amount)), 0)
                      const pct = totalSales > 0 ? (totalExpenses / totalSales) * 100 : 0
                      return `${pct.toFixed(0)}%`
                    })()}
                  </div>
                  <p className="text-xs text-fuchsia-600 mt-1">Portion of sales spent</p>
                </CardContent>
              </Card>

              {/* Top Expense Category */}
              <Card className="border-0 shadow-lg bg-gradient-to-br from-emerald-50 to-emerald-100">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-emerald-700">Top Expense Category</CardTitle>
                  <Package className="h-4 w-4 text-emerald-600" />
                </CardHeader>
                <CardContent>
                  {(() => {
                    const list = expensesData || []
                    if (!list.length) return <div className="text-sm text-emerald-700">No data</div>
                    const top = [...list].sort((a, b) => b.amount - a.amount)[0]
                    return (
                      <div className="flex items-baseline justify-between">
                        <div className="text-lg font-semibold text-emerald-900">{top.category}</div>
                        <div className="text-2xl font-bold text-emerald-900">{formatMoney(top.amount)} ብር</div>
                      </div>
                    )
                  })()}
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Cash Flow Chart */}
              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Wallet className="h-5 w-5 text-green-500" />
                    <span>Cash Flow Analysis</span>
                  </CardTitle>
                  <CardDescription>Cash in vs cash out for selected period</CardDescription>
                </CardHeader>
                <CardContent>
                  {cashFlowData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={cashFlowData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="period" stroke="#666" />
                      <YAxis stroke="#666" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#fff",
                          border: "1px solid #e2e8f0",
                          borderRadius: "8px",
                          boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                        }}
                          formatter={(value) => [`${formatMoney(value as number)} ብር`, ""]}
                      />
                      <Area
                        type="monotone"
                        dataKey="cashIn"
                        stackId="1"
                        stroke="#10b981"
                        fill="#10b981"
                        fillOpacity={0.6}
                        name="Cash In"
                      />
                      <Area
                        type="monotone"
                        dataKey="cashOut"
                        stackId="2"
                        stroke="#ef4444"
                        fill="#ef4444"
                        fillOpacity={0.6}
                        name="Cash Out"
                      />
                      <Line
                        type="monotone"
                        dataKey="profit"
                        stroke="#8b5cf6"
                        strokeWidth={3}
                        name="Net Profit"
                        dot={{ fill: "#8b5cf6", strokeWidth: 2, r: 4 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                  ) : (
                    <div className="text-center py-8">
                      <Wallet className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">No Cash Flow Data</h3>
                      <p className="text-gray-500">No sales or expense data available for cash flow analysis</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Expenses Breakdown */}
              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Package className="h-5 w-5 text-red-500" />
                    <span>Expenses Breakdown</span>
                  </CardTitle>
                  <CardDescription>Expense distribution by category</CardDescription>
                </CardHeader>
                <CardContent>
                  {expensesData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={expensesData}
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="amount"
                          label={({ category, amount }) => `${category}: ${formatMoney(amount)} ብር`}
                      >
                        {expensesData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                        <Tooltip formatter={(value) => [`${formatMoney(value as number)} ብር`, "Amount"]} />
                    </PieChart>
                  </ResponsiveContainer>
                  ) : (
                    <div className="text-center py-8">
                      <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">No Expense Data</h3>
                      <p className="text-gray-500">No expense data available for breakdown</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Detailed Expenses Table */}
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <FileText className="h-5 w-5 text-indigo-500" />
                  <span>Detailed Expense Report</span>
                </CardTitle>
                <CardDescription>Breakdown of all business expenses</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {expensesData.map((expense, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-4 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center space-x-4">
                        <div className="w-4 h-4 rounded-full" style={{ backgroundColor: expense.color }} />
                        <div>
                          <p className="font-medium text-gray-900">{expense.category}</p>
                          <p className="text-sm text-gray-500">Monthly expense</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gray-900">{formatMoney(expense.amount)} ብር</p>
                        <Badge variant="outline" className="rounded-full">
                          {((expense.amount / expensesData.reduce((sum, e) => sum + e.amount, 0)) * 100).toFixed(0)}%
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Branch Comparison Tab */}
          <TabsContent value="comparison" className="space-y-6">
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Building2 className="h-5 w-5 text-purple-500" />
                  <span className="text-lg sm:text-xl">Branch Performance Comparison</span>
                </CardTitle>
                <CardDescription className="text-sm">Side-by-side comparison of branch metrics</CardDescription>
              </CardHeader>
              <CardContent>
                {branchNames.length > 0 ? (
                <div className="space-y-6">
                    {branchComparisonData.map((branchData, index) => (
                    <div key={index} className="p-4 rounded-lg bg-gray-50">
                        <h4 className="font-medium text-gray-900 mb-4 text-sm sm:text-base">{branchData.metric}</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="text-center p-4 bg-purple-50 rounded-lg">
                            <p className="text-xs sm:text-sm text-purple-600 mb-1">Total Sales</p>
                          <p className="text-lg sm:text-2xl font-bold text-purple-900">
                              {formatMoney(branchData.totalSales)} ብር
                          </p>
                        </div>
                        <div className="text-center p-4 bg-blue-50 rounded-lg">
                            <p className="text-xs sm:text-sm text-blue-600 mb-1">Transactions</p>
                          <p className="text-lg sm:text-2xl font-bold text-blue-900">
                              {branchData.totalTransactions}
                          </p>
                          </div>
                          <div className="text-center p-4 bg-green-50 rounded-lg">
                            <p className="text-xs sm:text-sm text-green-600 mb-1">Avg Order</p>
                            <p className="text-lg sm:text-2xl font-bold text-green-900">
                              {formatMoney(branchData.avgOrder)} ብር
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                ) : (
                  <div className="text-center py-8">
                    <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Branch Data</h3>
                    <p className="text-gray-500">No sales data available for comparison</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Visual Branch Comparison Chart */}
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <BarChart className="h-5 w-5 text-green-500" />
                  <span className="text-lg sm:text-xl">Sales by Branch</span>
                </CardTitle>
                <CardDescription className="text-sm">Graphical representation of branch sales performance</CardDescription>
              </CardHeader>
              <CardContent>
                {branchNames.length > 0 ? (
                <div className="w-full h-64 sm:h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={branchComparisonData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="metric" stroke="#666" className="text-xs" />
                      <YAxis stroke="#666" className="text-xs" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#fff",
                        border: "1px solid #e2e8f0",
                        borderRadius: "8px",
                        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                      }}
                        formatter={(value) => [`${formatMoney(value as number)} ብር`, "Sales"]}
                      />
                      <Bar dataKey="totalSales" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                ) : (
                  <div className="text-center py-8">
                    <BarChart className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Chart Data</h3>
                    <p className="text-gray-500">No sales data available for visualization</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {/* Alerts Panel */}
      <AlertsPanel />
    </div>
  )
}