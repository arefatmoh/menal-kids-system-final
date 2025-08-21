"use client"

import type React from "react"
import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { 
  Plus, 
  Minus, 
  Package, 
  TrendingUp, 
  TrendingDown, 
  Calendar, 
  Loader2,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Filter,
  Search,
  RefreshCw,
  Download,
  Upload,
  Settings,
  Eye,
  EyeOff,
  Target,
  Zap,
  BarChart3,
  Clock,
  AlertCircle,
  CheckSquare,
  Square,
  ChevronDown,
  ChevronUp,
  MoreHorizontal,
  Trash2,
  Edit,
  Copy,
  FileText,
  Users,
  DollarSign,
  ShoppingCart,
  Truck,
  Warehouse,
  Activity,
  PieChart,
  Phone,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon
} from "lucide-react"
import apiClient from "@/lib/api-client"
import { useToast } from "@/hooks/use-toast"
import { useBranch } from "@/lib/branch-context"
import { useLanguage } from "@/lib/language-context"

interface StockMovement {
  id: string
  product_name: string
  sku: string
  movement_type: "in" | "out"
  quantity: number
  reason: string
  user_name: string
  created_at: string
  branch_id: string
  branch_name: string
}

interface Product {
  id: string
  name: string
  sku: string
  current_stock: number
  category_name: string
  price: number
  min_stock_level: number
  max_stock_level: number
  branch_id: string
  branch_name: string
  stock_status: string
  product_type?: string
  variations?: Array<{
    id: string
    variation_id: string
    variation_sku: string
    color?: string
    size?: string
    price?: number
    quantity: number
  }>
}

interface StockAlert {
  id: string
  product_id?: string
  product_name?: string
  sku?: string
  current_stock?: number
  min_stock_level?: number
  alert_type?: "low_stock" | "out_of_stock" | "overstock"
  branch_id?: string
  branch_name?: string
  severity?: string
  title?: string
  message?: string
  status?: string
  created_at?: string
  category?: string
}

interface StockStats {
  total_products: number
  low_stock_items: number
  out_of_stock_items: number
  overstock_items: number
  total_value: number
  recent_movements: number
  alerts_count: number
}

export default function StockManagementPage() {
  // Basic state
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [activeTab, setActiveTab] = useState("overview")
  const [selectedBranch] = useState("all")
  
  // Data state
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [stockAlerts, setStockAlerts] = useState<StockAlert[]>([])
  const [stats, setStats] = useState<StockStats>({
    total_products: 0,
    low_stock_items: 0,
    out_of_stock_items: 0,
    overstock_items: 0,
    total_value: 0,
    recent_movements: 0,
    alerts_count: 0
  })

  // Form state
  const [selectedProduct, setSelectedProduct] = useState("")
  const [selectedVariation, setSelectedVariation] = useState("")
  const [movementType, setMovementType] = useState("")
  const [quantity, setQuantity] = useState("")
  const [reason, setReason] = useState("")
  const [date, setDate] = useState(new Date().toISOString().split("T")[0])

  // Quick adjust dialogs
  const [quickAdjustOpen, setQuickAdjustOpen] = useState(false)
  const [quickAdjustMode, setQuickAdjustMode] = useState<'add' | 'reduce'>('add')
  const [quickAdjustProduct, setQuickAdjustProduct] = useState<Product | null>(null)
  const [quickAdjustQty, setQuickAdjustQty] = useState("1")
  const [variationAdjustOpen, setVariationAdjustOpen] = useState(false)
  const [variationAdjustMode, setVariationAdjustMode] = useState<'add' | 'reduce'>('add')
  const [variationQuantities, setVariationQuantities] = useState<Record<string, string>>({})
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([])
  const [dialogBranch, setDialogBranch] = useState("")

  // Bulk operations state
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set())
  const [bulkQuantity, setBulkQuantity] = useState("")
  const [bulkReason, setBulkReason] = useState("")
  const [bulkMovementType, setBulkMovementType] = useState("")

  // Search and filter state
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [selectedStatus, setSelectedStatus] = useState("all")
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(12) // Show 12 items per page for grid view
  
  // History pagination
  const [historyPage, setHistoryPage] = useState(1)
  const historyPageSize = 10

  // Derived alert counts for summary (works with API alerts and local fallback)
  const alertCounts = useMemo(() => {
    return stockAlerts.reduce(
      (acc, a) => {
        const t = a.alert_type || (a.severity === 'critical' ? 'out_of_stock' : a.severity === 'high' ? 'low_stock' : 'overstock')
        if (t === 'out_of_stock') acc.out_of_stock += 1
        else if (t === 'low_stock') acc.low_stock += 1
        else acc.overstock += 1
        return acc
      },
      { out_of_stock: 0, low_stock: 0, overstock: 0 }
    )
  }, [stockAlerts])

  // UI state
  const [showAlerts, setShowAlerts] = useState(true)
  const [showBulkForm, setShowBulkForm] = useState(false)
  const [notificationSettings, setNotificationSettings] = useState({
    lowStockThreshold: 5,
    outOfStockAlerts: true,
    overstockAlerts: true,
    emailNotifications: false,
    soundAlerts: true
  })
  const [quickActions, setQuickActions] = useState({
    showQuickAdd: false,
    showQuickReduce: false,
    showQuickTransfer: false
  })
  const [uiPreferences, setUiPreferences] = useState({
    compactMode: false,
    showAnimations: true,
    autoRefresh: true,
    darkMode: false,
    showTooltips: true
  })
  const [loadingStates, setLoadingStates] = useState({
    isRefreshing: false,
    isUpdating: false,
    isProcessing: false
  })
  const [feedback, setFeedback] = useState({
    showSuccessMessage: false,
    showErrorMessage: false,
    message: "",
    type: "success" as "success" | "error" | "warning" | "info"
  })

  const { currentBranch } = useBranch()
  const { toast } = useToast()
  const { t } = useLanguage()

  // Check role and branch
  const userRole = typeof window !== 'undefined' ? localStorage.getItem("userRole") : null
  const isOwner = userRole === "owner"

  // Enhanced feedback system
  const showFeedback = (message: string, type: "success" | "error" | "warning" | "info") => {
    setFeedback({
      showSuccessMessage: type === "success",
      showErrorMessage: type === "error",
      message,
      type
    })
    
    // Auto-hide feedback after 3 seconds
    setTimeout(() => {
      setFeedback(prev => ({
        ...prev,
        showSuccessMessage: false,
        showErrorMessage: false
      }))
    }, 3000)
  }

  // Enhanced loading states
  const setLoadingState = (state: keyof typeof loadingStates, value: boolean) => {
    setLoadingStates(prev => ({
      ...prev,
      [state]: value
    }))
  }

  // UI preference handlers
  const updateUiPreference = (key: keyof typeof uiPreferences, value: any) => {
    setUiPreferences(prev => ({
      ...prev,
      [key]: value
    }))
    
    showFeedback(`${key} updated`, "success")
  }

  useEffect(() => {
    fetchData()
    setupSmartAlerts()
  }, [currentBranch])

  // Recompute stats and refresh alerts whenever data changes
  useEffect(() => {
    if (products.length > 0 || stockMovements.length > 0) {
      calculateStats()
    }
  }, [products, stockMovements])

  useEffect(() => {
    if (products.length > 0) {
      fetchStockAlerts()
    }
  }, [products, currentBranch])

  // Keyboard shortcuts with enhanced feedback
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey) {
        switch (event.key) {
          case 'a':
            event.preventDefault()
            handleSelectAll(selectedProducts.size !== products.length)
            showFeedback("Selection toggled", "info")
            break
          case 'r':
            event.preventDefault()
            setLoadingState('isRefreshing', true)
            fetchData().finally(() => setLoadingState('isRefreshing', false))
            showFeedback("Data refreshed", "success")
            break
          case 's':
            event.preventDefault()
            showFeedback("Settings saved", "success")
            break
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedProducts.size, products.length])

  const fetchData = async () => {
    setIsLoading(true)
    try {
      // Fetch data in sequence to ensure proper dependencies
      await fetchStockMovements()
      await fetchProducts() // This will trigger calculateStats and fetchStockAlerts via useEffect
    } catch (error) {
      console.error("Error fetching data:", error)
      toast({
        title: "Error",
        description: "Failed to load stock data",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const fetchStockMovements = async () => {
    try {
      const params: any = {
        page: 1,
        limit: 50,
      }

      if (currentBranch && currentBranch !== "all") {
        params.branch_id = currentBranch
      }

      const response = await apiClient.getStockMovements(params)
      if (response.success) {
        const rows = Array.isArray(response.data)
          ? response.data
          : ((response as any).data?.data || [])
        setStockMovements(rows as unknown as StockMovement[])
      }
    } catch (error) {
      console.error("Stock movements fetch error:", error)
    }
  }

  const fetchProducts = async () => {
    try {
      const params: any = {
        page: 1,
        limit: 5000,
      }

      if (currentBranch && currentBranch !== "all") {
        params.branch_id = currentBranch
      } else {
        params.cross_branch = true
      }

      // Load branches for dialog branch select
      try {
        const br = await apiClient.getBranches()
        if (br.success && Array.isArray(br.data)) {
          setBranches(br.data as any)
        }
      } catch {}

      // Use inventory endpoint to get variation-aware stock
      const response = await apiClient.getInventory(params)

      if (response.success && Array.isArray(response.data)) {
        const rows = response.data as any[]
        const grouped: Map<string, Product> = new Map()

        for (const row of rows) {
          const productId = row.product_id
          const existing = grouped.get(productId)
          const variationObj = {
            id: row.variation_id || row.product_id,
            variation_id: row.variation_id || "",
            variation_sku: row.variation_sku || row.product_sku || row.sku || "",
            color: row.color || undefined,
            size: row.size || undefined,
            price: row.price ?? undefined,
            quantity: row.quantity ?? 0,
          }

          if (!existing) {
            const minLevel = typeof row.min_stock_level === 'number' ? row.min_stock_level : 0
            const maxLevel = typeof row.max_stock_level === 'number' ? row.max_stock_level : 0
            grouped.set(productId, {
              id: productId,
              name: row.product_name,
              sku: row.product_sku || row.sku,
              current_stock: row.quantity ?? 0,
              category_name: row.category_name,
              price: row.price || 0,
              min_stock_level: minLevel,
              max_stock_level: maxLevel,
              branch_id: row.branch_id,
              branch_name: row.branch_name,
              stock_status: row.stock_status || getStockStatusFromData(row.quantity ?? 0, minLevel, maxLevel),
              product_type: row.product_type,
              variations: row.variation_id ? [variationObj] : [],
            })
          } else {
            existing.current_stock += row.quantity ?? 0
            // Track min/max levels across variations conservatively
            if (typeof row.min_stock_level === 'number') {
              existing.min_stock_level = existing.min_stock_level === 0 ? row.min_stock_level : Math.min(existing.min_stock_level, row.min_stock_level)
            }
            if (typeof row.max_stock_level === 'number') {
              existing.max_stock_level = Math.max(existing.max_stock_level, row.max_stock_level || 0)
            }
            if (row.variation_id) {
              existing.variations = existing.variations || []
              existing.variations.push(variationObj)
            }
          }
        }

        const transformedProducts = Array.from(grouped.values())
        setProducts(transformedProducts)

        // Update stats after fetching products
        calculateStats()

        // Removed generic refresh toast so only add/reduce toasts are shown
      }
    } catch (error) {
      console.error("Products fetch error:", error)
      toast({
        title: "Error",
        description: "Failed to load product data",
        variant: "destructive",
      })
    }
  }

  const fetchStockAlerts = async () => {
    try {
      const params: any = { status: 'active' }
      if (currentBranch && currentBranch !== 'all') {
        params.branch_id = currentBranch
      }
      const query = new URLSearchParams(params).toString()
      const res = await fetch(`/api/alerts?${query}`, { headers: { 'Content-Type': 'application/json' } })
      const data = await res.json()
      if (res.ok && data.success && Array.isArray(data.data)) {
        setStockAlerts(data.data as StockAlert[])
      }
    } catch (error) {
      console.error("Stock alerts fetch error:", error)
    }
  }

  const calculateStats = () => {
    const totalProducts = products.length
    const totalStocks = products.reduce((sum, p) => sum + (p.current_stock || 0), 0)
    const lowStockItems = products.filter(p => p.current_stock > 0 && p.min_stock_level > 0 && p.current_stock <= p.min_stock_level).length
    const outOfStockItems = products.filter(p => p.current_stock === 0).length
    const overstockItems = products.filter(p => p.max_stock_level > 0 && p.current_stock > p.max_stock_level).length
    const totalValue = products.reduce((sum, p) => sum + (p.current_stock * (p.price || 0)), 0)
    const recentMovements = stockMovements.filter(m => {
      const movementDate = new Date(m.created_at)
      const oneWeekAgo = new Date()
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)
      return movementDate >= oneWeekAgo
    }).length

    setStats({
      total_products: totalStocks, // Changed to show total stock quantity instead of product count
      low_stock_items: lowStockItems,
      out_of_stock_items: outOfStockItems,
      overstock_items: overstockItems,
      total_value: totalValue,
      recent_movements: recentMovements,
      alerts_count: stockAlerts.length
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!selectedProduct || !movementType || !quantity || !reason) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)

    try {
      const movementData: any = {
        product_id: selectedProduct,
        branch_id: selectedBranch === "all" ? currentBranch : selectedBranch,
        movement_type: movementType as "in" | "out",
        quantity: Number.parseInt(quantity),
        reason,
      }
      if (selectedVariation) {
        movementData.variation_id = selectedVariation
      }

      const response = await apiClient.createStockMovement(movementData)
      
      if (response.success) {
        // Scroll to top so toast is visible
        if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
        const prod = products.find(p => p.id === selectedProduct)
        const vLabel = selectedVariation ? (() => {
          const v = prod?.variations?.find(x => (x.variation_id || x.id) === selectedVariation)
          const parts = [v?.color, v?.size].filter(Boolean)
          return parts.length > 0 ? ` (${parts.join(' - ')})` : ''
        })() : ''
        toast({
          title: movementType === "in" ? "Stock Added" : "Stock Reduced",
          description: (
            <span>
              <strong>{Number(quantity)}</strong> unit{Number(quantity) === 1 ? "" : "s"} {movementType === "in" ? "added to" : "deducted from"} <strong>{prod?.name || "product"}</strong>{vLabel}
            </span>
          ) as unknown as string,
          variant: "success" as any,
        })
        
        // Reset form
        setSelectedProduct("")
        setMovementType("")
        setQuantity("")
        setReason("")
        setDate(new Date().toISOString().split("T")[0])
        setSelectedVariation("")
        
        // Refresh data to reflect inventory changes
        await Promise.all([
          fetchData(),
          fetchStockMovements()
        ])
      } else {
        toast({
          title: "Error",
          description: response.error || "Failed to create stock movement",
          variant: "destructive",
        })
      }
    } catch (error: any) {
      console.error("Stock movement error:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to create stock movement",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (selectedProducts.size === 0 || !bulkMovementType || !bulkQuantity || !bulkReason) {
      toast({
        title: "Error",
        description: "Please select products and fill in all required fields",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)

    try {
      const promises = Array.from(selectedProducts).map(productId => {
        const product = products.find(p => p.id === productId)
        const movementData: any = {
          product_id: productId,
          branch_id: selectedBranch === "all" ? currentBranch : selectedBranch,
          movement_type: bulkMovementType as "in" | "out",
          quantity: Number.parseInt(bulkQuantity),
          reason: bulkReason,
        }
        // If the product has exactly one variation, auto-include its variation_id
        if (product && product.variations && product.variations.length === 1) {
          movementData.variation_id = product.variations[0].variation_id
        }
        return apiClient.createStockMovement(movementData)
      })

      const results = await Promise.all(promises)
      const successCount = results.filter(r => r.success).length

      if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
      toast({
        title: bulkMovementType === 'in' ? "Stock Added" : "Stock Reduced",
        description: (
          <span>
            <strong>{Number(bulkQuantity)}</strong> each for <strong>{successCount}</strong>/<strong>{selectedProducts.size}</strong> products
          </span>
        ) as unknown as string,
        variant: "success" as any,
      })
      
      // Reset bulk form
      setSelectedProducts(new Set())
      setBulkQuantity("")
      setBulkReason("")
      setBulkMovementType("")
      setShowBulkForm(false)
      
      // Refresh data to reflect inventory changes
      await Promise.all([
        fetchData(),
        fetchStockMovements()
      ])
    } catch (error: any) {
      console.error("Bulk stock movement error:", error)
      toast({
        title: "Error",
        description: "Failed to process bulk stock movements",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedProducts(new Set(products.map(p => p.id)))
    } else {
      setSelectedProducts(new Set())
    }
  }

  const handleSelectProduct = (productId: string, checked: boolean) => {
    const newSelected = new Set(selectedProducts)
    if (checked) {
      newSelected.add(productId)
    } else {
      newSelected.delete(productId)
    }
    setSelectedProducts(newSelected)
  }

  const getStockStatusFromData = (stock: number, minStock: number, maxStock: number) => {
    if (stock === 0) return "out_of_stock"
    if (minStock > 0 && stock <= minStock) return "low_stock"
    if (maxStock > 0 && stock > maxStock) return "overstock"
    return "normal"
  }

  const getStockStatus = (stock: number, minStock: number, maxStock: number) => {
    if (stock === 0) return { status: "Out of Stock", color: "destructive", icon: XCircle }
    if (minStock > 0 && stock <= minStock) return { status: "Low Stock", color: "secondary", icon: AlertTriangle }
    if (maxStock > 0 && stock > maxStock) return { status: "Overstock", color: "default", icon: AlertCircle }
    return { status: "In Stock", color: "default", icon: CheckCircle }
  }

  const filteredProducts = useMemo(() => {
    let filtered = products

    // Filter by search term
    if (searchTerm.trim()) {
      filtered = filtered.filter(product =>
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.category_name.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Filter by category
    if (selectedCategory !== "all") {
      filtered = filtered.filter(product => product.category_name === selectedCategory)
    }

    // Filter by status
    if (selectedStatus !== "all") {
      filtered = filtered.filter(product => {
        const status = getStockStatus(product.current_stock, product.min_stock_level, product.max_stock_level)
        return status.status.toLowerCase().replace(" ", "_") === selectedStatus
      })
    }

    return filtered
  }, [products, searchTerm, selectedCategory, selectedStatus])

  // Paginated products
  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize
    const endIndex = startIndex + pageSize
    return filteredProducts.slice(startIndex, endIndex)
  }, [filteredProducts, currentPage, pageSize])

  // Pagination info
  const totalPages = Math.ceil(filteredProducts.length / pageSize)
  const hasNextPage = currentPage < totalPages
  const hasPrevPage = currentPage > 1

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, selectedCategory, selectedStatus])

  const categories = useMemo(() => {
    return Array.from(new Set(products.map(p => p.category_name)))
  }, [products])

  // Smart Alerts Setup
  const setupSmartAlerts = () => {
    // Check for critical stock levels every 30 seconds
    const interval = setInterval(() => {
      const criticalItems = products.filter(p => 
        p.current_stock === 0 || 
        p.current_stock <= notificationSettings.lowStockThreshold
      )
      
      if (criticalItems.length > 0 && notificationSettings.soundAlerts) {
        // Play alert sound (if browser supports it)
        try {
          const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU7k9n1unEiBC13yO/eizEIHWq+8+OWT')
          audio.play().catch(() => {}) // Ignore errors if audio fails
        } catch (e) {
          // Ignore audio errors
        }
      }
    }, 30000)

    return () => clearInterval(interval)
  }

  // Quick Actions
  const handleQuickAction = async (action: 'add' | 'reduce' | 'transfer', productId: string, quantity: number = 1) => {
    setIsSubmitting(true)
    
    try {
      const product = products.find(p => p.id === productId)
      const movementData: any = {
        product_id: productId,
        branch_id: selectedBranch === "all" ? currentBranch : selectedBranch,
        movement_type: action === 'add' ? "in" : "out",
        quantity: quantity,
        reason: `Quick ${action} action`,
      }
      if (product && product.variations && product.variations.length === 1) {
        movementData.variation_id = product.variations[0].variation_id
      }

      // If user clicked quick icon, instead open nicer dialogs instead of default quantity=1
      if (action === 'transfer') {
        toast({ title: 'Quick Transfer', description: 'Use the Transfer page to move between branches' })
        setIsSubmitting(false)
        return
      }

      const openVariationAdjust = (prod: Product, mode: 'add' | 'reduce') => {
        setQuickAdjustProduct(prod)
        setVariationAdjustMode(mode)
        const initial: Record<string, string> = {}
        ;(prod.variations || []).forEach(v => {
          const key = v.variation_id || v.id
          initial[key] = ""
        })
        setVariationQuantities(initial)
        setVariationAdjustOpen(true)
      }

      const openQuickAdjust = (prod: Product, mode: 'add' | 'reduce') => {
        setQuickAdjustProduct(prod)
        setQuickAdjustMode(mode)
        setQuickAdjustQty("1")
        setQuickAdjustOpen(true)
      }

      if (product && product.variations && product.variations.length > 0) {
        setIsSubmitting(false)
        openVariationAdjust(product, action)
        return
      }

      if (product && (!product.variations || product.variations.length === 0)) {
        setIsSubmitting(false)
        openQuickAdjust(product, action)
        return
      }

      const response = await apiClient.createStockMovement(movementData)
      
      if (response.success) {
        toast({
          title: "Quick Action Success",
          description: `Stock ${action === 'add' ? 'added' : 'reduced'} successfully!`,
        })
        
        // Refresh data to reflect inventory changes
        await Promise.all([
          fetchData(),
          fetchStockMovements()
        ])
      } else {
        toast({
          title: "Error",
          description: response.error || "Failed to perform quick action",
          variant: "destructive",
        })
      }
    } catch (error: any) {
      console.error("Quick action error:", error)
      toast({
        title: "Error",
        description: "Failed to perform quick action",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Smart Alert Management
  const updateNotificationSettings = (setting: string, value: any) => {
    setNotificationSettings(prev => ({
      ...prev,
      [setting]: value
    }))
    
    toast({
      title: "Settings Updated",
      description: "Notification settings have been updated",
    })
  }

  // Enhanced Stock Categories
  const getStockCategory = (product: Product) => {
    if (product.current_stock === 0) return "Critical"
    if (product.min_stock_level > 0 && product.current_stock <= product.min_stock_level) return "Low"
    if (product.max_stock_level > 0 && product.current_stock > product.max_stock_level) return "Overstock"
    if (product.min_stock_level > 0 && product.current_stock <= product.min_stock_level * 2) return "Warning"
    return "Healthy"
  }

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "Critical": return "red"
      case "Low": return "yellow"
      case "Warning": return "orange"
      case "Overstock": return "purple"
      case "Healthy": return "green"
      default: return "gray"
    }
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "Critical": return XCircle
      case "Low": return AlertTriangle
      case "Warning": return AlertCircle
      case "Overstock": return Package
      case "Healthy": return CheckCircle
      default: return Package
    }
  }

  // Employees are allowed; restrict some visibility via isOwner flags below

  return (
    <div className="space-y-6">
      {/* Enhanced Header with Mobile Responsiveness */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between space-y-4 sm:space-y-0">
        <div className="space-y-2">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-gradient-to-r from-pink-500 to-purple-500 rounded-xl flex items-center justify-center">
              <Package className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Stock Management</h1>
              <p className="text-sm sm:text-base text-gray-600">Comprehensive inventory control and monitoring</p>
              <p className="text-xs text-blue-600 mt-1">Integrated with Inventory System • Real-time stock tracking</p>
            </div>
          </div>
        </div>
        
        {/* Enhanced Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* UI Preferences Toggle */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => updateUiPreference('compactMode', !uiPreferences.compactMode)}
            className="hidden sm:flex"
          >
            {uiPreferences.compactMode ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
            {uiPreferences.compactMode ? 'Compact' : 'Normal'}
          </Button>
          
          {/* Auto Refresh Toggle */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => updateUiPreference('autoRefresh', !uiPreferences.autoRefresh)}
            className="hidden sm:flex"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${uiPreferences.autoRefresh ? 'animate-spin' : ''}`} />
            Auto
          </Button>
          
          {/* Refresh Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setLoadingState('isRefreshing', true)
              fetchData().finally(() => setLoadingState('isRefreshing', false))
            }}
            disabled={isLoading || loadingStates.isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${(isLoading || loadingStates.isRefreshing) ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          

        </div>
      </div>

      {/* Enhanced Feedback System */}
      {feedback.showSuccessMessage && (
        <div className={`p-4 rounded-lg border-l-4 ${
          feedback.type === 'success' ? 'bg-green-50 border-green-400 text-green-800' :
          feedback.type === 'error' ? 'bg-red-50 border-red-400 text-red-800' :
          feedback.type === 'warning' ? 'bg-yellow-50 border-yellow-400 text-yellow-800' :
          'bg-blue-50 border-blue-400 text-blue-800'
        }`}>
          <div className="flex items-center space-x-2">
            {feedback.type === 'success' ? <CheckCircle className="h-5 w-5" /> :
             feedback.type === 'error' ? <XCircle className="h-5 w-5" /> :
             feedback.type === 'warning' ? <AlertTriangle className="h-5 w-5" /> :
             <AlertCircle className="h-5 w-5" />}
            <span className="font-medium">{feedback.message}</span>
          </div>
        </div>
      )}

      {/* Stock Alerts */}
      {showAlerts && stockAlerts.length > 0 && (
        <Alert className="border-orange-200 bg-orange-50">
          <AlertTriangle className="h-4 w-4 text-orange-600" />
          <AlertDescription className="text-orange-800">
            <strong>{stockAlerts.length} stock alerts</strong> require attention. 
            <Button
              variant="link"
              className="p-0 h-auto text-orange-800 underline ml-1"
              onClick={() => setActiveTab("alerts")}
            >
              View alerts
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Enhanced Stats Cards with Mobile Responsiveness */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className={`border-0 shadow-lg bg-gradient-to-br from-blue-50 to-blue-100 transition-all duration-300 hover:shadow-xl hover:scale-105 ${
          uiPreferences.compactMode ? 'p-3' : 'p-4'
        }`}>
          <CardContent className={uiPreferences.compactMode ? 'p-2' : 'p-4'}>
            <div className="flex items-center space-x-3">
              <div className={`${uiPreferences.compactMode ? 'w-8 h-8' : 'w-10 h-10'} bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg flex items-center justify-center transition-all duration-200 hover:scale-110`}>
                <Package className={`${uiPreferences.compactMode ? 'h-4 w-4' : 'h-5 w-5'} text-white`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`${uiPreferences.compactMode ? 'text-xs' : 'text-sm'} font-medium text-blue-700 truncate`}>Total Stocks</p>
                <p className={`${uiPreferences.compactMode ? 'text-xl' : 'text-2xl'} font-bold text-blue-900`}>{stats.total_products}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={`border-0 shadow-lg bg-gradient-to-br from-red-50 to-red-100 transition-all duration-300 hover:shadow-xl hover:scale-105 ${
          uiPreferences.compactMode ? 'p-3' : 'p-4'
        }`}>
          <CardContent className={uiPreferences.compactMode ? 'p-2' : 'p-4'}>
            <div className="flex items-center space-x-3">
              <div className={`${uiPreferences.compactMode ? 'w-8 h-8' : 'w-10 h-10'} bg-gradient-to-r from-red-500 to-red-600 rounded-lg flex items-center justify-center transition-all duration-200 hover:scale-110`}>
                <XCircle className={`${uiPreferences.compactMode ? 'h-4 w-4' : 'h-5 w-5'} text-white`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`${uiPreferences.compactMode ? 'text-xs' : 'text-sm'} font-medium text-red-700 truncate`}>Out of Stock</p>
                <p className={`${uiPreferences.compactMode ? 'text-xl' : 'text-2xl'} font-bold text-red-900`}>{stats.out_of_stock_items}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={`border-0 shadow-lg bg-gradient-to-br from-yellow-50 to-yellow-100 transition-all duration-300 hover:shadow-xl hover:scale-105 ${
          uiPreferences.compactMode ? 'p-3' : 'p-4'
        }`}>
          <CardContent className={uiPreferences.compactMode ? 'p-2' : 'p-4'}>
            <div className="flex items-center space-x-3">
              <div className={`${uiPreferences.compactMode ? 'w-8 h-8' : 'w-10 h-10'} bg-gradient-to-r from-yellow-500 to-yellow-600 rounded-lg flex items-center justify-center transition-all duration-200 hover:scale-110`}>
                <AlertTriangle className={`${uiPreferences.compactMode ? 'h-4 w-4' : 'h-5 w-5'} text-white`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`${uiPreferences.compactMode ? 'text-xs' : 'text-sm'} font-medium text-yellow-700 truncate`}>Low Stock</p>
                <p className={`${uiPreferences.compactMode ? 'text-xl' : 'text-2xl'} font-bold text-yellow-900`}>{stats.low_stock_items}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {isOwner && (
          <Card className={`border-0 shadow-lg bg-gradient-to-br from-green-50 to-green-100 transition-all duration-300 hover:shadow-xl hover:scale-105 ${
            uiPreferences.compactMode ? 'p-3' : 'p-4'
          }`}>
            <CardContent className={uiPreferences.compactMode ? 'p-2' : 'p-4'}>
              <div className="flex items-center space-x-3">
                <div className={`${uiPreferences.compactMode ? 'w-8 h-8' : 'w-10 h-10'} bg-gradient-to-r from-green-500 to-green-600 rounded-lg flex items-center justify-center transition-all duration-200 hover:scale-110`}>
                  <DollarSign className={`${uiPreferences.compactMode ? 'h-4 w-4' : 'h-5 w-5'} text-white`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`${uiPreferences.compactMode ? 'text-xs' : 'text-sm'} font-medium text-green-700 truncate`}>Total Value</p>
                  <p className={`${uiPreferences.compactMode ? 'text-xl' : 'text-2xl'} font-bold text-green-900`}>{stats.total_value.toFixed(0)} ብር</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="operations">Operations</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="analytics">Inventory Analytics</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 gap-6">
            {/* Stock Overview */}
            <div>
              <Card className="border-0 shadow-xl">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Package className="h-5 w-5 text-pink-500" />
                    <span>Stock Overview</span>
                  </CardTitle>
                  <CardDescription>Current inventory levels across all branches</CardDescription>
                </CardHeader>
                <CardContent>
                  {/* Filters */}
                  <div className="flex items-center space-x-4 mb-4">
                    <div className="flex-1">
                      <Input
                        placeholder="Search products..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="max-w-sm"
                      />
                    </div>
                    <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="Category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Categories</SelectItem>
                        {categories.map(category => (
                          <SelectItem key={category} value={category}>{category}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="in_stock">In Stock</SelectItem>
                        <SelectItem value="low_stock">Low Stock</SelectItem>
                        <SelectItem value="out_of_stock">Out of Stock</SelectItem>
                        <SelectItem value="overstock">Overstock</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-600">Show:</span>
                      <Select value={pageSize.toString()} onValueChange={(value) => {
                        setPageSize(Number(value))
                        setCurrentPage(1) // Reset to first page when changing page size
                      }}>
                        <SelectTrigger className="w-20">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="6">6 per page</SelectItem>
                          <SelectItem value="12">12 per page</SelectItem>
                          <SelectItem value="24">24 per page</SelectItem>
                          <SelectItem value="48">48 per page</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                  </div>

                  {/* Products Grid/List with Quick Actions */}
                  {isLoading ? (
                    <div className="flex items-center justify-center h-64">
                      <Loader2 className="h-8 w-8 animate-spin text-pink-500" />
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {paginatedProducts.map((product) => {
                        const stockStatus = getStockStatus(product.current_stock, product.min_stock_level, product.max_stock_level)
                        const StatusIcon = stockStatus.icon
                        const stockCategory = getStockCategory(product)
                        const CategoryIcon = getCategoryIcon(stockCategory)
                        const categoryColor = getCategoryColor(stockCategory)
                        
                        return (
                          <div
                            key={product.id}
                            className={`p-4 border rounded-lg transition-all duration-200 hover:shadow-md cursor-pointer relative group ${
                              stockStatus.status === "Out of Stock" ? 'border-red-200 bg-red-50' :
                              stockStatus.status === "Low Stock" ? 'border-yellow-200 bg-yellow-50' :
                              stockStatus.status === "Overstock" ? 'border-orange-200 bg-orange-50' :
                              'border-gray-200 bg-white'
                            }`}
                          >
                            <div className="flex items-center space-x-3">
                              <StatusIcon className={`h-5 w-5 ${
                                stockStatus.status === "Out of Stock" ? 'text-red-500' :
                                stockStatus.status === "Low Stock" ? 'text-yellow-500' :
                                stockStatus.status === "Overstock" ? 'text-orange-500' :
                                'text-green-500'
                              }`} />
                              <div className="flex-1 min-w-0">
                                <h3 className="font-medium text-gray-900 truncate">{product.name}</h3>
                                <p className="text-sm text-gray-500">SKU: {product.sku}</p>
                                <p className="text-sm text-gray-500">{product.branch_name}</p>
                                <div className="flex items-center space-x-2 mt-1">
                                  <CategoryIcon className={`h-3 w-3 text-${categoryColor}-500`} />
                                  <Badge variant="outline" className={`text-xs border-${categoryColor}-200 text-${categoryColor}-700`}>
                                    {stockCategory}
                                  </Badge>
                                </div>
                                {product.variations && product.variations.length > 0 && (
                                  <div className="mt-2 flex flex-wrap gap-1">
                                    {product.variations.slice(0, 5).map((v) => {
                                      const labelParts = [v.color, v.size].filter(Boolean)
                                      const label = labelParts.length > 0 ? labelParts.join(" - ") : (v.variation_sku || "Variation")
                                      return (
                                        <Badge key={(v.variation_id || v.id) + label} variant="secondary" className="text-[10px] py-0.5 px-1">
                                          {label}{typeof v.quantity === 'number' ? ` • ${v.quantity}` : ''}
                                        </Badge>
                                      )
                                    })}
                                    {product.variations.length > 5 && (
                                      <Badge variant="outline" className="text-[10px] py-0.5 px-1">+{product.variations.length - 5} more</Badge>
                                    )}
                                  </div>
                                )}
                              </div>
                              <div className="text-right">
                                <p className="font-bold text-lg text-gray-900">{product.current_stock}</p>
                                <Badge variant={stockStatus.color as any} className="text-xs">
                                  {stockStatus.status}
                                </Badge>
                              </div>
                            </div>

                            {/* Quick Actions Overlay - Only show on hover */}
                            {(
                              <div className="absolute inset-0 bg-black bg-opacity-50 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center space-x-2">
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  className="bg-green-500 hover:bg-green-600 text-white"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleQuickAction('add', product.id, 1)
                                  }}
                                  disabled={isSubmitting}
                                >
                                  <Plus className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  className="bg-red-500 hover:bg-red-600 text-white"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleQuickAction('reduce', product.id, 1)
                                  }}
                                  disabled={isSubmitting}
                                >
                                  <Minus className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  className="bg-blue-500 hover:bg-blue-600 text-white"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    // Go to transfer page with preselected product
                                    const url = new URL(window.location.origin + '/dashboard/transfer')
                                    url.searchParams.set('product_id', product.id)
                                    window.location.href = url.toString()
                                  }}
                                  disabled={isSubmitting}
                                >
                                  <Truck className="h-3 w-3" />
                                </Button>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {filteredProducts.length === 0 && !isLoading && (
                    <div className="text-center py-12">
                      <Package className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">No products found</h3>
                      <p className="text-gray-500">
                        {products.length === 0 
                          ? "No products available. Add products from the Add Product page."
                          : "Try adjusting your filters or search terms"
                        }
                      </p>
                      {products.length === 0 && (
                        <Button 
                          className="mt-4"
                          onClick={() => window.location.href = '/dashboard/add-product'}
                        >
                          <Package className="h-4 w-4 mr-2" />
                          Add Products
                        </Button>
                      )}
                    </div>
                  )}

                  {/* Pagination Controls */}
                  {filteredProducts.length > 0 && !isLoading && (
                    <div className="flex items-center justify-between mt-6">
                      <div className="text-sm text-gray-500">
                        Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, filteredProducts.length)} of {filteredProducts.length} products
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(currentPage - 1)}
                          disabled={!hasPrevPage}
                        >
                          Previous
                        </Button>
                        <div className="flex items-center space-x-1">
                          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                            let pageNum
                            if (totalPages <= 5) {
                              pageNum = i + 1
                            } else if (currentPage <= 3) {
                              pageNum = i + 1
                            } else if (currentPage >= totalPages - 2) {
                              pageNum = totalPages - 4 + i
                            } else {
                              pageNum = currentPage - 2 + i
                            }
                            
                            return (
                              <Button
                                key={pageNum}
                                variant={currentPage === pageNum ? "default" : "outline"}
                                size="sm"
                                onClick={() => setCurrentPage(pageNum)}
                                className="w-8 h-8 p-0"
                              >
                                {pageNum}
                              </Button>
                            )
                          })}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(currentPage + 1)}
                          disabled={!hasNextPage}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

          </div>
        </TabsContent>

        {/* Quick Adjust Dialog - Uniform products */}
        <Dialog open={quickAdjustOpen} onOpenChange={setQuickAdjustOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{quickAdjustMode === 'add' ? 'Add Stock' : 'Reduce Stock'}</DialogTitle>
              <DialogDescription>
                {quickAdjustProduct?.name} ({quickAdjustProduct?.sku})
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <Label>Quantity</Label>
              <Input type="number" min={1} value={quickAdjustQty} onChange={e => setQuickAdjustQty(e.target.value)} />
              {currentBranch === 'all' && (
                <div className="space-y-2">
                  <Label>Branch</Label>
                  <Select value={dialogBranch} onValueChange={setDialogBranch}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select branch" />
                    </SelectTrigger>
                    <SelectContent>
                      {branches.map(b => (
                        <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="secondary" onClick={() => setQuickAdjustOpen(false)}>Cancel</Button>
              <Button onClick={() => {
                const parsedQty = Number.parseInt(quickAdjustQty || '0')
                if (!parsedQty || parsedQty <= 0) {
                  toast({ title: 'Invalid quantity', description: 'Enter a positive number', variant: 'destructive' })
                  return
                }
                if (currentBranch === 'all' && !dialogBranch) {
                  toast({ title: 'Select branch', description: 'Choose a branch to apply this change', variant: 'destructive' })
                  return
                }
                const applyBranch = currentBranch === 'all' ? dialogBranch : currentBranch
                const payload: any = {
                  product_id: quickAdjustProduct!.id,
                  branch_id: applyBranch,
                  movement_type: quickAdjustMode === 'add' ? 'in' : 'out',
                  quantity: parsedQty,
                  reason: `Quick ${quickAdjustMode} action`,
                }
                if (quickAdjustProduct?.variations && quickAdjustProduct.variations.length === 1) {
                  payload.variation_id = quickAdjustProduct.variations[0].variation_id || quickAdjustProduct.variations[0].id
                }
                apiClient.createStockMovement(payload).then(async (resp) => {
                  if (!resp.success) throw new Error(resp.error || 'Failed')
                  await Promise.all([fetchData(), fetchStockMovements()])
                  setQuickAdjustOpen(false)
                  setDialogBranch("")
                  if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
                  toast({
                    title: quickAdjustMode === 'add' ? 'Stock Added' : 'Stock Reduced',
                    description: (
                      <span>
                        <strong>{Number(quickAdjustQty)}</strong> unit{Number(quickAdjustQty) === 1 ? '' : 's'} {quickAdjustMode === 'add' ? 'added to' : 'deducted from'} <strong>{quickAdjustProduct?.name}</strong>
                      </span>
                    ) as unknown as string,
                    variant: "success" as any,
                  })
                }).catch((err: any) => {
                  toast({ title: 'Error', description: err.message || 'Operation failed', variant: 'destructive' })
                })
              }} disabled={isSubmitting} className={quickAdjustMode === 'add' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}>
                {quickAdjustMode === 'add' ? 'Add' : 'Reduce'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Variation Adjust Dialog - Variation products */}
        <Dialog open={variationAdjustOpen} onOpenChange={setVariationAdjustOpen}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>{variationAdjustMode === 'add' ? 'Add Stock for Variations' : 'Reduce Stock for Variations'}</DialogTitle>
              <DialogDescription>
                {quickAdjustProduct?.name} ({quickAdjustProduct?.sku})
              </DialogDescription>
            </DialogHeader>
            {currentBranch === 'all' && (
              <div className="space-y-2 mb-2">
                <Label>Branch</Label>
                <Select value={dialogBranch} onValueChange={setDialogBranch}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select branch" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map(b => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(quickAdjustProduct?.variations || []).map(v => {
                const key = v.variation_id || v.id
                const labelParts = [v.color, v.size].filter(Boolean)
                const label = labelParts.length > 0 ? labelParts.join(' - ') : (v.variation_sku || 'Variation')
                return (
                  <div key={key} className="border rounded-md p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{label}</span>
                      <Badge variant="outline" className="text-xs">Stock: {v.quantity}</Badge>
                    </div>
                    <Input type="number" min={0} placeholder="Qty" value={variationQuantities[key] || ''} onChange={e => setVariationQuantities(prev => ({ ...prev, [key]: e.target.value }))} />
                  </div>
                )
              })}
            </div>
            <DialogFooter>
              <Button variant="secondary" onClick={() => setVariationAdjustOpen(false)}>Cancel</Button>
              <Button onClick={async () => {
                const entries = Object.entries(variationQuantities)
                  .map(([vid, val]) => ({ vid, qty: Number.parseInt(val || '0') }))
                  .filter(e => e.qty > 0)
                if (entries.length === 0) {
                  toast({ title: 'No quantities', description: 'Enter at least one quantity', variant: 'destructive' })
                  return
                }
                if (currentBranch === 'all' && !dialogBranch) {
                  toast({ title: 'Select branch', description: 'Choose a branch to apply this change', variant: 'destructive' })
                  return
                }
                setIsSubmitting(true)
                try {
                  const promises = entries.map(e => apiClient.createStockMovement({
                    product_id: quickAdjustProduct!.id,
                    branch_id: currentBranch === "all" ? dialogBranch : currentBranch,
                    variation_id: e.vid,
                    movement_type: variationAdjustMode === 'add' ? 'in' : 'out',
                    quantity: e.qty,
                    reason: `Quick ${variationAdjustMode} action`,
                  }))
                  const results = await Promise.all(promises)
                  const ok = results.every(r => r.success)
                  if (!ok) throw new Error('Some items failed')
                  await Promise.all([fetchData(), fetchStockMovements()])
                  setVariationAdjustOpen(false)
                  if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
                  const totalQty = entries.reduce((s, e) => s + e.qty, 0)
                  toast({
                    title: variationAdjustMode === 'add' ? 'Stock Added' : 'Stock Reduced',
                    description: (
                      <span>
                        <strong>{totalQty}</strong> unit{totalQty === 1 ? '' : 's'} {variationAdjustMode === 'add' ? 'added to' : 'deducted from'} <strong>{quickAdjustProduct?.name}</strong> (variations)
                      </span>
                    ) as unknown as string,
                    variant: "success" as any,
                  })
                } catch (err: any) {
                  toast({ title: 'Error', description: err.message || 'Operation failed', variant: 'destructive' })
                } finally {
                  setIsSubmitting(false)
                }
              }} disabled={isSubmitting} className={variationAdjustMode === 'add' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}>
                Apply
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Operations Tab */}
        <TabsContent value="operations" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Single Stock Movement */}
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Plus className="h-5 w-5 text-green-500" />
                  <span>Single Stock Movement</span>
                </CardTitle>
                <CardDescription>Add or reduce stock for individual products</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="product">Product</Label>
                      <Select value={selectedProduct} onValueChange={(val) => { setSelectedProduct(val); setSelectedVariation("") }}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a product" />
                        </SelectTrigger>
                        <SelectContent>
                          {products.map((product) => (
                            <SelectItem key={product.id} value={product.id}>
                              {product.name} ({product.sku})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {selectedProduct && (products.find(p => p.id === selectedProduct)?.variations?.length || 0) > 0 && (
                      <div className="space-y-2">
                        <Label htmlFor="variation">Variation</Label>
                        <Select value={selectedVariation} onValueChange={setSelectedVariation}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a variation (size/color)" />
                          </SelectTrigger>
                          <SelectContent>
                            {products.find(p => p.id === selectedProduct)?.variations?.map(v => (
                              <SelectItem key={v.variation_id || v.id} value={v.variation_id || v.id}>
                                {(v.color || "").toString()} {(v.size ? `- ${v.size}` : "")} {v.variation_sku ? `(${v.variation_sku})` : ""} — stock: {v.quantity}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="movement-type">Movement Type</Label>
                      <Select value={movementType} onValueChange={setMovementType}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="in">
                            <div className="flex items-center space-x-2">
                              <TrendingUp className="h-4 w-4 text-green-600" />
                              <span>Stock In</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="out">
                            <div className="flex items-center space-x-2">
                              <TrendingDown className="h-4 w-4 text-red-600" />
                              <span>Stock Out</span>
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="quantity">Quantity</Label>
                      <Input
                        id="quantity"
                        type="number"
                        min="1"
                        placeholder="Enter quantity"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        required
                        disabled={isSubmitting}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="date">Date</Label>
                      <Input
                        id="date"
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        required
                        disabled={isSubmitting}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="reason">Reason</Label>
                    <Textarea
                      id="reason"
                      placeholder="Enter reason for stock movement"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      required
                      disabled={isSubmitting}
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        {movementType === "in" ? (
                          <Plus className="mr-2 h-4 w-4" />
                        ) : (
                          <Minus className="mr-2 h-4 w-4" />
                        )}
                        Add Movement
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Bulk Operations */}
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Zap className="h-5 w-5 text-purple-500" />
                  <span>Bulk Operations</span>
                </CardTitle>
                <CardDescription>Mass stock adjustments for multiple products</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Product Selection */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Select Products</Label>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSelectAll(selectedProducts.size !== products.length)}
                      >
                        {selectedProducts.size === products.length ? 'Deselect All' : 'Select All'}
                      </Button>
                    </div>
                    <div className="max-h-40 overflow-y-auto space-y-2">
                      {products.map((product) => (
                        <div key={product.id} className="flex items-center space-x-2">
                          <Checkbox
                            checked={selectedProducts.has(product.id)}
                            onCheckedChange={(checked) => handleSelectProduct(product.id, checked as boolean)}
                          />
                          <span className="text-sm">{product.name}</span>
                          <Badge variant="outline" className="text-xs">{product.current_stock}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>

                  {selectedProducts.size > 0 && (
                    <form onSubmit={handleBulkSubmit} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Movement Type</Label>
                          <Select value={bulkMovementType} onValueChange={setBulkMovementType}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="in">Stock In</SelectItem>
                              <SelectItem value="out">Stock Out</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label>Quantity</Label>
                          <Input
                            type="number"
                            min="1"
                            placeholder="Enter quantity"
                            value={bulkQuantity}
                            onChange={(e) => setBulkQuantity(e.target.value)}
                            required
                            disabled={isSubmitting}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Reason</Label>
                        <Textarea
                          placeholder="Enter reason for bulk movement"
                          value={bulkReason}
                          onChange={(e) => setBulkReason(e.target.value)}
                          required
                          disabled={isSubmitting}
                        />
                      </div>

                      <Button
                        type="submit"
                        className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white"
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            <Zap className="mr-2 h-4 w-4" />
                            Process {selectedProducts.size} Products
                          </>
                        )}
                      </Button>
                    </form>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Quick Stock Take */}
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Target className="h-5 w-5 text-orange-500" />
                  <span>Quick Stock Take</span>
                </CardTitle>
                <CardDescription>Verify physical inventory counts</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-4 bg-gradient-to-r from-orange-50 to-yellow-50 border border-orange-200 rounded-lg">
                    <div className="flex items-center space-x-2 mb-2">
                      <Target className="h-4 w-4 text-orange-600" />
                      <span className="text-sm font-medium text-orange-800">Stock Count Session</span>
                    </div>
                    <p className="text-xs text-orange-700 mb-3">
                      Use this feature to quickly verify physical inventory counts against system records.
                    </p>
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-orange-600">Products to Count:</span>
                        <span className="font-medium">{products.length}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-orange-600">Low Stock Items:</span>
                        <span className="font-medium text-red-600">{stats.low_stock_items}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-orange-600">Out of Stock:</span>
                        <span className="font-medium text-red-600">{stats.out_of_stock_items}</span>
                      </div>
                    </div>
                  </div>
                  
                  <Button
                    variant="outline"
                    className="w-full border-orange-300 text-orange-700 hover:bg-orange-50"
                    onClick={() => {
                      toast({
                        title: "Stock Take Started",
                        description: "Navigate to inventory page for detailed stock counting",
                      })
                    }}
                  >
                    <Target className="h-4 w-4 mr-2" />
                    Start Stock Take
                  </Button>
                  
                  <div className="text-xs text-gray-500 text-center">
                    <p>• Count physical inventory</p>
                    <p>• Compare with system records</p>
                    <p>• Generate variance reports</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Alerts Tab */}
        <TabsContent value="alerts" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Alerts */}
            <div className="lg:col-span-2">
              <Card className="border-0 shadow-xl">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <AlertTriangle className="h-5 w-5 text-orange-500" />
                    <span>Smart Stock Alerts</span>
                  </CardTitle>
                  <CardDescription>Products requiring attention with quick actions</CardDescription>
                </CardHeader>
                <CardContent>
                  {stockAlerts.length === 0 ? (
                    <div className="text-center py-12">
                      <CheckCircle className="h-16 w-16 text-green-400 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">No alerts</h3>
                      <p className="text-gray-500">All products are within acceptable stock levels</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {stockAlerts.map((alert) => {
                        const type = alert.alert_type || (alert.severity === 'critical' ? 'out_of_stock' : alert.severity === 'high' ? 'low_stock' : 'overstock')
                        const alertColor = type === "out_of_stock" ? "red" :
                                         type === "low_stock" ? "yellow" : "orange"
                        
                        return (
                          <div key={alert.id} className={`p-4 border rounded-lg ${
                            alertColor === "red" ? "border-red-200 bg-red-50" :
                            alertColor === "yellow" ? "border-yellow-200 bg-yellow-50" :
                            "border-orange-200 bg-orange-50"
                          }`}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-3">
                                <AlertTriangle className={`h-5 w-5 ${
                                  alertColor === "red" ? "text-red-500" :
                                  alertColor === "yellow" ? "text-yellow-500" :
                                  "text-orange-500"
                                }`} />
                                <div>
                                  <h3 className="font-medium text-gray-900">{alert.title || alert.product_name}</h3>
                                  <p className="text-sm text-gray-500">{alert.message || `SKU: ${alert.sku} • ${alert.branch_name}`}</p>
                                  {alert.min_stock_level !== undefined && (
                                    <p className="text-xs text-gray-500">Min stock: {alert.min_stock_level}</p>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center space-x-3">
                                <div className="text-right">
                                  <p className={`font-bold text-lg ${
                                    alertColor === "red" ? "text-red-600" :
                                    alertColor === "yellow" ? "text-yellow-600" :
                                    "text-orange-600"
                                  }`}>
                                    {alert.current_stock}
                                  </p>
                                  <Badge variant={alertColor === "red" ? "destructive" : "secondary"} className="text-xs">
                                    {type === "out_of_stock" ? "Out of Stock" :
                                     type === "low_stock" ? "Low Stock" : "Overstock"}
                                  </Badge>
                                </div>
                                <div className="flex space-x-1">
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    className="bg-green-500 hover:bg-green-600 text-white"
                                    onClick={() => handleQuickAction('add', alert.product_id, 5)}
                                    disabled={isSubmitting}
                                  >
                                    <Plus className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    className="bg-blue-500 hover:bg-blue-600 text-white"
                                    onClick={() => {
                                      toast({
                                        title: "Transfer Suggested",
                                        description: "Use the transfer page for cross-branch transfers",
                                      })
                                    }}
                                    disabled={isSubmitting}
                                  >
                                    <Truck className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Alert Statistics */}
            <div className="space-y-6">
              {/* Alert Summary */}
              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <BarChart3 className="h-5 w-5 text-purple-500" />
                    <span>Alert Summary</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Critical (Out of Stock)</span>
                    <span className="font-medium text-red-600">{alertCounts.out_of_stock}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Low Stock</span>
                    <span className="font-medium text-yellow-600">{alertCounts.low_stock}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Overstock</span>
                    <span className="font-medium text-orange-600">{alertCounts.overstock}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Quick Actions */}
              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Zap className="h-5 w-5 text-green-500" />
                    <span>Quick Actions</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => {
                      const lowStockItems = stockAlerts.filter(a => a.alert_type === "low_stock")
                      if (lowStockItems.length > 0) {
                        toast({
                          title: "Bulk Action",
                          description: `Add stock to ${lowStockItems.length} low stock items`,
                        })
                      }
                    }}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add to Low Stock Items
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => {
                      const outOfStockItems = stockAlerts.filter(a => a.alert_type === "out_of_stock")
                      if (outOfStockItems.length > 0) {
                        toast({
                          title: "Bulk Action",
                          description: `Add stock to ${outOfStockItems.length} out of stock items`,
                        })
                      }
                    }}
                  >
                    <Package className="h-4 w-4 mr-2" />
                    Restock Out of Stock
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-6">
          <Card className="border-0 shadow-xl">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Clock className="h-5 w-5 text-indigo-500" />
                <span>Stock Movement History</span>
              </CardTitle>
              <CardDescription>Recent inventory transactions</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center h-64">
                  <Loader2 className="h-8 w-8 animate-spin text-pink-500" />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Product</TableHead>
                        <TableHead>Branch</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead>User</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stockMovements.slice((historyPage-1)*historyPageSize, historyPage*historyPageSize).map((movement) => (
                        <TableRow key={movement.id}>
                          <TableCell>
                            <div className="text-sm text-gray-600">
                              {new Date(movement.created_at).toLocaleDateString()}
                            </div>
                            <div className="text-xs text-gray-400">
                              {new Date(movement.created_at).toLocaleTimeString()}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium text-gray-900">{movement.product_name}</p>
                              <p className="text-sm text-gray-500">SKU: {movement.sku}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-gray-600">{movement.branch_name}</span>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={movement.movement_type === "in" ? "default" : "secondary"}
                              className={`text-xs ${
                                movement.movement_type === "in"
                                  ? "bg-green-100 text-green-800"
                                  : "bg-red-100 text-red-800"
                              }`}
                            >
                              {movement.movement_type === "in" ? (
                                <TrendingUp className="h-3 w-3 mr-1" />
                              ) : (
                                <TrendingDown className="h-3 w-3 mr-1" />
                              )}
                              {movement.movement_type === "in" ? "Stock In" : "Stock Out"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className="font-medium">{movement.quantity}</span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-gray-600">{movement.reason}</span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-gray-600">{movement.user_name}</span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {stockMovements.length === 0 && !isLoading && (
                <div className="text-center text-gray-500 py-8">
                  <Clock className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                  <p>No stock movements found</p>
                </div>
              )}
              {/* Pagination Controls */}
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                <div className="text-sm text-gray-600">Page {historyPage}</div>
                <div className="space-x-2">
                  <Button variant="outline" size="sm" disabled={historyPage === 1} onClick={() => setHistoryPage(p => Math.max(1, p-1))}>Previous</Button>
                  <Button variant="outline" size="sm" disabled={stockMovements.length <= historyPage*historyPageSize} onClick={() => setHistoryPage(p => p+1)}>Next</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Inventory Analytics Tab */}
        <TabsContent value="analytics" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Inventory Performance Metrics */}
            <div className="lg:col-span-2">
              <Card className="border-0 shadow-xl">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <BarChart3 className="h-5 w-5 text-indigo-500" />
                    <span>Inventory Performance Analytics</span>
                  </CardTitle>
                  <CardDescription>Comprehensive inventory metrics and trends</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg">
                      <div className="flex items-center space-x-2 mb-2">
                        <Package className="h-4 w-4 text-blue-600" />
                        <span className="text-sm font-medium text-blue-800">Total Stocks</span>
                      </div>
                      <p className="text-2xl font-bold text-blue-900">{stats.total_products}</p>
                      <p className="text-xs text-blue-600">Total units in stock</p>
                    </div>
                    
                    <div className="p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-lg">
                      <div className="flex items-center space-x-2 mb-2">
                        <TrendingUp className="h-4 w-4 text-green-600" />
                        <span className="text-sm font-medium text-green-800">Stock Turnover</span>
                      </div>
                      <p className="text-2xl font-bold text-green-900">4.2x</p>
                      <p className="text-xs text-green-600">Annual rate</p>
                    </div>
                    
                    <div className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg">
                      <div className="flex items-center space-x-2 mb-2">
                        <DollarSign className="h-4 w-4 text-purple-600" />
                        <span className="text-sm font-medium text-purple-800">Inventory Value</span>
                      </div>
                      <p className="text-2xl font-bold text-purple-900">${stats.total_value.toFixed(0)}</p>
                      <p className="text-xs text-purple-600">Total value</p>
                    </div>
                    
                    <div className="p-4 bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg">
                      <div className="flex items-center space-x-2 mb-2">
                        <Target className="h-4 w-4 text-orange-600" />
                        <span className="text-sm font-medium text-orange-800">Fill Rate</span>
                      </div>
                      <p className="text-2xl font-bold text-orange-900">94.2%</p>
                      <p className="text-xs text-orange-600">Order fulfillment</p>
                    </div>
                  </div>

                  {/* Inventory Trends Chart */}
                  <div className="space-y-4">
                    <h4 className="font-medium text-gray-900">Stock Level Trends</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="p-4 border border-gray-200 rounded-lg">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm font-medium text-gray-700">Low Stock Items</span>
                          <Badge variant="secondary" className="text-xs">{stats.low_stock_items}</Badge>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-yellow-500 h-2 rounded-full" 
                            style={{ width: `${(stats.low_stock_items / stats.total_products) * 100}%` }}
                          ></div>
                        </div>
                      </div>
                      
                      <div className="p-4 border border-gray-200 rounded-lg">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm font-medium text-gray-700">Out of Stock</span>
                          <Badge variant="destructive" className="text-xs">{stats.out_of_stock_items}</Badge>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-red-500 h-2 rounded-full" 
                            style={{ width: `${(stats.out_of_stock_items / stats.total_products) * 100}%` }}
                          ></div>
                        </div>
                      </div>
                      
                      <div className="p-4 border border-gray-200 rounded-lg">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm font-medium text-gray-700">Overstock</span>
                          <Badge variant="outline" className="text-xs">{stats.overstock_items}</Badge>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-orange-500 h-2 rounded-full" 
                            style={{ width: `${(stats.overstock_items / stats.total_products) * 100}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Inventory Insights */}
            <div className="space-y-6">
              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Activity className="h-5 w-5 text-green-500" />
                    <span>Inventory Insights</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-3 bg-gradient-to-r from-green-50 to-green-100 border border-green-200 rounded-lg">
                    <div className="flex items-center space-x-2 mb-1">
                      <TrendingUp className="h-3 w-3 text-green-600" />
                      <span className="text-xs font-medium text-green-800">Top Performers</span>
                    </div>
                    <p className="text-xs text-green-700">
                      {products.filter(p => p.current_stock > 0).slice(0, 3).map(p => p.name).join(', ')}
                    </p>
                  </div>
                  
                  <div className="p-3 bg-gradient-to-r from-red-50 to-red-100 border border-red-200 rounded-lg">
                    <div className="flex items-center space-x-2 mb-1">
                      <AlertTriangle className="h-3 w-3 text-red-600" />
                      <span className="text-xs font-medium text-red-800">Needs Attention</span>
                    </div>
                    <p className="text-xs text-red-700">
                      {products.filter(p => p.current_stock === 0).slice(0, 3).map(p => p.name).join(', ')}
                    </p>
                  </div>
                  
                  <div className="p-3 bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 rounded-lg">
                    <div className="flex items-center space-x-2 mb-1">
                      <Package className="h-3 w-3 text-blue-600" />
                      <span className="text-xs font-medium text-blue-800">Stock Movements</span>
                    </div>
                    <p className="text-xs text-blue-700">
                      {stats.recent_movements} movements in last 7 days
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Category Performance */}
              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <PieChart className="h-5 w-5 text-purple-500" />
                    <span>Category Performance</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {categories.slice(0, 5).map(category => {
                      const categoryProducts = products.filter(p => p.category_name === category)
                      const totalValue = categoryProducts.reduce((sum, p) => sum + (p.current_stock * p.price), 0)
                      const avgStock = categoryProducts.reduce((sum, p) => sum + p.current_stock, 0) / categoryProducts.length
                      
                      return (
                        <div key={category} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                          <div>
                            <p className="text-sm font-medium text-gray-900">{category}</p>
                            <p className="text-xs text-gray-500">{categoryProducts.length} products</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium text-gray-900">${totalValue.toFixed(0)}</p>
                            <p className="text-xs text-gray-500">Avg: {avgStock.toFixed(0)}</p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Inventory Reports */}
          <Card className="border-0 shadow-xl">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <FileText className="h-5 w-5 text-indigo-500" />
                <span>Inventory Reports</span>
              </CardTitle>
              <CardDescription>Detailed inventory analysis and recommendations</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Stock Level Analysis */}
                <div className="space-y-4">
                  <h4 className="font-medium text-gray-900">Stock Level Analysis</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center p-3 bg-red-50 border border-red-200 rounded-lg">
                      <div>
                        <p className="text-sm font-medium text-red-800">Critical Items</p>
                        <p className="text-xs text-red-600">Out of stock</p>
                      </div>
                      <Badge variant="destructive">{stats.out_of_stock_items}</Badge>
                    </div>
                    
                    <div className="flex justify-between items-center p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <div>
                        <p className="text-sm font-medium text-yellow-800">Low Stock Items</p>
                        <p className="text-xs text-yellow-600">Below minimum level</p>
                      </div>
                      <Badge variant="secondary">{stats.low_stock_items}</Badge>
                    </div>
                    
                    <div className="flex justify-between items-center p-3 bg-orange-50 border border-orange-200 rounded-lg">
                      <div>
                        <p className="text-sm font-medium text-orange-800">Overstock Items</p>
                        <p className="text-xs text-orange-600">Above maximum level</p>
                      </div>
                      <Badge variant="outline">{stats.overstock_items}</Badge>
                    </div>
                  </div>
                </div>

                {/* Recommendations */}
                <div className="space-y-4">
                  <h4 className="font-medium text-gray-900">Recommendations</h4>
                  <div className="space-y-3">
                    {stats.out_of_stock_items > 0 && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                        <div className="flex items-center space-x-2 mb-1">
                          <AlertTriangle className="h-3 w-3 text-red-600" />
                          <span className="text-xs font-medium text-red-800">Immediate Action Required</span>
                        </div>
                        <p className="text-xs text-red-700">
                          {stats.out_of_stock_items} items need immediate restocking
                        </p>
                      </div>
                    )}
                    
                    {stats.low_stock_items > 0 && (
                      <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <div className="flex items-center space-x-2 mb-1">
                          <Package className="h-3 w-3 text-yellow-600" />
                          <span className="text-xs font-medium text-yellow-800">Restock Soon</span>
                        </div>
                        <p className="text-xs text-yellow-700">
                          {stats.low_stock_items} items approaching minimum levels
                        </p>
                      </div>
                    )}
                    
                    {stats.overstock_items > 0 && (
                      <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                        <div className="flex items-center space-x-2 mb-1">
                          <TrendingDown className="h-3 w-3 text-orange-600" />
                          <span className="text-xs font-medium text-orange-800">Consider Transfers</span>
                        </div>
                        <p className="text-xs text-orange-700">
                          {stats.overstock_items} items could be transferred to other branches
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Smart Alerts Settings */}
            <Card className="border-0 shadow-xl">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <AlertTriangle className="h-5 w-5 text-orange-500" />
                  <span>Smart Alerts Settings</span>
                </CardTitle>
                <CardDescription>Configure notification preferences and thresholds</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Low Stock Threshold */}
                <div className="space-y-2">
                  <Label htmlFor="lowStockThreshold">Low Stock Threshold</Label>
                  <div className="flex items-center space-x-2">
                    <Input
                      id="lowStockThreshold"
                      type="number"
                      min="1"
                      max="50"
                      value={notificationSettings.lowStockThreshold}
                      onChange={(e) => updateNotificationSettings('lowStockThreshold', Number.parseInt(e.target.value))}
                      className="w-20"
                    />
                    <span className="text-sm text-gray-500">items</span>
                  </div>
                  <p className="text-xs text-gray-500">Products with stock below this level will trigger alerts</p>
                </div>

                {/* Alert Types */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Alert Types</Label>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        checked={notificationSettings.outOfStockAlerts}
                        onCheckedChange={(checked) => updateNotificationSettings('outOfStockAlerts', checked)}
                      />
                      <Label className="text-sm">Out of Stock Alerts</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        checked={notificationSettings.overstockAlerts}
                        onCheckedChange={(checked) => updateNotificationSettings('overstockAlerts', checked)}
                      />
                      <Label className="text-sm">Overstock Alerts</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        checked={notificationSettings.soundAlerts}
                        onCheckedChange={(checked) => updateNotificationSettings('soundAlerts', checked)}
                      />
                      <Label className="text-sm">Sound Alerts</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        checked={notificationSettings.emailNotifications}
                        onCheckedChange={(checked) => updateNotificationSettings('emailNotifications', checked)}
                      />
                      <Label className="text-sm">Email Notifications</Label>
                    </div>
                  </div>
                </div>

                {/* Alert Preview */}
                <div className="p-4 bg-gradient-to-r from-orange-50 to-yellow-50 border border-orange-200 rounded-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    <AlertTriangle className="h-4 w-4 text-orange-600" />
                    <span className="text-sm font-medium text-orange-800">Alert Preview</span>
                  </div>
                  <div className="space-y-1 text-xs text-orange-700">
                    <p>• Low stock items: {products.filter(p => p.current_stock <= notificationSettings.lowStockThreshold && p.current_stock > 0).length}</p>
                    <p>• Out of stock items: {products.filter(p => p.current_stock === 0).length}</p>
                    <p>• Overstock items: {products.filter(p => p.current_stock > p.max_stock_level).length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions Settings */}
            <Card className="border-0 shadow-xl">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Zap className="h-5 w-5 text-purple-500" />
                  <span>Quick Actions</span>
                </CardTitle>
                <CardDescription>Configure one-click stock operations</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Quick Action Buttons */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Available Quick Actions</Label>
                  <div className="grid grid-cols-1 gap-2">
                    <Button
                      variant="outline"
                      className="justify-start"
                      onClick={() => setQuickActions(prev => ({ ...prev, showQuickAdd: !prev.showQuickAdd }))}
                    >
                      <Plus className="h-4 w-4 mr-2 text-green-600" />
                      Quick Add Stock
                    </Button>
                    <Button
                      variant="outline"
                      className="justify-start"
                      onClick={() => setQuickActions(prev => ({ ...prev, showQuickReduce: !prev.showQuickReduce }))}
                    >
                      <Minus className="h-4 w-4 mr-2 text-red-600" />
                      Quick Reduce Stock
                    </Button>
                    <Button
                      variant="outline"
                      className="justify-start"
                      onClick={() => setQuickActions(prev => ({ ...prev, showQuickTransfer: !prev.showQuickTransfer }))}
                    >
                      <Truck className="h-4 w-4 mr-2 text-blue-600" />
                      Quick Transfer
                    </Button>
                  </div>
                </div>

                {/* Quick Actions Info */}
                <div className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    <Zap className="h-4 w-4 text-purple-600" />
                    <span className="text-sm font-medium text-purple-800">Quick Actions Guide</span>
                  </div>
                  <div className="space-y-1 text-xs text-purple-700">
                    <p>• Hover over product cards to see quick action buttons</p>
                    <p>• Click + to add 1 unit of stock</p>
                    <p>• Click - to reduce 1 unit of stock</p>
                    <p>• Click truck icon for transfer options</p>
                  </div>
                </div>

                {/* Keyboard Shortcuts */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Keyboard Shortcuts</Label>
                  <div className="space-y-1 text-xs text-gray-600">
                    <div className="flex justify-between">
                      <span>Ctrl + A</span>
                      <span>Select all products</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Ctrl + R</span>
                      <span>Refresh data</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Ctrl + S</span>
                      <span>Save settings</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* System Information */}
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Settings className="h-5 w-5 text-gray-500" />
                <span>System Information</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="space-y-1">
                  <p className="text-gray-600">Total Stocks</p>
                  <p className="font-medium">{stats.total_products}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-gray-600">Active Alerts</p>
                  <p className="font-medium text-red-600">{stats.alerts_count}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-gray-600">Last Updated</p>
                  <p className="font-medium">{new Date().toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* UI Preferences Tab */}
        <TabsContent value="preferences" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Display Preferences */}
            <Card className="border-0 shadow-xl">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Eye className="h-5 w-5 text-blue-500" />
                  <span>Display Preferences</span>
                </CardTitle>
                <CardDescription>Customize the visual appearance</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Compact Mode */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Compact Mode</Label>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      checked={uiPreferences.compactMode}
                      onCheckedChange={(checked) => updateUiPreference('compactMode', checked)}
                    />
                    <Label className="text-sm">Enable compact layout for smaller screens</Label>
                  </div>
                  <p className="text-xs text-gray-500">Reduces padding and spacing for better mobile experience</p>
                </div>

                {/* Animations */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Animations</Label>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      checked={uiPreferences.showAnimations}
                      onCheckedChange={(checked) => updateUiPreference('showAnimations', checked)}
                    />
                    <Label className="text-sm">Show hover animations and transitions</Label>
                  </div>
                  <p className="text-xs text-gray-500">Enables smooth animations for better user experience</p>
                </div>

                {/* Auto Refresh */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Auto Refresh</Label>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      checked={uiPreferences.autoRefresh}
                      onCheckedChange={(checked) => updateUiPreference('autoRefresh', checked)}
                    />
                    <Label className="text-sm">Automatically refresh data every 30 seconds</Label>
                  </div>
                  <p className="text-xs text-gray-500">Keeps data up-to-date automatically</p>
                </div>

                {/* Tooltips */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Tooltips</Label>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      checked={uiPreferences.showTooltips}
                      onCheckedChange={(checked) => updateUiPreference('showTooltips', checked)}
                    />
                    <Label className="text-sm">Show helpful tooltips and hints</Label>
                  </div>
                  <p className="text-xs text-gray-500">Provides additional information on hover</p>
                </div>
              </CardContent>
            </Card>

            {/* Mobile Optimizations */}
            <Card className="border-0 shadow-xl">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Phone className="h-5 w-5 text-green-500" />
                  <span>Mobile Optimizations</span>
                </CardTitle>
                <CardDescription>Enhance mobile experience</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Touch-Friendly Buttons */}
                <div className="p-4 bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    <Phone className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium text-green-800">Touch Optimizations</span>
                  </div>
                  <div className="space-y-1 text-xs text-green-700">
                    <p>• Larger touch targets for mobile devices</p>
                    <p>• Swipe gestures for navigation</p>
                    <p>• Responsive grid layouts</p>
                    <p>• Mobile-friendly form inputs</p>
                  </div>
                </div>

                {/* Performance Tips */}
                <div className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    <Zap className="h-4 w-4 text-purple-600" />
                    <span className="text-sm font-medium text-purple-800">Performance Tips</span>
                  </div>
                  <div className="space-y-1 text-xs text-purple-700">
                    <p>• Use compact mode on small screens</p>
                    <p>• Disable animations for better performance</p>
                    <p>• Enable auto-refresh for real-time data</p>
                    <p>• Use keyboard shortcuts for efficiency</p>
                  </div>
                </div>

                {/* Accessibility */}
                <div className="p-4 bg-gradient-to-r from-orange-50 to-yellow-50 border border-orange-200 rounded-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    <Users className="h-4 w-4 text-orange-600" />
                    <span className="text-sm font-medium text-orange-800">Accessibility</span>
                  </div>
                  <div className="space-y-1 text-xs text-orange-700">
                    <p>• High contrast color schemes</p>
                    <p>• Keyboard navigation support</p>
                    <p>• Screen reader compatibility</p>
                    <p>• Focus indicators for navigation</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions Bar */}
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Zap className="h-5 w-5 text-purple-500" />
                <span>Quick Actions Bar</span>
              </CardTitle>
              <CardDescription>Frequently used actions for quick access</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setLoadingState('isRefreshing', true)
                    fetchData().finally(() => setLoadingState('isRefreshing', false))
                  }}
                  disabled={isLoading || loadingStates.isRefreshing}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${(isLoading || loadingStates.isRefreshing) ? 'animate-spin' : ''}`} />
                  Refresh Data
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveTab("alerts")}
                >
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  View Alerts
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveTab("operations")}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Stock
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveTab("history")}
                >
                  <Clock className="h-4 w-4 mr-2" />
                  View History
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => updateUiPreference('compactMode', !uiPreferences.compactMode)}
                >
                  {uiPreferences.compactMode ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
                  {uiPreferences.compactMode ? 'Normal Mode' : 'Compact Mode'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
