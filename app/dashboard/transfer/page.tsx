"use client"

import type React from "react"

import { useState, useEffect, useRef, useMemo, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { 
  ArrowRightLeft, 
  Building2, 
  Clock, 
  CheckCircle, 
  Loader2,
  Search,
  Package,
  Plus,
  Minus,
  Trash2,
  DollarSign,
  AlertTriangle,
  TrendingUp,
  Users,
  Zap,
  Target,
  Star,
  Eye,
  EyeOff,
  Filter,
  SortAsc,
  SortDesc,
  Grid3X3,
  List,
  RefreshCw,
  Download,
  Upload,
  MoreHorizontal,
  Heart,
  Share2,
  Bookmark,
  Calendar,
  MapPin,
  TrendingDown,
  Activity,
  PieChart,
  FilterX,
  ImageIcon,
  BarChart3,
  Truck,
  Route,
  Navigation,
  Compass,
  XCircle,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronUp,
  ChevronDown,
  Layers
} from "lucide-react"
import { useLanguage } from "@/lib/language-context"
import { useBranch } from "@/lib/branch-context"
import apiClient from "@/lib/api-client"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"

interface Variation {
  id: string
  variation_id: string
  variation_sku: string
  color?: string
  size?: string
  price: number
  cost_price?: number
  purchase_price?: number
  quantity: number
  min_stock_level: number
  max_stock_level: number
  stock_status: string
  branch_name: string
}

interface Product {
  id: string
  name: string
  sku: string
  price: number
  purchase_price?: number
  cost_price?: number
  total_stock: number
  category_name: string
  color?: string
  size?: string
  brand?: string
  age_range?: string
  gender?: string
  description?: string
  product_type?: string
  variations?: Variation[]
}

interface ProductWithVariations {
  product_id: string
  product_name: string
  product_sku: string
  product_type: string
  brand?: string
  age_range?: string
  gender?: string
  description?: string
  image_url?: string
  category_name: string
  variations: {
    id: string
    variation_id: string
    variation_sku: string
    color?: string
    size?: string
    price: number
    cost_price?: number
    purchase_price?: number
    quantity: number
    min_stock_level: number
    max_stock_level: number
    stock_status: string
    branch_name: string
  }[]
}

interface Transfer {
  id: string
  from_branch_id: string
  to_branch_id: string
  status: string
  reason: string
  requested_at: string
  completed_at?: string
  items: TransferItem[]
  from_branch_name?: string
  to_branch_name?: string
  requested_by_name?: string
  approved_by_name?: string
}

interface TransferItem {
  id: string
  product_id: string
  product_name: string
  quantity: number
  sku?: string
  variation_id?: string
  variation_name?: string
}

interface Branch {
  id: string
  name: string
}

interface TransferStats {
  total_transfers: number
  completed_transfers: number
  pending_transfers: number
  total_items_transferred: number
  total_value_transferred: number
}

export default function TransferPage() {
  const { t } = useLanguage()
  const { currentBranch } = useBranch()
  const { toast } = useToast()
  const router = useRouter()
  
  // Form state
  const [selectedProduct, setSelectedProduct] = useState("")
  const [selectedVariation, setSelectedVariation] = useState("")
  const [fromBranch, setFromBranch] = useState("")
  const [toBranch, setToBranch] = useState("")
  const [quantity, setQuantity] = useState("")
  const [reason, setReason] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set())
  
  // Role-based access control
  const isOwner = currentBranch === "all"
  const userBranch = currentBranch !== "all" ? currentBranch : null
  
  // Data state
  const [products, setProducts] = useState<Product[]>([])
  const [productsWithVariations, setProductsWithVariations] = useState<ProductWithVariations[]>([])
  const [transfers, setTransfers] = useState<Transfer[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [lastTransfer, setLastTransfer] = useState<Transfer | null>(null)
  
  // Enhanced UI state
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set())
  const [sortBy, setSortBy] = useState<string>('requested_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [showFilters, setShowFilters] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [productSearchTerm, setProductSearchTerm] = useState("")
  const [productSelectedCategories, setProductSelectedCategories] = useState<Set<string>>(new Set())
  const [productQuantities, setProductQuantities] = useState<Record<string, string>>({})
  const [variationQuantities, setVariationQuantities] = useState<Record<string, string>>({})
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(12) // 4 rows of 3 items each
  
  const formRef = useRef<HTMLFormElement>(null)

  // Calculate transfer stats
  const transferStats = useMemo((): TransferStats => {
    const total = transfers.length
    const completed = transfers.filter(t => t.status === 'completed').length
    const totalItems = transfers.reduce((sum, t) => 
      sum + t.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0
    )
    const totalValue = transfers.reduce((sum, t) => 
      sum + t.items.reduce((itemSum, item) => itemSum + (item.quantity * 0), 0), 0
    ) // TODO: Add price calculation

    return {
      total_transfers: total,
      completed_transfers: completed,
      pending_transfers: 0, // No pending transfers - all are instant
      total_items_transferred: totalItems,
      total_value_transferred: totalValue
    }
  }, [transfers])

  // Filter and sort transfers
  const processedTransfers = useMemo(() => {
    let filtered = transfers

    // Apply search filter
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase()
      filtered = filtered.filter(transfer => 
        transfer.reason.toLowerCase().includes(searchLower) ||
        transfer.items.some(item => 
          item.product_name.toLowerCase().includes(searchLower)
        ) ||
        (transfer.from_branch_name && transfer.from_branch_name.toLowerCase().includes(searchLower)) ||
        (transfer.to_branch_name && transfer.to_branch_name.toLowerCase().includes(searchLower))
      )
    }

    // Apply category filter
    if (selectedCategories.size > 0) {
      filtered = filtered.filter(transfer => 
        transfer.items.some(item => 
          selectedCategories.has(item.product_name) // Simplified category check
        )
      )
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue: any, bValue: any
      
      switch (sortBy) {
        case 'requested_at':
          aValue = new Date(a.requested_at).getTime()
          bValue = new Date(b.requested_at).getTime()
          break
        case 'status':
          aValue = a.status.toLowerCase()
          bValue = b.status.toLowerCase()
          break
        case 'from_branch':
          aValue = a.from_branch_name?.toLowerCase() || ''
          bValue = b.from_branch_name?.toLowerCase() || ''
          break
        case 'to_branch':
          aValue = a.to_branch_name?.toLowerCase() || ''
          bValue = b.to_branch_name?.toLowerCase() || ''
          break
        default:
          aValue = new Date(a.requested_at).getTime()
          bValue = new Date(b.requested_at).getTime()
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1
      } else {
        return aValue < bValue ? 1 : -1
      }
    })

    return filtered
  }, [transfers, searchTerm, selectedCategories, sortBy, sortOrder])

  // Helper function to get available products
  const getAvailableProducts = () => {
    if (isOwner) {
      if (!fromBranch) return []
      return products.filter((p) => p.total_stock > 0)
    } else {
      // For employees, only show products from their branch
      return products.filter((p) => p.total_stock > 0)
    }
  }

  // Helper function to get available products with variations
  const getAvailableProductsWithVariations = () => {
    if (isOwner) {
      if (!fromBranch) return []
      return productsWithVariations.filter((p) => 
        p.variations.some(v => v.quantity > 0)
      )
    } else {
      // For employees, only show products from their branch
      return productsWithVariations.filter((p) => 
        p.variations.some(v => v.quantity > 0)
      )
    }
  }

  // Advanced search logic with intelligent matching
  const getSearchType = (searchTerm: string) => {
    const trimmedTerm = searchTerm.trim()
    const totalLength = trimmedTerm.length
    
    if (totalLength < 3) {
      return { type: 'exact', term: trimmedTerm }
    } else if (totalLength >= 3 && totalLength <= 5) {
      return { type: 'partial', term: trimmedTerm }
    } else if (totalLength >= 6) {
      return { type: 'phrase', term: trimmedTerm }
    }
    
    return { type: 'exact', term: trimmedTerm }
  }

  // Filtered and paginated products
  const filteredProducts = useMemo(() => {
    let filtered = getAvailableProducts()

    // Apply advanced search filter
    if (productSearchTerm.trim()) {
      const searchInfo = getSearchType(productSearchTerm)
      const searchLower = searchInfo.term.toLowerCase()
      
      filtered = filtered.filter(product => {
        const searchableFields = [
          product.name,
          product.sku,
          product.category_name,
          product.brand || '',
          product.color || '',
          product.size || '',
          product.age_range || '',
          product.gender || ''
        ].map(field => field.toLowerCase())
        
        switch (searchInfo.type) {
          case 'exact':
            // Enhanced exact match - check for exact matches and starts with
            return searchableFields.some(field => 
              field === searchLower || field.startsWith(searchLower)
            )
          case 'partial':
            // Partial match - check if search term is contained in any field
            return searchableFields.some(field => 
              field.includes(searchLower)
            )
          case 'phrase':
            // Phrase match - check if all words are present in any field
            const words = searchLower.split(/\s+/)
            return searchableFields.some(field => 
              words.every(word => field.includes(word))
            )
          default:
            return searchableFields.some(field => 
              field.includes(searchLower)
            )
        }
      })
    }
    
    // Apply category filter
    if (productSelectedCategories.size > 0) {
      filtered = filtered.filter(product => 
        productSelectedCategories.has(product.category_name)
      )
    }
    
    return filtered
  }, [products, isOwner, fromBranch, productSearchTerm, productSelectedCategories])

  // Filtered products with variations
  const filteredProductsWithVariations = useMemo(() => {
    let filtered = getAvailableProductsWithVariations()

    // Apply advanced search filter
    if (productSearchTerm.trim()) {
      const searchInfo = getSearchType(productSearchTerm)
      const searchLower = searchInfo.term.toLowerCase()
      
      filtered = filtered.filter(product => {
        const searchableFields = [
          product.product_name,
          product.product_sku,
          product.category_name,
          product.brand || '',
          product.age_range || '',
          product.gender || '',
          // Include variation attributes in search
          ...product.variations.flatMap(v => [
            v.color || '',
            v.size || '',
            v.variation_sku
          ])
        ].map(field => field.toLowerCase())
        
        switch (searchInfo.type) {
          case 'exact':
            return searchableFields.some(field => 
              field === searchLower || field.startsWith(searchLower)
            )
          case 'partial':
            return searchableFields.some(field => 
              field.includes(searchLower)
            )
          case 'phrase':
            const words = searchLower.split(/\s+/)
            return searchableFields.some(field => 
              words.every(word => field.includes(word))
            )
          default:
            return searchableFields.some(field => 
              field.includes(searchLower)
            )
        }
      })
    }
    
    // Apply category filter
    if (productSelectedCategories.size > 0) {
      filtered = filtered.filter(product => 
        productSelectedCategories.has(product.category_name)
      )
    }
    
    return filtered
  }, [productsWithVariations, isOwner, fromBranch, productSearchTerm, productSelectedCategories])

  // Create a unified product list for display
  const allProducts = useMemo(() => {
    const regularProducts = filteredProducts.map(product => ({
      type: 'regular' as const,
      data: product
    }))
    
    const variationProducts = filteredProductsWithVariations.map(product => ({
      type: 'variation' as const,
      data: product
    }))
    

    
    return [...regularProducts, ...variationProducts]
  }, [filteredProducts, filteredProductsWithVariations])

  // Pagination calculations
  const totalPages = Math.ceil(allProducts.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentProducts = allProducts.slice(startIndex, endIndex)

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [productSearchTerm, productSelectedCategories])

  useEffect(() => {
    fetchData()
  }, [currentBranch])

  // Re-fetch products when owner selects a different source branch
  useEffect(() => {
    if (isOwner) {
      fetchData()
    }
  }, [isOwner, fromBranch])

  const fetchData = async () => {
    setIsLoading(true)
    try {
      // Fetch products with inventory data
      const productsParams: any = {
        page: 1,
        limit: 100,
      }

      // Determine which branch inventory to load
      const branchIdForInventory = currentBranch !== "all" ? currentBranch : (fromBranch || undefined)

      if (branchIdForInventory) {
        productsParams.branch_id = branchIdForInventory
      }

      if (branchIdForInventory) {
        const productsResponse = await apiClient.getInventory(productsParams)
        if (productsResponse.success && productsResponse.data) {
          // Transform inventory data to product format
          const inventoryData = productsResponse.data as any[]
          
          // Group by product_id to handle variations
          const productGroups = new Map<string, any[]>()
          inventoryData.forEach(item => {
            if (!productGroups.has(item.product_id)) {
              productGroups.set(item.product_id, [])
            }
            productGroups.get(item.product_id)!.push(item)
          })

          // Transform to products - follow the Inventory page pattern
          // All products get grouped into ProductWithVariations structure
          const productsWithVariations: ProductWithVariations[] = []
          const simpleProducts: Product[] = []

          productGroups.forEach((items, productId) => {
            const firstItem = items[0]
            
            if (firstItem.product_type === 'variation') {
              // This is a variation product - create ProductWithVariations structure
              const productWithVariations: ProductWithVariations = {
                product_id: productId,
                product_name: firstItem.product_name,
                product_sku: firstItem.product_sku || firstItem.sku,
                product_type: firstItem.product_type,
                brand: firstItem.brand,
                age_range: firstItem.age_range,
                gender: firstItem.gender,
                description: firstItem.description,
                image_url: firstItem.image_url,
                category_name: firstItem.category_name,
                variations: items.map(item => ({
                  id: item.id,
                  variation_id: item.variation_id || item.id,
                  variation_sku: item.variation_sku || item.sku,
                  color: item.color,
                  size: item.size,
                  price: item.price,
                  cost_price: item.cost_price,
                  purchase_price: item.purchase_price,
                  quantity: item.quantity,
                  min_stock_level: item.min_stock_level,
                  max_stock_level: item.max_stock_level,
                  stock_status: item.stock_status,
                  branch_name: item.branch_name
                }))
              }
              productsWithVariations.push(productWithVariations)
            } else {
              // This is a uniform product - treat as single-stock item
              // For uniform products, sum up quantities from all inventory records
              const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0)
              
              const simpleProduct: Product = {
                id: productId,
                name: firstItem.product_name,
                sku: firstItem.sku,
                price: firstItem.price,
                purchase_price: firstItem.purchase_price,
                cost_price: firstItem.cost_price,
                total_stock: totalQuantity,
                category_name: firstItem.category_name,
                color: firstItem.color,
                size: firstItem.size,
                brand: firstItem.brand,
                age_range: firstItem.age_range,
                gender: firstItem.gender,
                description: firstItem.description,
                product_type: firstItem.product_type || 'uniform'
              }
              simpleProducts.push(simpleProduct)
            }
          })

          setProductsWithVariations(productsWithVariations)
          setProducts(simpleProducts)
        } else {
          setProducts([])
          setProductsWithVariations([])
        }
      } else {
        // No branch selected yet (owner view); show empty list
        setProducts([])
        setProductsWithVariations([])
      }

      // Fetch branches
      const branchesResponse = await apiClient.getBranches()
      if (branchesResponse.success && branchesResponse.data) {
        setBranches(branchesResponse.data as Branch[])
      }

      // Fetch transfers
      try {
        const transfersResponse = await apiClient.getTransfers()
        if (transfersResponse.success && transfersResponse.data) {
          // Handle both array and paginated response
          const transfersData = Array.isArray(transfersResponse.data) 
            ? transfersResponse.data 
            : transfersResponse.data.data || []
          setTransfers(transfersData as Transfer[])
        }
      } catch (error) {
        console.log("Transfers API not implemented yet, using mock data")
        // Use mock data for now
        setTransfers([
          {
            id: "1",
            from_branch_id: "branch1",
            to_branch_id: "branch2",
            status: "completed",
            reason: "High demand in Branch 2",
            requested_at: "2024-01-15T10:00:00Z",
            completed_at: "2024-01-15T14:00:00Z",
            from_branch_name: "Franko (Main)",
            to_branch_name: "Mebrathayl",
            requested_by_name: "Admin User",
            approved_by_name: "Admin User",
            items: [
              { id: "1", product_id: "1", product_name: "Rainbow Unicorn Dress", quantity: 5, sku: "UNI001" }
            ]
          },
          {
            id: "2",
            from_branch_id: "branch2",
            to_branch_id: "branch1",
            status: "completed",
            reason: "Rebalancing inventory",
            requested_at: "2024-01-14T09:00:00Z",
            completed_at: "2024-01-14T13:00:00Z",
            from_branch_name: "Mebrathayl",
            to_branch_name: "Franko (Main)",
            requested_by_name: "Admin User",
            approved_by_name: "Admin User",
            items: [
              { id: "2", product_id: "2", product_name: "Superhero Cape T-Shirt", quantity: 10, sku: "HER001" }
            ]
          },
          {
            id: "3",
            from_branch_id: "branch1",
            to_branch_id: "branch2",
            status: "completed",
            reason: "Customer request",
            requested_at: "2024-01-13T11:00:00Z",
            completed_at: "2024-01-13T11:00:00Z",
            from_branch_name: "Franko (Main)",
            to_branch_name: "Mebrathayl",
            requested_by_name: "Admin User",
            approved_by_name: "Admin User",
            items: [
              { id: "3", product_id: "3", product_name: "Sparkle Princess Shoes", quantity: 3, sku: "PRN001" }
            ]
          }
        ])
      }
    } catch (error: any) {
      console.error("Data fetch error:", error)
      toast({
        title: "Error",
        description: "Failed to load data",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleRefreshData = async () => {
    setIsRefreshing(true)
    try {
      await fetchData()
      toast({
        title: "Data Refreshed",
        description: "Transfer data has been updated",
      })
    } catch (error) {
      console.error("Refresh error:", error)
    } finally {
      setIsRefreshing(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Get selected products and variations with quantities
    const selectedItems = [
      // Add products without variations
      ...Object.entries(productQuantities)
        .filter(([productId, quantity]) => quantity && Number.parseInt(quantity) > 0)
        .map(([productId, quantity]) => ({
          product_id: productId,
          quantity: Number.parseInt(quantity),
          variation_id: undefined
        })),
      // Add variations
      ...Object.entries(variationQuantities)
        .filter(([variationId, quantity]) => quantity && Number.parseInt(quantity) > 0)
        .map(([variationId, quantity]) => {
          // Find the product that contains this variation in productsWithVariations
          const productWithVariations = productsWithVariations.find(p => 
            p.variations.some(v => v.variation_id === variationId)
          )
          const variation = productWithVariations?.variations.find(v => v.variation_id === variationId)
          
          return {
            product_id: productWithVariations?.product_id || "",
            quantity: Number.parseInt(quantity),
            variation_id: variationId,
            variation_name: variation ? `${variation.color || ""} ${variation.size || ""}`.trim() : undefined
          }
        })
    ]

    // Role-based validation
    const requiredFields = isOwner 
      ? (!fromBranch || !toBranch || selectedItems.length === 0)
      : (!toBranch || selectedItems.length === 0)
    
    if (requiredFields) {
      toast({
        title: "Error",
        description: "Please select branches and add quantities for at least one product or variation",
        variant: "destructive",
      })
      return
    }

    // Validate quantities
    const invalidQuantities = selectedItems.filter(item => {
      if (item.variation_id) {
        // For variations, check against the variation's quantity in productsWithVariations
        const productWithVariations = productsWithVariations.find(p => p.product_id === item.product_id)
        const variation = productWithVariations?.variations.find(v => v.variation_id === item.variation_id)
        return variation && item.quantity > variation.quantity
      } else {
        // For uniform products, check against the product's total stock
        const product = products.find(p => p.id === item.product_id)
        return product && item.quantity > product.total_stock
      }
    })

    if (invalidQuantities.length > 0) {
      toast({
        title: "Invalid Quantities",
        description: "Some products have quantities greater than available stock. Please adjust the quantities.",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)

    try {
      const transferData = {
        from_branch_id: isOwner ? fromBranch : userBranch,
        to_branch_id: toBranch,
        reason: reason || "Transfer initiated by user",
        items: selectedItems
      }

      // Try to create transfer via API
      try {
        const response = await apiClient.createTransfer(transferData)
        if (response.success) {
          toast({
            title: "Transfer Completed Successfully!",
            description: `Items have been transferred from ${isOwner ? getBranchName(fromBranch) : getBranchName(userBranch!)} to ${getBranchName(toBranch)}`,
          })
          
          setLastTransfer(response.data as Transfer)

          // Optimistically update source branch quantities in the UI
          const productQuantityMap = new Map<string, number>()
          const variationQuantityMap = new Map<string, {productId: string, quantity: number}>()
          
          // Populate maps from selectedItems
          selectedItems.forEach(item => {
            if (item.variation_id) {
              variationQuantityMap.set(item.variation_id, {productId: item.product_id, quantity: item.quantity})
            } else {
              productQuantityMap.set(item.product_id, item.quantity)
            }
          })
          
          // Update uniform products
          setProducts(prev => {
            return prev.map(p => {
              const productDelta = productQuantityMap.get(p.id) || 0
              if (productDelta > 0) {
                return {
                  ...p,
                  total_stock: Math.max(0, (p.total_stock || 0) - productDelta)
                }
              }
              return p
            })
          })

          // Update variation products
          setProductsWithVariations(prev => {
            return prev.map(p => {
              const updatedVariations = p.variations.map(v => {
                const variationData = variationQuantityMap.get(v.variation_id)
                if (variationData && variationData.productId === p.product_id) {
                  return { 
                    ...v, 
                    quantity: Math.max(0, (v.quantity || 0) - variationData.quantity) 
                  }
                }
                return v
              })
              return {
                ...p,
                variations: updatedVariations
              }
            })
          })

          // Fetch destination inventory and show new quantities for transferred products
          try {
            const destInvResp = await apiClient.getBranchInventory(toBranch!, { page: 1, limit: 500 })
            if (destInvResp.success && Array.isArray(destInvResp.data)) {
              const invRows: any[] = destInvResp.data
              const lines: string[] = []
              
              selectedItems.forEach(item => {
                const row = invRows.find(r => r.product_id === item.product_id)
                if (row) {
                  if (item.variation_id) {
                    // Find the variation in the productsWithVariations
                    const productWithVariations = productsWithVariations.find(p => p.product_id === item.product_id)
                    const variation = productWithVariations?.variations.find(v => v.variation_id === item.variation_id)
                    if (variation) {
                      const colorLabel = variation.color ? `Color: ${variation.color}` : ''
                      const sizeLabel = variation.size ? `Size: ${variation.size}` : ''
                      const attributes = [colorLabel, sizeLabel].filter(Boolean).join(', ')
                      lines.push(`${row.product_name} (${attributes}) → ${item.quantity} units in ${getBranchName(toBranch!)}`)
                    }
                  } else {
                    lines.push(`${row.product_name} (SKU: ${row.sku}) → ${row.quantity} units in ${getBranchName(toBranch!)}`)
                  }
                }
              })
              
              if (lines.length > 0) {
                toast({
                  title: "Destination Updated",
                  description: lines.slice(0, 5).join("\n") + (lines.length > 5 ? `\n+${lines.length - 5} more...` : ""),
                })
              }
            }
          } catch (e) {
            // Ignore destination preview errors
          }
          
          // Reset form fields except branch selections so inventory view stays scoped
          setSelectedProduct("")
          setQuantity("")
          setReason("")
          setProductSearchTerm("")
          setProductSelectedCategories(new Set())
          setProductQuantities({})
          setVariationQuantities({}) // Clear variation quantities
          setExpandedProducts(new Set()) // Collapse all expanded products
          setCurrentPage(1) // Reset pagination
          if (formRef.current) formRef.current.reset()
          
          // Refresh data (re-fetch source inventory and transfers)
          fetchData()
          
          // Scroll to top to show success message
          window.scrollTo({ top: 0, behavior: "smooth" })
        } else {
          throw new Error(response.error || "Failed to create transfer")
        }
      } catch (apiError: any) {
        // Surface the real error; do not mock success
        console.error("Transfer API error:", apiError)
        toast({
          title: "Transfer Failed",
          description: apiError?.message || "Could not complete transfer. Please try again.",
          variant: "destructive",
        })
        setIsSubmitting(false)
        return
      }
    } catch (error: any) {
      console.error("Transfer submission error:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to submit transfer",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const getMaxQuantity = () => {
    if (!selectedProduct) return 0
    const product = products.find((p) => p.id === selectedProduct)
    return product?.total_stock || 0
  }

  const getBranchName = (branchId: string) => {
    const branch = branches.find((b) => b.id === branchId)
    return branch?.name || branchId
  }

  const getProductName = (productId: string) => {
    const product = products.find((p) => p.id === productId)
    return product?.name || productId
  }

  const getProductSku = (productId: string) => {
    const product = products.find((p) => p.id === productId)
    return product?.sku || ""
  }

  // Helper functions for color display
  const getColorClass = (color: string) => {
    const colorMap: { [key: string]: string } = {
      'white': 'bg-white',
      'black': 'bg-black',
      'gray': 'bg-gray-500',
      'red': 'bg-red-500',
      'blue': 'bg-blue-500',
      'green': 'bg-green-500',
      'yellow': 'bg-yellow-400',
      'orange': 'bg-orange-500',
      'purple': 'bg-purple-500',
      'brown': 'bg-amber-800',
      'baby-pink': 'bg-pink-200',
      'baby-blue': 'bg-blue-200',
      'baby-yellow': 'bg-yellow-200',
      'baby-green': 'bg-green-200',
      'baby-purple': 'bg-purple-200',
    }
    return colorMap[color] || ''
  }

  const getColorStyle = (color: string) => {
    const styleMap: { [key: string]: React.CSSProperties } = {
      'baby-peach': { backgroundColor: '#FFCBA4' },
      'baby-mint': { backgroundColor: '#B8E6B8' },
      'baby-lavender': { backgroundColor: '#E6E6FA' },
      'cream': { backgroundColor: '#FFFDD0' },
      'ivory': { backgroundColor: '#FFFFF0' },
      'beige': { backgroundColor: '#F5F5DC' },
      'coral': { backgroundColor: '#FF7F50' },
      'turquoise': { backgroundColor: '#40E0D0' },
      'lilac': { backgroundColor: '#C8A2C8' },
      'sage': { backgroundColor: '#9CAF88' },
    }
    return styleMap[color] || {}
  }

  const getStatusBadge = (status: string) => {
    const isCompleted = status === "completed"
    return (
      <Badge
        className={`rounded-full ${
          isCompleted
            ? "bg-green-100 text-green-800"
            : "bg-yellow-100 text-yellow-800"
        }`}
      >
        {isCompleted ? (
          <>
            <CheckCircle className="h-3 w-3 mr-1" />
            Completed
          </>
        ) : (
          <>
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </>
        )}
      </Badge>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-pink-500" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Success Message */}
      {lastTransfer && (
        <Card className="border-0 shadow-xl bg-gradient-to-br from-green-50 via-emerald-50 to-green-100 border border-green-200 animate-in slide-in-from-top-2 duration-500">
          <CardHeader className="bg-gradient-to-r from-green-100 to-emerald-100 border-b border-green-200">
            <CardTitle className="flex items-center space-x-2 text-green-800">
              <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-white" />
              </div>
              <span>Transfer Completed Successfully!</span>
            </CardTitle>
            <CardDescription className="text-green-700">
              Items have been transferred instantly between branches and inventory has been updated
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Transfer Details */}
              <div className="lg:col-span-2">
                <div className="space-y-3">
                  <h4 className="font-semibold text-green-800 mb-3">Transfer Details:</h4>
                  <div className="space-y-2">
                    {lastTransfer.items.map((item: any) => (
                      <div key={item.id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-green-200">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-gradient-to-r from-green-100 to-emerald-100 rounded-lg flex items-center justify-center">
                            <Package className="h-4 w-4 text-green-600" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{item.product_name}</p>
                            <p className="text-sm text-gray-500">Qty: {item.quantity} • SKU: {item.sku}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-500">Transferred</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Transfer Summary */}
              <div className="space-y-4">
                <div className="bg-white rounded-lg p-4 border border-green-200">
                  <h4 className="font-semibold text-green-800 mb-3">Transfer Summary</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">From:</span>
                      <span className="font-medium">{lastTransfer.from_branch_name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">To:</span>
                      <span className="font-medium">{lastTransfer.to_branch_name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Items:</span>
                      <span className="font-medium">{lastTransfer.items.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total Quantity:</span>
                      <span className="font-medium">
                        {lastTransfer.items.reduce((sum: number, item: any) => sum + item.quantity, 0)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="space-y-2">
                  <Button
                    onClick={() => setLastTransfer(null)}
                    className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white"
                  >
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Continue Transferring
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setLastTransfer(null)
                      setSelectedProduct("")
                      setFromBranch("")
                      setToBranch("")
                      setQuantity("")
                      setReason("")
                    }}
                    className="w-full border-green-300 text-green-700 hover:bg-green-50"
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Start New Transfer
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">
            Branch Transfer
          </h1>
          <p className="text-gray-600 mt-1">Transfer products between branches instantly - no approval needed</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button 
            variant="outline"
            onClick={() => window.location.href = '/dashboard/inventory'}
            className="border-gray-200 hover:bg-gray-50 shadow-sm"
          >
            <Package className="h-4 w-4 mr-2" />
            View Inventory
          </Button>
          <Button 
            variant="outline"
            onClick={handleRefreshData}
            disabled={isRefreshing}
            className="border-blue-200 text-blue-600 hover:bg-blue-50"
          >
            {isRefreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-blue-100">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                <Truck className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-blue-700">Total Transfers</p>
                <p className="text-2xl font-bold text-blue-900">{transferStats.total_transfers}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-gradient-to-br from-green-50 to-green-100">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-green-600 rounded-lg flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-green-700">Completed</p>
                <p className="text-2xl font-bold text-green-900">{transferStats.completed_transfers}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-gradient-to-br from-yellow-50 to-yellow-100">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-yellow-500 to-yellow-600 rounded-lg flex items-center justify-center">
                <Clock className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-yellow-700">Pending</p>
                <p className="text-2xl font-bold text-yellow-900">{transferStats.pending_transfers}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-gradient-to-br from-purple-50 to-purple-100">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg flex items-center justify-center">
                <Package className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-purple-700">Items Transferred</p>
                <p className="text-2xl font-bold text-purple-900">{transferStats.total_items_transferred}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Enhanced Transfer Form with Side-by-Side Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Branch Selection and Transfer Controls */}
        <div className="lg:col-span-1 space-y-6">
          {/* Branch Selection Card */}
          <Card className="border-0 shadow-xl bg-gradient-to-br from-white to-gray-50">
            <CardHeader className="bg-gradient-to-r from-pink-50 to-purple-50 border-b border-pink-100">
              <CardTitle className="flex items-center space-x-2 text-gray-800">
                <div className="w-10 h-10 bg-gradient-to-r from-pink-500 to-purple-500 rounded-lg flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-white" />
                </div>
                <span>Branch Selection</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={handleSubmit} className="space-y-4" ref={formRef}>
                {/* Branch Selection - Only for Owner */}
                {isOwner ? (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="fromBranch">From Branch *</Label>
                      <Select value={fromBranch} onValueChange={setFromBranch} required>
                        <SelectTrigger className="rounded-xl border-gray-200 focus:border-pink-300 focus:ring-pink-200">
                          <SelectValue placeholder="Select source" />
                        </SelectTrigger>
                        <SelectContent>
                          {branches.map((branch) => (
                            <SelectItem key={branch.id} value={branch.id}>
                              {branch.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="toBranch">To Branch *</Label>
                      <Select value={toBranch} onValueChange={setToBranch} required>
                        <SelectTrigger className="rounded-xl border-gray-200 focus:border-pink-300 focus:ring-pink-200">
                          <SelectValue placeholder="Select destination" />
                        </SelectTrigger>
                        <SelectContent>
                          {branches.map((branch) => (
                            <SelectItem key={branch.id} value={branch.id} disabled={fromBranch === branch.id}>
                              {branch.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ) : (
                  /* Employee View - Show current branch and destination selection */
                  <div className="space-y-4">
                    {/* Source Branch Display */}
                    <div className="p-4 bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg border border-blue-200">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full flex items-center justify-center">
                          <Building2 className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-blue-800">Transferring from:</p>
                          <p className="text-lg font-bold text-blue-900">{getBranchName(userBranch!)}</p>
                          <p className="text-xs text-blue-600">Your current branch</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="toBranch">To Branch *</Label>
                      <Select value={toBranch} onValueChange={setToBranch} required>
                        <SelectTrigger className="rounded-xl border-gray-200 focus:border-pink-300 focus:ring-pink-200">
                          <SelectValue placeholder="Select destination branch" />
                        </SelectTrigger>
                        <SelectContent>
                          {branches
                            .filter(branch => branch.id !== userBranch)
                            .map((branch) => (
                              <SelectItem key={branch.id} value={branch.id}>
                                {branch.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                {/* Selected Products Summary */}
                {(Object.keys(productQuantities).filter(key => productQuantities[key] && Number.parseInt(productQuantities[key]) > 0).length > 0 ||
                  Object.keys(variationQuantities).filter(key => variationQuantities[key] && Number.parseInt(variationQuantities[key]) > 0).length > 0) && (
                  <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200">
                    <div className="flex items-center space-x-3 mb-3">
                      <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center">
                        <CheckCircle className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <h4 className="font-medium text-green-800">Selected Items</h4>
                        <p className="text-sm text-green-600">Ready to transfer</p>
                      </div>
                    </div>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {/* Regular Products */}
                      {Object.entries(productQuantities)
                        .filter(([productId, quantity]) => quantity && Number.parseInt(quantity) > 0)
                        .map(([productId, quantity]) => (
                          <div key={productId} className="flex items-center justify-between p-2 bg-white rounded-lg border border-green-200">
                            <div className="flex items-center space-x-3 flex-1 min-w-0">
                              <Package className="h-4 w-4 text-green-600 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-gray-900 text-sm truncate">{getProductName(productId)}</p>
                                <p className="text-xs text-gray-500">SKU: {getProductSku(productId)}</p>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <span className="text-sm font-medium text-green-600">{quantity} units</span>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setProductQuantities(prev => {
                                    const newQuantities = { ...prev }
                                    delete newQuantities[productId]
                                    return newQuantities
                                  })
                                }}
                                className="h-6 w-6 p-0 border-red-300 text-red-600 hover:bg-red-50"
                              >
                                <XCircle className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
                        
                      {/* Variations */}
                      {Object.entries(variationQuantities)
                        .filter(([variationId, quantity]) => quantity && Number.parseInt(quantity) > 0)
                        .map(([variationId, quantity]) => {
                          // Find the product that contains this variation in productsWithVariations
                          const productWithVariations = productsWithVariations.find(p => 
                            p.variations.some(v => v.variation_id === variationId)
                          )
                          const variation = productWithVariations?.variations.find(v => v.variation_id === variationId)
                          
                          return (
                            <div key={variationId} className="flex items-center justify-between p-2 bg-white rounded-lg border border-purple-200">
                              <div className="flex items-center space-x-3 flex-1 min-w-0">
                                <div className="relative">
                                  <Package className="h-4 w-4 text-purple-600 flex-shrink-0" />
                                  <div className="absolute -top-1 -right-1 w-2 h-2 bg-purple-500 rounded-full" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1">
                                    <p className="font-medium text-gray-900 text-sm truncate">{productWithVariations?.product_name}</p>
                                    <span className="text-xs text-purple-600">•</span>
                                    <p className="text-xs font-medium text-purple-600">
                                      {variation?.color && (
                                        <span className="inline-flex items-center">
                                          <span 
                                            className="inline-block w-2 h-2 rounded-full mr-1" 
                                            style={{ backgroundColor: variation.color }}
                                          />
                                          {variation.color}
                                        </span>
                                      )}
                                      {variation?.color && variation?.size && " / "}
                                      {variation?.size}
                                    </p>
                                  </div>
                                  <p className="text-xs text-gray-500">SKU: {variation?.variation_sku || productWithVariations?.product_sku}</p>
                                </div>
                              </div>
                              <div className="flex items-center space-x-2">
                                <span className="text-sm font-medium text-purple-600">{quantity} units</span>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setVariationQuantities(prev => {
                                      const newQuantities = { ...prev }
                                      delete newQuantities[variationId]
                                      return newQuantities
                                    })
                                  }}
                                  className="h-6 w-6 p-0 border-red-300 text-red-600 hover:bg-red-50"
                                >
                                  <XCircle className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          )
                        })}
                    </div>
                  </div>
                )}

                {/* Reason */}
                <div className="space-y-2">
                  <Label htmlFor="reason">Reason for Transfer (Optional)</Label>
                  <Textarea
                    id="reason"
                    placeholder="e.g., High demand in destination branch, Rebalancing inventory..."
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="rounded-xl border-gray-200 focus:border-pink-300 focus:ring-pink-200"
                    rows={3}
                  />
                </div>

                {/* Execute Transfer Button */}
                <Button
                  type="submit"
                  className="w-full bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white rounded-xl py-3 font-medium transition-all duration-200 shadow-lg"
                  disabled={
                    // Branch validation
                    (isOwner ? (!fromBranch || !toBranch) : !toBranch) || 
                    // Ensure at least one product or variation is selected
                    (Object.keys(productQuantities).filter(key => productQuantities[key] && Number.parseInt(productQuantities[key]) > 0).length === 0 && 
                     Object.keys(variationQuantities).filter(key => variationQuantities[key] && Number.parseInt(variationQuantities[key]) > 0).length === 0) || 
                    // Validate product quantities
                    Object.keys(productQuantities).some(key => {
                      const quantity = Number.parseInt(productQuantities[key] || "0")
                      const product = products.find(p => p.id === key)
                      return quantity > 0 && product && quantity > product.total_stock
                    }) ||
                    // Validate variation quantities
                    Object.keys(variationQuantities).some(key => {
                      const quantity = Number.parseInt(variationQuantities[key] || "0")
                      // Find the product that contains this variation
                      const product = products.find(p => 
                        p.variations?.some(v => v.variation_id === key)
                      )
                      const variation = product?.variations?.find(v => v.variation_id === key)
                      return quantity > 0 && variation && quantity > variation.quantity
                    }) ||
                    isSubmitting
                  }
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing Transfer...
                    </>
                  ) : (
                    <>
                      <ArrowRightLeft className="h-4 w-4 mr-2" />
                      Execute Transfer
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Product Selection */}
        <div className="lg:col-span-2">
          <Card className="border-0 shadow-xl bg-gradient-to-br from-white to-gray-50">
            <CardHeader className="bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-indigo-100">
              <CardTitle className="flex items-center space-x-2 text-gray-800">
                <div className="w-10 h-10 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-lg flex items-center justify-center">
                  <Package className="h-5 w-5 text-white" />
                </div>
                <span>Product Selection</span>
              </CardTitle>
              <CardDescription className="text-gray-600">
                Select products to transfer from available inventory
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              {/* Product Search and Filters */}
              <div className="space-y-4 mb-6">
                {/* Advanced Product Search */}
                <div className="relative">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      placeholder="Search products by name, SKU, brand, category, color, or size..."
                      value={productSearchTerm}
                      onChange={(e) => setProductSearchTerm(e.target.value)}
                      className="pl-10 pr-20 rounded-xl border-gray-200 focus:border-pink-300 focus:ring-pink-200"
                      disabled={isOwner ? !fromBranch : !toBranch}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          // Trigger search - the filtering is already handled by the useMemo
                        }
                      }}
                    />
                    <div className="absolute right-8 top-1/2 transform -translate-y-1/2 flex items-center space-x-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600"
                        title="Search Help: < 3 chars = Exact match, 3-5 chars = Partial match, 6+ chars = Phrase match"
                      >
                        ?
                      </Button>
                      {productSearchTerm && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setProductSearchTerm("")}
                          className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600"
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Search Type Indicator */}
                  {productSearchTerm.trim() && (
                    <div className="mt-2 p-2 bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg">
                      <div className="flex items-center space-x-2">
                        <Search className="h-4 w-4 text-blue-600" />
                        <span className="text-sm font-medium text-blue-800">
                          {productSearchTerm.trim().length < 3 ? 'Enhanced Match' :
                           productSearchTerm.trim().length <= 5 ? 'Partial Match' : 'Phrase Match'}
                        </span>
                        <span className="text-xs text-blue-600">
                          {productSearchTerm.trim().length < 3 ? 'Finding exact matches' :
                           productSearchTerm.trim().length <= 5 ? 'Finding partial matches' : 'Finding phrase matches'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Category Filter */}
                {getAvailableProducts().length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-700">Filter by Category</Label>
                    <div className="flex flex-wrap gap-2">
                      {Array.from(new Set(getAvailableProducts().map(p => p.category_name))).map(category => (
                        <Button
                          key={category}
                          variant={productSelectedCategories.has(category) ? "default" : "outline"}
                          size="sm"
                          onClick={() => {
                            const newSelected = new Set(productSelectedCategories)
                            if (newSelected.has(category)) {
                              newSelected.delete(category)
                            } else {
                              newSelected.add(category)
                            }
                            setProductSelectedCategories(newSelected)
                          }}
                          className="text-xs"
                        >
                          {category}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {/* View Mode and Clear Filters */}
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-700">
                    Available Products ({allProducts.length})
                  </p>
                  <div className="flex items-center space-x-2">
                    {(productSearchTerm.trim() || productSelectedCategories.size > 0) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setProductSearchTerm("")
                          setProductSelectedCategories(new Set())
                        }}
                        className="h-8 px-3 text-gray-600 hover:text-gray-800"
                      >
                        <FilterX className="h-4 w-4 mr-1" />
                        Clear Filters
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
                      className="h-8 px-3"
                    >
                      {viewMode === 'grid' ? (
                        <>
                          <List className="h-4 w-4 mr-1" />
                          List
                        </>
                      ) : (
                        <>
                          <Grid3X3 className="h-4 w-4 mr-1" />
                          Grid
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Product Grid - 3 per row */}
              {currentProducts.length > 0 && (
                <div className="space-y-4">
                  <div className={viewMode === 'grid' ? 
                    "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" : 
                    "space-y-3"
                  }>
                                        {currentProducts.map((productItem) => {
                      if (productItem.type === 'variation') {
                        const product = productItem.data as ProductWithVariations
                        const productId = product.product_id
                        const productName = product.product_name
                        const productSku = product.product_sku
                        const productType = product.product_type
                        const categoryName = product.category_name
                        const brand = product.brand
                        const ageRange = product.age_range
                        const gender = product.gender
                        
                        // Calculate total stock from variations
                        const totalStock = product.variations.reduce((sum, v) => sum + v.quantity, 0)
                        
                        // Get price from first variation
                        const price = product.variations[0]?.price || 0

                        return (
                          <div
                            key={productId}
                        className={`group relative ${
                          viewMode === 'grid' 
                            ? 'p-3 border border-gray-200 rounded-lg hover:border-green-300 hover:shadow-md transition-all duration-200 cursor-pointer bg-white' 
                            : 'p-3 border border-gray-200 rounded-lg hover:border-green-300 transition-all duration-200 cursor-pointer bg-white flex items-center space-x-4'
                        } ${
                              productQuantities[productId] && Number.parseInt(productQuantities[productId]) > 0
                            ? 'border-green-500 bg-green-50 shadow-lg' 
                                : selectedProduct === productId
                            ? 'border-green-400 bg-green-25 shadow-md'
                            : ''
                        } ${
                              expandedProducts.has(productId) ? 'border-purple-500' : ''
                        }`}
                        onClick={() => {
                          if (productType === 'variation') {
                            // For single variations, auto-select the variation instead of toggling expansion
                            if (product.variations.length === 1) {
                              const singleVariation = product.variations[0]
                              setSelectedVariation(singleVariation.variation_id)
                              // Also expand to show the variation details
                              const newExpanded = new Set(expandedProducts)
                              newExpanded.add(productId)
                              setExpandedProducts(newExpanded)
                            } else {
                              // For multiple variations, toggle expansion
                              const newExpanded = new Set(expandedProducts)
                              if (newExpanded.has(productId)) {
                                newExpanded.delete(productId)
                              } else {
                                newExpanded.add(productId)
                              }
                              setExpandedProducts(newExpanded)
                            }
                          } else {
                            // For uniform products, select directly
                            setSelectedProduct(productId)
                          }
                        }}
                      >
                        {/* Product Icon */}
                        <div className={viewMode === 'grid' ? 'mb-3' : 'flex-shrink-0'}>
                          <div className={`relative ${
                            viewMode === 'grid' 
                              ? 'w-full h-16 rounded-lg bg-gradient-to-r from-pink-100 to-purple-100 flex items-center justify-center mb-2' 
                              : 'w-14 h-14 rounded-lg bg-gradient-to-r from-pink-100 to-purple-100 flex items-center justify-center'
                          }`}>
                            <Package className={`${viewMode === 'grid' ? 'h-6 w-6' : 'h-5 w-5'} text-pink-500`} />
                            {/* Variation Count Badge - Only for variation products */}
                            {productType === 'variation' && (
                              <div className="absolute -top-2 -right-2">
                                <Badge 
                                  variant="secondary" 
                                  className={`text-white text-xs px-1.5 py-0.5 rounded-full shadow-sm ${
                                    product.variations.length === 1 
                                      ? 'bg-indigo-600' // Different color for single variations
                                      : 'bg-purple-600' // Original color for multiple variations
                                  }`}
                                >
                                  {product.variations.length}
                                </Badge>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Product Info */}
                        <div className={`${viewMode === 'grid' ? 'space-y-3' : 'flex-1'}`}>
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <h3 className={`font-medium text-gray-900 ${viewMode === 'grid' ? 'text-sm' : 'text-base'} truncate`}>
                                      {productName}
                                </h3>
    
                              </div>
                                  <p className="text-sm text-gray-500 mt-1">SKU: {productSku}</p>
                            </div>
                            <div className="flex flex-col items-end space-y-1">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">
                                      {categoryName}
                                </Badge>
                                    {productType === 'variation' && (
                                  <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="h-7 w-7 p-0 rounded-md border-purple-300 bg-purple-50 hover:bg-purple-100 hover:border-purple-400 shadow-sm"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      // For single variations, auto-select on click
                                      if (product.variations.length === 1) {
                                        const singleVariation = product.variations[0]
                                        setSelectedVariation(singleVariation.variation_id)
                                      }
                                      // Always toggle expansion for both single and multiple variations
                                      const newExpanded = new Set(expandedProducts)
                                      if (newExpanded.has(productId)) {
                                        newExpanded.delete(productId)
                                      } else {
                                        newExpanded.add(productId)
                                      }
                                      setExpandedProducts(newExpanded)
                                    }}
                                  >
                                        {expandedProducts.has(productId) ? (
                                      <ChevronUp className="h-4 w-4 text-purple-700 font-bold" />
                                    ) : (
                                      <ChevronDown className="h-4 w-4 text-purple-700 font-bold" />
                                    )}
                                  </Button>
                                )}
                              </div>
                              <div className="text-right">
                                    {productType !== 'variation' && (
                                      <p className="font-bold text-lg text-green-600">{Number(price).toFixed(0)} ብር</p>
                                    )}
                              </div>
                            </div>
                          </div>

                            {/* Product Details */}
                          <div className={`${viewMode === 'grid' ? 'space-y-2' : 'flex items-center space-x-4 mt-2'}`}>
                            {/* Stock Status - Only for uniform products */}
                            {productType !== 'variation' && (
                            <div className="flex items-center space-x-2">
                              <div className={`w-2 h-2 rounded-full ${
                                      totalStock === 0 ? 'bg-red-500' :
                                      totalStock <= 5 ? 'bg-yellow-500' : 'bg-green-500'
                              }`} />
                              <span className={`text-xs ${
                                      totalStock === 0 ? 'text-red-600' :
                                      totalStock <= 5 ? 'text-yellow-600' : 'text-green-600'
                              } font-medium`}>
                                      {totalStock === 0 ? 'Out of Stock' :
                                       totalStock <= 5 ? 'Low Stock' : 'In Stock'}
                              </span>
                              <span className="text-xs text-gray-500">
                                      ({totalStock} available)
                              </span>
                            </div>
                            )}

                            {/* Product Tags - Only for uniform products */}
                            {productType !== 'variation' && (
                            <div className="flex flex-wrap gap-1">
                                {brand && (
                                <Badge variant="secondary" className="text-xs">
                                    {brand}
                                </Badge>
                              )}
                            </div>
                            )}
                            
                            {/* Variation Info - Only for variation products */}
                            {productType === 'variation' && (
                            <div className="flex flex-wrap gap-1">
                                {brand && (
                                <Badge variant="secondary" className="text-xs">
                                    {brand}
                                </Badge>
                              )}
                                {gender && (
                                  <Badge variant="outline" className="text-xs bg-purple-50 text-purple-600 border-purple-200 capitalize">
                                    {gender}
                                  </Badge>
                                )}
                                <Badge 
                                  variant="outline" 
                                  className={`text-xs transition-colors px-2 py-1 ${
                                    product.variations.length === 1
                                      ? 'bg-indigo-50 text-indigo-600 border-indigo-200 hover:bg-indigo-100'
                                      : 'bg-purple-50 text-purple-600 border-purple-200 hover:bg-purple-100'
                                  }`}
                                >
                                  <Package className="h-3 w-3 mr-1" />
                                  {product.variations.length === 1 
                                    ? '1 variation' 
                                    : `${product.variations.length} variations`
                                  }
                                </Badge>
                            </div>
                            )}
                          </div>

                          {/* Quantity Input - Only show when selected */}
                              {selectedProduct === productId && (
                            <div className={`${viewMode === 'grid' ? 'mt-3' : 'ml-4'}`}>
                              <div className="space-y-2">
                                <Label className="text-xs font-medium text-green-700">Transfer Quantity</Label>
                                <div className="flex items-center space-x-2">
                                  <Input
                                    type="number"
                                    min="1"
                                        max={totalStock}
                                    placeholder="0"
                                        value={productQuantities[productId] || ""}
                                    onChange={(e) => {
                                      e.stopPropagation()
                                      const value = e.target.value
                                      const numValue = Number.parseInt(value)
                                      
                                      // Validate quantity
                                          if (value && (numValue > totalStock || numValue < 1)) {
                                        // Don't update if invalid
                                        return
                                      }
                                      
                                      setProductQuantities(prev => ({
                                        ...prev,
                                            [productId]: value
                                      }))
                                    }}
                                    className={`flex-1 h-8 text-sm rounded-lg focus:ring-green-200 ${
                                          productQuantities[productId] && Number.parseInt(productQuantities[productId]) > totalStock
                                        ? 'border-red-500 focus:border-red-500 bg-red-50'
                                        : 'border-green-300 focus:border-green-500'
                                    }`}
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                  <span className={`text-xs ${
                                        productQuantities[productId] && Number.parseInt(productQuantities[productId]) > totalStock
                                      ? 'text-red-500'
                                      : 'text-gray-500'
                                      }`}>/ {totalStock}</span>
                                </div>
                              </div>
                            </div>
                          )}

                                                    {/* Select Button - Only show when not selected and not a variation product */}
                          {selectedProduct !== productId && productType !== 'variation' && (
                            <div className={`${viewMode === 'grid' ? 'mt-3' : 'ml-4'}`}>
                              <Button
                                size="sm"
                                variant="outline"
                                className="w-full border-gray-300 hover:border-green-300 hover:bg-green-50"
                                onClick={(e) => {
                                  e.stopPropagation()
                                      setSelectedProduct(productId)
                                }}
                              >
                                <Plus className="h-3 w-3 mr-1" />
                                Select
                              </Button>
                            </div>
                          )}
                          
                                                    {/* Variation Products - Show when expanded */}
                          {productType === 'variation' && expandedProducts.has(productId) && (
                            <div className="mt-3 space-y-2 border-t border-purple-200 pt-3">
                              <h4 className="text-sm font-medium text-purple-700 flex items-center">
                                <Layers className="h-3 w-3 mr-1" />
                                Variations
                              </h4>
                              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                                {product.variations.map((variation) => (
                                  <div 
                                    key={variation.variation_id} 
                                    className={`p-2 rounded-md border ${selectedVariation === variation.variation_id ? 'border-purple-500 bg-purple-50' : 'border-gray-200'} hover:border-purple-300 hover:bg-purple-50 transition-all duration-200`}
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setSelectedVariation(variation.variation_id)
                                    }}
                                  >
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center space-x-2">
                                        {variation.color && (
                                          <div 
                                            className="w-4 h-4 rounded-full border border-gray-300" 
                                            style={{ backgroundColor: variation.color }}
                                            title={variation.color}
                                          />
                                        )}
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-1 flex-wrap">
                                          <p className="text-sm font-medium">
                                              {variation.size || ''}
                                            </p>
                                            {/* Stock Status for this variation */}
                                            <div className="flex items-center space-x-1">
                                              <div className={`w-1.5 h-1.5 rounded-full ${
                                                variation.quantity === 0 ? 'bg-red-500' :
                                                variation.quantity <= 5 ? 'bg-yellow-500' : 'bg-green-500'
                                              }`} />
                                              <span className={`text-xs ${
                                                variation.quantity === 0 ? 'text-red-600' :
                                                variation.quantity <= 5 ? 'text-yellow-600' : 'text-green-600'
                                              } font-medium`}>
                                                {variation.quantity}
                                              </span>
                                        </div>
                                      </div>
                                          {/* Additional details in compact format */}
                                          <div className="flex items-center gap-2 mt-1">
                                            {brand && (
                                              <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                                                {brand}
                                              </span>
                                            )}
                                            {ageRange && (
                                              <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                                                {ageRange}
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                      <div className="flex flex-col items-end space-y-0.5 ml-2">
                                        <p className="text-sm font-semibold text-green-600 leading-none">{Number(variation.price).toFixed(0)}</p>
                                        {variation.purchase_price !== undefined && (
                                          <p className="text-[10px] leading-none text-gray-500">{Number(variation.purchase_price).toFixed(0)}</p>
                                        )}
                                      </div>
                                    </div>
                                    
                                    {/* Quantity Input for Variation */}
                                    {selectedVariation === variation.variation_id && (
                                      <div className="mt-2">
                                        <div className="flex items-center space-x-2">
                                          <Input
                                            type="number"
                                            min="1"
                                            max={variation.quantity}
                                            placeholder="0"
                                            value={variationQuantities[variation.variation_id] || ""}
                                            onChange={(e) => {
                                              e.stopPropagation()
                                              const value = e.target.value
                                              const numValue = Number.parseInt(value)
                                              
                                              // Validate quantity
                                              if (value && (numValue > variation.quantity || numValue < 1)) {
                                                // Don't update if invalid
                                                return
                                              }
                                              
                                              setVariationQuantities(prev => ({
                                                ...prev,
                                                [variation.variation_id]: value
                                              }))
                                            }}
                                            className={`flex-1 h-8 text-sm rounded-lg focus:ring-purple-200 ${
                                              variationQuantities[variation.variation_id] && Number.parseInt(variationQuantities[variation.variation_id]) > variation.quantity
                                                ? 'border-red-500 focus:border-red-500 bg-red-50'
                                                : 'border-purple-300 focus:border-purple-500'
                                            }`}
                                            onClick={(e) => e.stopPropagation()}
                                          />
                                          <span className={`text-xs ${
                                            variationQuantities[variation.variation_id] && Number.parseInt(variationQuantities[variation.variation_id]) > variation.quantity
                                              ? 'text-red-500'
                                              : 'text-gray-500'
                                          }`}>/ {variation.quantity}</span>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Selection Overlay */}
                            {selectedProduct === productId && (
                          <div className="absolute inset-0 bg-gradient-to-r from-green-500/10 to-emerald-500/10 border-2 border-green-500 rounded-lg pointer-events-none" />
                        )}
                      </div>
                        )
                      } else {
                        // Handle regular Product (Uniform)
                        const product = productItem.data as Product
                        const productId = product.id
                        const productName = product.name
                        const productSku = product.sku
                        const productType = product.product_type
                        const categoryName = product.category_name
                        const brand = product.brand
                        const ageRange = product.age_range
                        const gender = product.gender
                        const totalStock = product.total_stock
                        const price = product.price
                        const purchasePrice = product.purchase_price
                        const color = product.color
                        const size = product.size
                        const description = product.description

                        return (
                          <div
                            key={productId}
                            className={`group relative ${
                              viewMode === 'grid' 
                                ? 'p-3 border border-gray-200 rounded-lg hover:border-green-300 hover:shadow-md transition-all duration-200 cursor-pointer bg-white' 
                                : 'p-3 border border-gray-200 rounded-lg hover:border-green-300 transition-all duration-200 cursor-pointer bg-white flex items-center space-x-4'
                            } ${
                              productQuantities[productId] && Number.parseInt(productQuantities[productId]) > 0
                                ? 'border-green-500 bg-green-50 shadow-lg' 
                                : selectedProduct === productId
                                ? 'border-green-400 bg-green-25 shadow-md'
                                : ''
                            } ${
                              expandedProducts.has(productId) ? 'border-purple-500' : ''
                            }`}
                            onClick={() => {
                              // For uniform products, select directly
                              setSelectedProduct(productId)
                            }}
                          >
                            {/* Product Icon */}
                            <div className={viewMode === 'grid' ? 'mb-3' : 'flex-shrink-0'}>
                              <div className={`${
                                viewMode === 'grid' 
                                  ? 'w-full h-16 rounded-lg bg-gradient-to-r from-pink-100 to-purple-100 flex items-center justify-center mb-2' 
                                  : 'w-14 h-14 rounded-lg bg-gradient-to-r from-pink-100 to-purple-100 flex items-center justify-center'
                              }`}>
                                <Package className={`${viewMode === 'grid' ? 'h-6 w-6' : 'h-5 w-5'} text-pink-500`} />
                              </div>
                            </div>

                            {/* Product Info */}
                            <div className={`${viewMode === 'grid' ? 'space-y-3' : 'flex-1'}`}>
                              {/* Header with Name and Category */}
                              <div className="flex items-start justify-between">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <h3 className={`font-semibold text-gray-900 ${viewMode === 'grid' ? 'text-sm' : 'text-base'} truncate`}>
                                      {productName}
                                    </h3>
                                  </div>
                                  <div className="flex items-center gap-2 mb-2">
                                    <Badge variant="outline" className="text-xs bg-blue-50 text-blue-600 border-blue-200">
                                      {categoryName}
                                    </Badge>
                                    {gender && (
                                      <Badge variant="outline" className="text-xs bg-purple-50 text-purple-600 border-purple-200 capitalize">
                                        {gender}
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                                <div className="flex flex-col items-end space-y-1">
                                  <div className="text-right">
                                    <p className="font-bold text-lg text-green-600">{Number(price).toFixed(0)} ብር</p>
                                    {purchasePrice && (
                                      <p className="text-xs text-gray-500 font-medium">
                                         {Number(purchasePrice).toFixed(0)} ብር
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Product Details Grid */}
                              <div className="space-y-2">
                                {/* SKU and Stock Status Row */}
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-gray-500 font-medium">SKU:</span>
                                    <span className="text-xs text-gray-700 font-mono bg-gray-50 px-2 py-1 rounded">
                                      {productSku}
                                    </span>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <div className={`w-2 h-2 rounded-full ${
                                      totalStock === 0 ? 'bg-red-500' :
                                      totalStock <= 5 ? 'bg-yellow-500' : 'bg-green-500'
                                    }`} />
                                    <span className={`text-xs ${
                                      totalStock === 0 ? 'text-red-600' :
                                      totalStock <= 5 ? 'text-yellow-600' : 'text-green-600'
                                    } font-medium`}>
                                      {totalStock} available
                                    </span>
                                  </div>
                                </div>

                                {/* Attributes Row */}
                                <div className="flex flex-wrap gap-2">
                                  {brand && (
                                    <div className="flex items-center gap-1">
                                      <span className="text-xs text-gray-700 bg-yellow-50 px-2 py-1 rounded border border-yellow-200">
                                        {brand}
                                      </span>
                                    </div>
                                  )}
                                  {ageRange && (
                                    <div className="flex items-center gap-1">
                                      <span className="text-xs text-gray-700 bg-green-50 px-2 py-1 rounded border border-green-200">
                                        {ageRange}
                                      </span>
                                    </div>
                                  )}
                                  {color && (
                                    <div className="flex items-center gap-1">
                                      <div 
                                        className={`w-4 h-4 rounded-full border-2 border-gray-300 shadow-sm ${getColorClass(color)}`}
                                        style={getColorStyle(color)}
                                        title={`Color: ${color}`}
                                      />
                                    </div>
                                  )}
                                  {size && (
                                    <div className="flex items-center gap-1">
                                      <span className="text-xs text-gray-700 bg-indigo-50 px-2 py-1 rounded border border-indigo-200">
                                        {size}
                                      </span>
                                    </div>
                                  )}
                                </div>

                                {/* Description */}
                                {description && (
                                  <div className="mt-2">
                                    <p className="text-xs text-gray-600 bg-gray-50 p-2 rounded border border-gray-200 line-clamp-2">
                                      {description}
                                    </p>
                                  </div>
                                )}
                              </div>

                              {/* Quantity Input - Only show when selected */}
                              {selectedProduct === productId && (
                                <div className="mt-2 p-2 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200">
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                      <Label className="text-xs font-medium text-green-700">Transfer Quantity</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                      <Input
                                        type="number"
                                        min="1"
                                        max={totalStock}
                                        placeholder="Enter quantity"
                                        value={productQuantities[productId] || ""}
                                        onChange={(e) => {
                                          e.stopPropagation()
                                          const value = e.target.value
                                          const numValue = Number.parseInt(value)
                                          
                                          // Validate quantity
                                          if (value && (numValue > totalStock || numValue < 1)) {
                                            // Don't update if invalid
                                            return
                                          }
                                          
                                          setProductQuantities(prev => ({
                                            ...prev,
                                            [productId]: value
                                          }))
                                        }}
                                        className={`flex-1 h-8 text-xs rounded-md focus:ring-green-200 ${
                                          productQuantities[productId] && Number.parseInt(productQuantities[productId]) > totalStock
                                            ? 'border-red-500 focus:border-red-500 bg-red-50'
                                            : 'border-green-300 focus:border-green-500 bg-white'
                                        }`}
                                        onClick={(e) => e.stopPropagation()}
                                      />
                                      <span className={`text-xs font-medium ${
                                        productQuantities[productId] && Number.parseInt(productQuantities[productId]) > totalStock
                                          ? 'text-red-600'
                                          : 'text-green-600'
                                      }`}>
                                        / {totalStock}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Select Button - Only show when not selected */}
                              {selectedProduct !== productId && (
                                <div className="mt-3">
                                  <div className="pointer-events-none absolute inset-x-0 bottom-0 rounded-b-lg bg-gradient-to-t from-white/80 to-transparent h-8" />
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="absolute bottom-2 right-2 left-2 h-8 text-xs border-green-300 text-green-600 hover:border-green-400 hover:bg-green-50 hover:text-green-700 transition-all duration-200 font-medium"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setSelectedProduct(productId)
                                    }}
                                  >
                                    Select for Transfer
                                  </Button>
                                </div>
                              )}
                            </div>

                            {/* Selection Overlay */}
                            {selectedProduct === productId && (
                              <div className="absolute inset-0 bg-gradient-to-r from-green-500/10 to-emerald-500/10 border-2 border-green-500 rounded-lg pointer-events-none" />
                            )}
                          </div>
                        )
                      }
                    })}
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(1)}
                          disabled={currentPage === 1}
                          className="h-8 px-2"
                        >
                          <ChevronsLeft className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(currentPage - 1)}
                          disabled={currentPage === 1}
                          className="h-8 px-2"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                      </div>
                      
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
                              className="h-8 w-8 p-0"
                            >
                              {pageNum}
                            </Button>
                          )
                        })}
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(currentPage + 1)}
                          disabled={currentPage === totalPages}
                          className="h-8 px-2"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(totalPages)}
                          disabled={currentPage === totalPages}
                          className="h-8 px-2"
                        >
                          <ChevronsRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {allProducts.length === 0 && (
                <div className="text-center py-12">
                  <Package className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No products found</h3>
                  <p className="text-gray-500">Try adjusting your search or check if products are available</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Transfer History */}
      <Card className="border-0 shadow-xl bg-gradient-to-br from-white to-gray-50">
        <CardHeader className="bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-indigo-100">
          <CardTitle className="flex items-center space-x-2 text-gray-800">
            <div className="w-10 h-10 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-lg flex items-center justify-center">
              <Clock className="h-5 w-5 text-white" />
            </div>
            <span>Transfer History</span>
          </CardTitle>
          <CardDescription className="text-gray-600">Recent transfers - all transfers are completed instantly</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border border-gray-200 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="font-semibold">Date</TableHead>
                  <TableHead className="font-semibold">Product</TableHead>
                  <TableHead className="font-semibold">From</TableHead>
                  <TableHead className="font-semibold">To</TableHead>
                  <TableHead className="font-semibold">Quantity</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="font-semibold">Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {processedTransfers.map((transfer) => (
                  <TableRow key={transfer.id} className="hover:bg-gray-50">
                    <TableCell className="font-medium">
                      {new Date(transfer.requested_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      {transfer.items.map((item) => item.product_name).join(", ")}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-blue-50 text-blue-700">
                        {transfer.from_branch_name || getBranchName(transfer.from_branch_id)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-green-50 text-green-700">
                        {transfer.to_branch_name || getBranchName(transfer.to_branch_id)}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      {transfer.items.reduce((sum, item) => sum + item.quantity, 0)}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(transfer.status)}
                    </TableCell>
                    <TableCell className="text-gray-600 max-w-xs truncate">{transfer.reason}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
