import type { ApiResponse, PaginatedResponse } from "./types"

class ApiClient {
  private baseUrl: string
  private token: string | null = null
  private isRefreshing = false
  private refreshPromise: Promise<string | null> | null = null

  constructor(baseUrl = "/api") {
    this.baseUrl = baseUrl

    // Get token from localStorage if available
    if (typeof window !== "undefined") {
      this.token = localStorage.getItem("auth_token")
    }
  }

  setToken(token: string) {
    this.token = token
    if (typeof window !== "undefined") {
      localStorage.setItem("auth_token", token)
    }
  }

  clearToken() {
    this.token = null
    if (typeof window !== "undefined") {
      localStorage.removeItem("auth_token")
    }
  }

  private async handleTokenRefresh(): Promise<string | null> {
    if (this.isRefreshing && this.refreshPromise) {
      return this.refreshPromise
    }

    this.isRefreshing = true
    this.refreshPromise = this.refreshToken()

    try {
      const newToken = await this.refreshPromise
      return newToken
    } finally {
      this.isRefreshing = false
      this.refreshPromise = null
    }
  }

  private async refreshToken(): Promise<string | null> {
    try {
      // Try to refresh the token using the current token
      const response = await fetch(`${this.baseUrl}/auth/refresh`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
        },
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success && data.data?.token) {
          this.setToken(data.data.token)
          return data.data.token
        }
      }
    } catch (error) {
      console.error("Token refresh failed:", error)
    }

    // If refresh fails, clear the token and redirect to login
    this.clearToken()
    if (typeof window !== "undefined") {
      window.location.href = "/login"
    }
    return null
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`

    // Ensure token is current (e.g., after a fresh login in another component)
    if (!this.token && typeof window !== "undefined") {
      const t = localStorage.getItem("auth_token")
      if (t) this.token = t
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string> || {}),
    }

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      })

      // Handle 401 Unauthorized - try to refresh token
      if (response.status === 401 && this.token) {
        const newToken = await this.handleTokenRefresh()
        if (newToken) {
          // Retry the request with the new token
          headers.Authorization = `Bearer ${newToken}`
          const retryResponse = await fetch(url, {
            ...options,
            headers,
          })
          
          if (retryResponse.ok) {
            const raw = (await retryResponse.json()) as unknown
            return raw as ApiResponse<T>
          }
        }
      }

      const raw = (await response.json()) as unknown
      const data = raw as ApiResponse<T>

      if (!response.ok) {
        const body = (raw || {}) as { error?: string; code?: string }
        const err = new Error(body.error || `HTTP error! status: ${response.status}`) as Error & {
          code?: string
          status?: number
          details?: unknown
        }
        if (body && typeof body === 'object') {
          err.code = typeof body.code === 'string' ? body.code : undefined
          err.details = raw
        }
        err.status = response.status
        throw err
      }

      return data
    } catch (error) {
      console.error("API request failed:", error)
      throw error
    }
  }

  private buildSearchParams(params: Record<string, unknown>): URLSearchParams {
    const searchParams = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.append(key, String(value))
      }
    })
    return searchParams
  }

  // Auth methods
  async getCurrentUser() {
    return this.request("/auth/me")
  }
  async login(email: string, password: string) {
    return this.request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    })
  }

  async logout() {
    try {
      await this.request("/auth/logout", {
        method: "POST",
      })
    } catch (error) {
      console.error("Logout request failed:", error)
    } finally {
      this.clearToken()
    }
  }

  async register(userData: Record<string, unknown>) {
    return this.request("/auth/register", {
      method: "POST",
      body: JSON.stringify(userData),
    })
  }

  // Dashboard methods
  async getDashboardStats(branchId?: string) {
    const params = branchId ? `?branch_id=${branchId}` : ""
    return this.request(`/dashboard/stats${params}`)
  }

  async getRecentActivities(branchId?: string, limit?: number) {
    const params = new URLSearchParams()
    if (branchId) params.append("branch_id", branchId)
    if (limit) params.append("limit", limit.toString())

    return this.request(`/dashboard/activities?${params}`)
  }

  // Product methods
  async getProducts(params: Record<string, unknown> = {}) {
    const searchParams = this.buildSearchParams(params)
    return this.request<PaginatedResponse<Record<string, unknown>>>(`/products?${searchParams}`)
  }

  async createProduct(productData: Record<string, unknown>) {
    return this.request("/products", {
      method: "POST",
      body: JSON.stringify(productData),
    })
  }

  async updateProduct(id: string, productData: Record<string, unknown>) {
    return this.request(`/products/${id}`, {
      method: "PUT",
      body: JSON.stringify(productData),
    })
  }

  async updateVariation(productId: string, variationId: string, variationData: Record<string, unknown>) {
    return this.request(`/products/${productId}/variations/${variationId}`, {
      method: "PUT",
      body: JSON.stringify(variationData),
    })
  }

  async getVariation(productId: string, variationId: string) {
    return this.request(`/products/${productId}/variations/${variationId}`)
  }

  async deleteVariation(productId: string, variationId: string) {
    return this.request(`/products/${productId}/variations/${variationId}`, {
      method: "DELETE",
    })
  }

  async addVariationToProduct(productId: string, variationData: Record<string, unknown>) {
    return this.request(`/products/${productId}/variations`, {
      method: "POST",
      body: JSON.stringify(variationData),
    })
  }

  async getVariations(productId: string) {
    return this.request(`/products/${productId}/variations`)
  }

  async deleteProduct(id: string, hardDelete: boolean = false) {
    const params = hardDelete ? '?hard=true' : ''
    return this.request(`/products/${id}${params}`, {
      method: "DELETE",
    })
  }

  // Inventory methods
  async getInventory(params: Record<string, unknown> = {}) {
    const searchParams = this.buildSearchParams(params)
    return this.request(`/inventory?${searchParams}`)
  }

  async updateInventory(inventoryData: Record<string, unknown>) {
    return this.request("/inventory", {
      method: "PUT",
      body: JSON.stringify(inventoryData),
    })
  }

  

  // Sales methods
  async getSales(params: Record<string, unknown> = {}) {
    const searchParams = this.buildSearchParams(params)
    return this.request<PaginatedResponse<Record<string, unknown>>>(`/sales?${searchParams}`)
  }

  async createSale(saleData: Record<string, unknown>) {
    return this.request("/sales", {
      method: "POST",
      body: JSON.stringify(saleData),
    })
  }

  // Stock movement methods
  async getStockMovements(params: Record<string, unknown> = {}) {
    const searchParams = this.buildSearchParams(params)
    return this.request<PaginatedResponse<Record<string, unknown>>>(`/stock-movements?${searchParams}`)
  }

  async createStockMovement(movementData: Record<string, unknown>) {
    return this.request("/stock-movements", {
      method: "POST",
      body: JSON.stringify(movementData),
    })
  }

  // Alert methods
  async getAlerts(params: Record<string, unknown> = {}) {
    const searchParams = this.buildSearchParams(params)
    return this.request(`/alerts?${searchParams}`)
  }

  async updateAlert(id: string, alertData: Record<string, unknown>) {
    return this.request("/alerts", {
      method: "PUT",
      body: JSON.stringify({ id, ...alertData }),
    })
  }

  // Branch methods
  async getBranches() {
    return this.request("/branches")
  }

  async createBranch(branchData: Record<string, unknown>) {
    return this.request("/branches", {
      method: "POST",
      body: JSON.stringify(branchData),
    })
  }

  // Category methods
  async getCategories() {
    return this.request("/categories")
  }

  async createCategory(categoryData: Record<string, unknown>) {
    return this.request("/categories", {
      method: "POST",
      body: JSON.stringify(categoryData),
    })
  }

  // Report methods
  async getSalesReport(params: Record<string, unknown> = {}) {
    const searchParams = this.buildSearchParams(params)
    return this.request(`/reports/sales?${searchParams}`)
  }

  async getSalesTotal(params: Record<string, unknown> = {}) {
    const searchParams = this.buildSearchParams(params)
    return this.request(`/dashboard/sales-total?${searchParams}`)
  }

  async getStockTrend(params: Record<string, unknown> = {}) {
    const searchParams = this.buildSearchParams(params)
    return this.request(`/dashboard/stock-trend?${searchParams}`)
  }

  async getTopSellingToday(params: Record<string, unknown> = {}) {
    const searchParams = this.buildSearchParams(params)
    return this.request(`/dashboard/top-selling-today?${searchParams}`)
  }

  async getTopSellingWeek(params: Record<string, unknown> = {}) {
    const searchParams = this.buildSearchParams(params)
    return this.request(`/dashboard/top-selling-week?${searchParams}`)
  }

  async getLowStockProducts(params: Record<string, unknown> = {}) {
    const searchParams = this.buildSearchParams(params)
    return this.request(`/dashboard/low-stock-products?${searchParams}`)
  }

  async getHighValueInventory(params: Record<string, unknown> = {}) {
    const searchParams = this.buildSearchParams(params)
    return this.request(`/dashboard/high-value-inventory?${searchParams}`)
  }

  async getRecentProductUpdates(params: Record<string, unknown> = {}) {
    const searchParams = this.buildSearchParams(params)
    return this.request(`/dashboard/recent-product-updates?${searchParams}`)
  }

  async getExpenseReport(params: Record<string, unknown> = {}) {
    const searchParams = this.buildSearchParams(params)
    return this.request(`/reports/expenses?${searchParams}`)
  }

  async getTransfers(params: Record<string, unknown> = {}) {
    const searchParams = this.buildSearchParams(params)
    return this.request<PaginatedResponse<Record<string, unknown>>>(`/transfers?${searchParams}`)
  }

  async createTransfer(transferData: Record<string, unknown>) {
    return this.request<Record<string, unknown>>("/transfers", {
      method: "POST",
      body: JSON.stringify(transferData),
    })
  }

  async createExpense(expenseData: Record<string, unknown>) {
    return this.request("/expenses", {
      method: "POST",
      body: JSON.stringify(expenseData),
    });
  }

  async getExpenses(params: Record<string, unknown> = {}) {
    return this.request(`/expenses?${this.buildSearchParams(params)}`);
  }

  async updateExpense(id: string, expenseData: Record<string, unknown>) {
    return this.request(`/expenses`, {
      method: "PUT",
      body: JSON.stringify({ id, ...expenseData }),
    });
  }

  async deleteExpense(id: string) {
    return this.request(`/expenses?id=${id}`, {
      method: "DELETE",
    });
  }

  // Transfer-specific methods
  async getTransferHistory(params: Record<string, unknown> = {}) {
    const searchParams = this.buildSearchParams(params)
    return this.request<PaginatedResponse<Record<string, unknown>>>(`/transfers?${searchParams}`)
  }

  async getBranchInventory(branchId: string, params: Record<string, unknown> = {}) {
    const searchParams = this.buildSearchParams({ branch_id: branchId, ...params })
    return this.request(`/inventory?${searchParams}`)
  }

  // Admin tools
  async adminEnableTools(passcode: string) {
    return this.request("/admin/tools/enable", {
      method: "POST",
      body: JSON.stringify({ passcode }),
    })
  }

  async adminGetTables() {
    return this.request("/admin/db/tables")
  }

  async adminGetRows(table: string, page = 1, limit = 25) {
    const sp = new URLSearchParams()
    sp.set("table", table)
    sp.set("page", String(page))
    sp.set("limit", String(limit))
    return this.request(`/admin/db/rows?${sp.toString()}`)
  }

  async adminUpdateRow(params: {
    table: string
    primaryKey: string
    primaryKeyValue: unknown
    updates: Record<string, unknown>
  }) {
    return this.request("/admin/db/rows", {
      method: "PUT",
      body: JSON.stringify(params),
    })
  }

  async adminInsertRow(params: { table: string; values: Record<string, unknown> }) {
    return this.request("/admin/db/rows", {
      method: "POST",
      body: JSON.stringify(params),
    })
  }

  async adminDeleteRow(params: { table: string; primaryKey: string; primaryKeyValue: unknown; soft?: boolean }) {
    const sp = new URLSearchParams()
    sp.set("table", params.table)
    sp.set("primaryKey", params.primaryKey)
    sp.set("primaryKeyValue", String(params.primaryKeyValue as unknown as string))
    if (params.soft) sp.set("soft", "true")
    return this.request(`/admin/db/rows?${sp.toString()}`, { method: "DELETE" })
  }

  async adminGetDependents(params: { table: string; primaryKey: string; primaryKeyValue: unknown }) {
    const sp = new URLSearchParams()
    sp.set("table", params.table)
    sp.set("primaryKey", params.primaryKey)
    sp.set("primaryKeyValue", String(params.primaryKeyValue as unknown as string))
    return this.request(`/admin/db/dependents?${sp.toString()}`)
  }

  async adminCascadeDelete(params: { table: string; primaryKey: string; primaryKeyValue: unknown; dependents: Array<{ table: string; column: string }> }) {
    return this.request(`/admin/db/cascade-delete`, {
      method: "POST",
      body: JSON.stringify(params),
    })
  }

  async adminBulkDelete(params: { table: string; soft?: boolean; confirm: string }) {
    return this.request(`/admin/db/bulk-delete`, {
      method: "POST",
      body: JSON.stringify(params),
    })
  }
}

// Create singleton instance
const apiClient = new ApiClient()

export default apiClient
