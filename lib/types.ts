// User types
export interface User {
  id: string
  email: string
  full_name: string
  role: "owner" | "employee"
  branch_id?: string
  phone?: string
  is_active: boolean
  last_login?: Date
  created_at: Date
  updated_at: Date
}

export interface CreateUserData {
  email: string
  password: string
  full_name: string
  role: "owner" | "employee"
  branch_id?: string
  phone?: string
}

// Branch types
export interface Branch {
  id: string
  name: string
  address?: string
  phone?: string
  email?: string
  manager_name?: string
  is_active: boolean
  created_at: Date
  updated_at: Date
}

// Category types
export interface Category {
  id: string
  name: string
  description?: string
  parent_id?: string
  is_active: boolean
  created_at: Date
  updated_at: Date
}

// Product types
export interface Product {
  id: string
  name: string
  sku: string
  category_id: string
  description?: string
  image_url?: string
  barcode?: string
  brand?: string
  age_range?: string
  gender?: "boys" | "girls" | "unisex"
  product_type: "uniform" | "variation"
  is_active: boolean
  created_at: Date
  updated_at: Date
}

export interface ProductVariation {
  id: string
  product_id: string
  sku: string
  color?: string
  size?: string
  price?: number
  cost_price?: number
  purchase_price?: number
  is_active: boolean
  created_at: Date
  updated_at: Date
}

export interface ProductWithVariations extends Product {
  variations?: ProductVariation[]
  uniform_details?: {
    color?: string
    size?: string
    price?: number
    cost_price?: number
    purchase_price?: number
  }
}

export interface CreateProductData {
  name: string
  sku?: string
  category_id: string
  description?: string
  image_url?: string
  barcode?: string
  brand?: string
  age_range?: string
  gender?: "boys" | "girls" | "unisex"
  product_type: "uniform" | "variation"
  // For uniform products
  uniform_details?: {
    color?: string
    size?: string
    price?: number
    cost_price?: number
    purchase_price?: number
  }
  // For variation products
  variations?: Array<{
    color?: string
    size?: string
    price?: number
    cost_price?: number
    purchase_price?: number
    initial_quantity: number
    min_stock_level?: number | null
    max_stock_level?: number | null
  }>
  // Legacy support for uniform products
  color?: string
  size?: string
  price?: number
  cost_price?: number
  purchase_price?: number
  initial_quantity?: number
  min_stock_level?: number | null
  max_stock_level?: number | null
  branch_id: string
}

// Inventory types
export interface Inventory {
  id: string
  product_id: string
  branch_id: string
  quantity: number
  min_stock_level: number
  max_stock_level: number
  last_restocked?: Date
  created_at: Date
  updated_at: Date
}

export interface InventoryWithProduct extends Inventory {
  product_name: string
  product_sku: string
  product_price: number
  category_name: string
  branch_name: string
  stock_status: "out_of_stock" | "low_stock" | "normal" | "overstock"
}

// Sales types
export interface Sale {
  id: string
  branch_id: string
  user_id: string
  customer_name?: string
  customer_phone?: string
  payment_method: "cash" | "pos" | "telebirr" | "mobile_transfer"
  total_amount: number
  discount: number
  notes?: string
  created_at: Date
  updated_at: Date
}

export interface SaleItem {
  id: string
  sale_id: string
  product_id: string
  variation_id?: string
  quantity: number
  unit_price: number
  total_price: number
  created_at: Date
}

export interface CreateSaleData {
  branch_id: string
  user_id: string
  customer_name?: string
  customer_phone?: string
  payment_method: "cash" | "pos" | "telebirr" | "mobile_transfer"
  discount?: number
  notes?: string
  items: {
    product_id: string
    variation_id?: string
    quantity: number
    unit_price: number
  }[]
}

// Stock Movement types
export interface StockMovement {
  id: string
  product_id: string
  branch_id: string
  user_id: string
  movement_type: "in" | "out"
  quantity: number
  reason?: string
  reference_type?: string
  reference_id?: string
  created_at: Date
}

export interface CreateStockMovementData {
  product_id: string
  branch_id: string
  user_id: string
  movement_type: "in" | "out"
  quantity: number
  reason?: string
  reference_type?: string
  reference_id?: string
}

// Transfer types
export interface Transfer {
  id: string
  from_branch_id: string
  to_branch_id: string
  requested_by: string
  approved_by?: string
  status: "pending" | "approved" | "in_transit" | "completed" | "cancelled"
  reason: string
  notes?: string
  requested_at: Date
  approved_at?: Date
  completed_at?: Date
  created_at: Date
  updated_at: Date
}

export interface TransferItem {
  id: string
  transfer_id: string
  product_id: string
  variation_id?: string
  quantity: number
  created_at: Date
}

export interface CreateTransferData {
  from_branch_id: string
  to_branch_id: string
  requested_by: string
  reason: string
  notes?: string
  items: {
    product_id: string
    variation_id?: string
    quantity: number
  }[]
}

// Budget types
export interface Budget {
  id: string
  branch_id?: string
  category: string
  budget_amount: number
  period_start: Date
  period_end: Date
  description?: string
  created_by: string
  created_at: Date
  updated_at: Date
}

// Expense types
export interface Expense {
  id: string
  branch_id?: string
  category: string
  amount: number
  description?: string
  expense_date: Date
  receipt_url?: string
  created_by: string
  created_at: Date
  updated_at: Date
}

// Alert types
export interface Alert {
  id: string
  type: "inventory" | "performance" | "budget" | "system"
  severity: "low" | "medium" | "high" | "critical"
  title: string
  message: string
  branch_id?: string
  category?: string
  threshold_value?: number
  current_value?: number
  status: "active" | "acknowledged" | "resolved" | "dismissed"
  action_required: boolean
  notes?: string
  acknowledged_at?: Date
  resolved_at?: Date
  created_at: Date
  updated_at: Date
}

// Dashboard types
export interface DashboardStats {
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

export interface RecentActivity {
  activity_type: string
  description: string
  branch_name: string
  user_name: string
  created_at: Date
  reference_id: string
}

// API Response types
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

// Pagination types
export interface PaginationParams {
  page?: number
  limit?: number
  search?: string
  sort_by?: string
  sort_order?: "asc" | "desc"
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    total_pages: number
    has_next: boolean
    has_prev: boolean
  }
}

// Filter types
export interface ProductFilters {
  category_id?: string
  branch_id?: string
  size?: string
  color?: string
  gender?: string
  price_min?: number
  price_max?: number
  in_stock_only?: boolean
}

export interface SalesFilters {
  branch_id?: string
  user_id?: string
  payment_method?: string
  date_from?: Date
  date_to?: Date
  customer_name?: string
}

// Report types
export interface SalesReport {
  period_label: string
  branch_id: string
  branch_name: string
  total_sales: number
  transaction_count: number
  avg_transaction: number
}

export interface ExpenseReport {
  category: string
  branch_id?: string
  branch_name: string
  total_amount: number
  expense_count: number
}

export interface InventoryReport {
  product_id: string
  product_name: string
  sku: string
  category_name: string
  total_stock: number
  total_value: number
  branches: {
    branch_id: string
    branch_name: string
    quantity: number
    stock_status: string
  }[]
}

// Activity log types
export interface Activity {
  id: string
  type: 'sell' | 'stock_add' | 'stock_reduce' | 'product_create' | 'product_update' | 'expense_add' | 'transfer' | 'refund' | 'restore' | 'edit_correction'
  title?: string
  description?: string
  status: 'completed' | 'reversed'
  branch_id?: string
  user_id?: string
  related_entity_type?: string
  related_entity_id?: string
  delta?: any
  metadata?: any
  parent_activity_id?: string
  created_at: Date
}
