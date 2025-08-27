"use client"

import type React from "react"
import { getBranchIdForDatabase } from "@/lib/utils"

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
  Layers,
  X
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
  product_id?: string
  name: string
  product_name?: string
  sku: string
  product_sku?: string
  price: number
  purchase_price?: number
  cost_price?: number
  current_stock: number
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
    id?: string
    variation_id: string
    variation_sku: string
    color?: string
    size?: string
    price: number
    cost_price?: number
    purchase_price?: number
    quantity: number
    min_stock_level?: number
    max_stock_level?: number
    stock_status?: string
    branch_name?: string
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
  const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams()
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
  const [productQuantities, setProductQuantities] = useState<Record<string, string>>({})
  const [variationQuantities, setVariationQuantities] = useState<Record<string, string>>({})
  const [productSelectedCategories, setProductSelectedCategories] = useState<Set<string>>(new Set())
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(12) // 4 rows of 3 items each
  
  const formRef = useRef<HTMLFormElement>(null)

  // Calculate transfer stats
  const transferStats = useMemo((): TransferStats => {
    const total = transfers.length
    const completed = transfers.filter(t => t.status === 'completed').length
    const pending = transfers.filter(t => t.status === 'pending').length
    const totalItems = transfers.reduce((sum, t) => 
      sum + (t.items ?? []).reduce((itemSum, item) => itemSum + item.quantity, 0), 0
    )
    
    // Calculate total value based on product prices
    const totalValue = transfers.reduce((sum, t) => {
      return sum + (t.items ?? []).reduce((itemSum, item) => {
        // Find the product to get its price
        const product = products.find(p => p.id === item.product_id)
        const variationProduct = productsWithVariations.find(p => p.product_id === item.product_id)
        
        let price = 0
        if (item.variation_id && variationProduct) {
          // For variations, find the specific variation price
          const variation = variationProduct.variations.find(v => v.variation_id === item.variation_id)
          price = variation?.price || 0
        } else if (product) {
          // For uniform products, use the product price
          price = product.price || 0
        }
        
        return itemSum + (item.quantity * price)
      }, 0)
    }, 0)

    return {
      total_transfers: total,
      completed_transfers: completed,
      pending_transfers: pending,
      total_items_transferred: totalItems,
      total_value_transferred: totalValue
    }
  }, [transfers, products, productsWithVariations])

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
      return products.filter((p) => (p.current_stock || 0) > 0)
    } else {
      // For employees, only show products from their branch
      return products.filter((p) => (p.current_stock || 0) > 0)
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

  // Single consolidated useEffect for fetching transfer data
  useEffect(() => {
    fetchData()
  }, [currentBranch, fromBranch])

  // Preselect a product when navigated with ?product_id=
  useEffect(() => {
    const pid = searchParams.get('product_id')
    const qty = searchParams.get('qty')
    if (pid) {
      setProductQuantities(prev => ({ ...prev, [pid]: prev[pid] || (qty || "1") }))
    }
  }, [])

  // After products load, focus the selected product by setting the search term
  useEffect(() => {
    const pid = searchParams.get('product_id')
    const qty = searchParams.get('qty')
    if (!pid || products.length === 0) return
    const p: any = products.find((pr: any) => pr.id === pid || pr.product_id === pid)
    if (p) {
      const name = p.name || p.product_name || ''
      if (name) {
        setProductSearchTerm(name)
        setCurrentPage(1)
      }
      setProductQuantities(prev => ({ ...prev, [pid]: prev[pid] || (qty || "1") }))
    }
  }, [products])

  const fetchData = async () => {
    setIsLoading(true)
    try {
      // Use optimized single API call instead of multiple calls
      // Use utility function for branch mapping
      const { getBranchIdForDatabase } = await import("@/lib/utils")

      const params: any = {
        from_branch_id: currentBranch !== "all" 
          ? getBranchIdForDatabase(currentBranch) 
          : getBranchIdForDatabase(fromBranch || "franko")
      }

      

      const response = await apiClient.getTransferOptimized(params)
      
      
      
      if (response.success && response.data) {
        const data = response.data as any
        

        
        // Set products (uniform products)
        if (data.products && Array.isArray(data.products)) {
  
          setProducts(data.products)
        } else {
          setProducts([])
        }
        
        // Set transfers
        if (data.transfers && Array.isArray(data.transfers)) {
  
          setTransfers(data.transfers)
        } else {
          setTransfers([])
        }
        
        // Set branches
        if (data.branches && Array.isArray(data.branches)) {
  
          setBranches(data.branches)
        } else {
          setBranches([])
        }
        
        // Handle variations separately
        if (data.variations && Array.isArray(data.variations)) {
  
          
          // Group variations by product
          const variationsByProduct = new Map<string, any[]>()
          
          data.variations.forEach((variation: any) => {
            if (!variationsByProduct.has(variation.product_id)) {
              variationsByProduct.set(variation.product_id, [])
            }
            variationsByProduct.get(variation.product_id)!.push(variation)
          })
          
          // Create ProductWithVariations objects
          const productsWithVariations: ProductWithVariations[] = []
          
          variationsByProduct.forEach((variations, productId) => {
            const firstVariation = variations[0]
            const productWithVariations: ProductWithVariations = {
              product_id: productId,
              product_name: firstVariation.product_name,
              product_sku: firstVariation.product_sku || firstVariation.sku,
              product_type: firstVariation.product_type,
              brand: firstVariation.brand,
              age_range: firstVariation.age_range,
              gender: firstVariation.gender,
              description: firstVariation.description,
              image_url: firstVariation.image_url,
              category_name: firstVariation.category_name,
              variations: variations
            }
            productsWithVariations.push(productWithVariations)
          })
          
  
          setProductsWithVariations(productsWithVariations)
        } else {
          setProductsWithVariations([])
        }
              } else {
        // Fallback to individual API calls
        const [inventoryResponse, transfersResponse, branchesResponse] = await Promise.all([
          apiClient.getInventory({ branch_id: currentBranch !== "all" ? getBranchIdForDatabase(currentBranch) : (fromBranch ? getBranchIdForDatabase(fromBranch) : undefined) }),
          apiClient.getTransfers({ from_branch_id: currentBranch !== "all" ? getBranchIdForDatabase(currentBranch) : (fromBranch ? getBranchIdForDatabase(fromBranch) : undefined) }),
          apiClient.getBranches()
        ])
        

        
        if (inventoryResponse.success && inventoryResponse.data) {
          setProducts(inventoryResponse.data as Product[])
        }
        
        if (transfersResponse.success && transfersResponse.data) {
          setTransfers(transfersResponse.data.data as unknown as Transfer[])
        }
        
        if (branchesResponse.success && branchesResponse.data) {
          setBranches(branchesResponse.data as Branch[])
        }
      }
    } catch (error) {
      console.error('Error fetching transfer data:', error)
      toast({
        title: t("error"),
        description: t("error"),
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
        return product && item.quantity > product.current_stock
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
      const fromBranchResolved = isOwner ? (fromBranch || currentBranch) : (userBranch || currentBranch)
      const toBranchResolved = toBranch || (currentBranch === 'franko' ? 'mebrat-hayl' : 'franko')

      const transferData = {
        from_branch_id: getBranchIdForDatabase(fromBranchResolved),
        to_branch_id: getBranchIdForDatabase(toBranchResolved),
        reason: reason || "Transfer initiated by user",
        items: selectedItems
      }

      // Try to create transfer via API
      try {
        const response = await apiClient.createTransfer(transferData)
        if (response.success) {
          toast({
            title: "Transfer Completed Successfully!",
            description: `Items have been transferred from ${getBranchName(fromBranchResolved)} to ${getBranchName(toBranchResolved)}`,
          })
          
          setLastTransfer(response.data as unknown as Transfer)

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
                  current_stock: Math.max(0, (p.current_stock || 0) - productDelta)
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
    return product?.current_stock || 0
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
            {t("completed")}
          </>
        ) : (
          <>
            <Clock className="h-3 w-3 mr-1" />
            {t("pending")}
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
              <span>{t("transferCompleted")}</span>
            </CardTitle>
            <CardDescription className="text-green-700">
              {t("transferDescriptionSuccess")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Transfer Details */}
              <div className="lg:col-span-2">
                <div className="space-y-3">
                  <h4 className="font-semibold text-green-800 mb-3">{t("transferDetails")}:</h4>
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
                          <p className="text-sm text-gray-500">{t("transferred")}</p>
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

      <div className="flex flex-col sm:flex-row sm:items-center justify-between space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">
            Branch Transfer
          </h1>
          <p className="text-gray-600 mt-1 text-sm sm:text-base">Transfer products between branches instantly - no approval needed</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center space-y-2 sm:space-y-0 sm:space-x-2">
          <Button 
            variant="outline"
            onClick={() => window.location.href = '/dashboard/inventory'}
            className="border-gray-200 hover:bg-gray-50 shadow-sm w-full sm:w-auto"
          >
            <Package className="h-4 w-4 mr-2" />
            View Inventory
          </Button>
          <Button 
            variant="outline"
            onClick={handleRefreshData}
            disabled={isRefreshing}
            className="border-blue-200 text-blue-600 hover:bg-blue-50 w-full sm:w-auto"
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-blue-100">
          <CardContent className="p-3 sm:p-4">
            <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg flex items-center justify-center mx-auto sm:mx-0">
                <Truck className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
              </div>
              <div className="text-center sm:text-left">
                <p className="text-xs sm:text-sm font-medium text-blue-700 leading-tight">Total Transfers</p>
                <p className="text-lg sm:text-2xl font-bold text-blue-900 leading-tight">{transferStats.total_transfers}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-gradient-to-br from-green-50 to-green-100">
          <CardContent className="p-3 sm:p-4">
            <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-r from-green-500 to-green-600 rounded-lg flex items-center justify-center mx-auto sm:mx-0">
                <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
              </div>
              <div className="text-center sm:text-left">
                <p className="text-xs sm:text-sm font-medium text-green-700 leading-tight">Completed</p>
                <p className="text-lg sm:text-2xl font-bold text-green-900 leading-tight">{transferStats.completed_transfers}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-gradient-to-br from-yellow-50 to-yellow-100">
          <CardContent className="p-3 sm:p-4">
            <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-r from-yellow-500 to-yellow-600 rounded-lg flex items-center justify-center mx-auto sm:mx-0">
                <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
              </div>
              <div className="text-center sm:text-left">
                <p className="text-xs sm:text-sm font-medium text-yellow-700 leading-tight">Pending</p>
                <p className="text-lg sm:text-2xl font-bold text-yellow-900 leading-tight">{transferStats.pending_transfers}</p>
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
                <span>{t("branchSelection")}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={handleSubmit} className="space-y-4" ref={formRef}>
                {/* Branch Selection - Only for Owner */}
                {isOwner ? (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="fromBranch">{t("fromBranch")} *</Label>
                      <Select value={fromBranch} onValueChange={setFromBranch} required>
                        <SelectTrigger className="w-full rounded-xl border-gray-200 focus:border-pink-300 focus:ring-pink-200">
                          <SelectValue placeholder={t("fromBranch")} />
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
                      <Label htmlFor="toBranch">{t("toBranch")} *</Label>
                      <Select value={toBranch} onValueChange={setToBranch} required>
                        <SelectTrigger className="w-full rounded-xl border-gray-200 focus:border-pink-300 focus:ring-pink-200">
                          <SelectValue placeholder={t("toBranch")} />
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
                          <p className="text-sm font-medium text-blue-800">{t("fromBranch")}</p>
                          <p className="text-lg font-bold text-blue-900">{getBranchName(userBranch!)}</p>
                          <p className="text-xs text-blue-600">{t("fromBranch")}</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="toBranch">{t("toBranch")} *</Label>
                      <Select value={toBranch} onValueChange={setToBranch} required>
                        <SelectTrigger className="w-full rounded-xl border-gray-200 focus:border-pink-300 focus:ring-pink-200">
                          <SelectValue placeholder={t("toBranch")} />
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
                        <h4 className="font-medium text-green-800">{t("selectedItems")}</h4>
                        <p className="text-sm text-green-600">{t("readyToTransfer")}</p>
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
                  <Label htmlFor="reason">{t("reason")}</Label>
                  <Textarea
                    id="reason"
                    placeholder={t("transferReason")}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="rounded-xl border-gray-200 focus:border-pink-300 focus:ring-pink-200"
                    rows={3}
                  />
                </div>

                {/* Execute Transfer Button */}
                <Button
                  type="submit"
                  disabled={isSubmitting || !toBranch || (Object.keys(productQuantities).filter(key => productQuantities[key] && Number.parseInt(productQuantities[key]) > 0).length === 0 && Object.keys(variationQuantities).filter(key => variationQuantities[key] && Number.parseInt(variationQuantities[key]) > 0).length === 0)}
                  className="w-full bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white font-semibold py-3 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t("submitting")}
                    </>
                  ) : (
                    <>
                      <ArrowRightLeft className="mr-2 h-4 w-4" />
                      {t("submitTransfer")}
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
                <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                  <Package className="h-5 w-5 text-white" />
                </div>
                <span>{t("productSelection")}</span>
              </CardTitle>
              <CardDescription className="text-gray-600">
                {t("selectProductsToTransfer")}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              {/* Product Search and Filters */}
              <div className="space-y-4 mb-6">
                {/* Mobile Quick Filters Header - Always Visible */}
                <div className="flex items-center justify-between sm:hidden">
                  <span className="text-xs font-medium text-gray-600">Quick Filters</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowFilters(!showFilters)}
                    className="h-6 px-2 text-xs text-gray-500 hover:text-gray-700"
                  >
                    {showFilters ? (
                      <>
                        <X className="h-3 w-3 mr-1" />
                        Hide
                      </>
                    ) : (
                      <>
                        <Filter className="h-3 w-3 mr-1" />
                        Show
                      </>
                    )}
                  </Button>
                </div>

                {/* Desktop Search and Filters - Always Visible */}
                <div className="hidden sm:block space-y-4">
                  {/* Advanced Product Search */}
                  <div className="relative">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                      <Input
                        placeholder="Search products by name, SKU, brand, category, color, or size..."
                        value={productSearchTerm}
                        onChange={(e) => setProductSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-20 rounded-xl border-gray-200 focus:border-pink-300 focus:ring-pink-200"
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
                        <div className="flex flex-col sm:flex-row sm:items-center space-y-1 sm:space-y-0 sm:space-x-2">
                          <div className="flex items-center space-x-2">
                            <Search className="h-4 w-4 text-blue-600" />
                            <span className="text-sm font-medium text-blue-800">
                              {productSearchTerm.trim().length < 3 ? 'Enhanced Match' :
                               productSearchTerm.trim().length <= 5 ? 'Partial Match' : 'Phrase Match'}
                            </span>
                          </div>
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
                            className="text-xs h-8 px-3"
                          >
                            {category}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* View Mode and Clear Filters */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between space-y-3 sm:space-y-0">
                    <p className="text-sm font-medium text-gray-700 text-center sm:text-left">
                      Available Products ({allProducts.length})
                    </p>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center space-y-2 sm:space-y-0 sm:space-x-2">
                      {(productSearchTerm.trim() || productSelectedCategories.size > 0) && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setProductSearchTerm("")
                            setProductSelectedCategories(new Set())
                          }}
                          className="w-full sm:w-auto"
                        >
                          <FilterX className="h-4 w-4 mr-2" />
                          Clear All Filters
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Mobile Quick Filters - Collapsible */}
                {showFilters && (
                  <div className="sm:hidden space-y-3">
                    {/* Search Input */}
                    <div className="w-full">
                      <Input
                        placeholder="Search products by name, SKU, brand, category, color, or size..."
                        value={productSearchTerm}
                        onChange={(e) => setProductSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-20 rounded-xl border-gray-200 focus:border-pink-300 focus:ring-pink-200"
                        disabled={isOwner ? !fromBranch : !toBranch}
                      />
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
                              className="text-xs h-8 px-3"
                            >
                              {category}
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Clear Filters */}
                    {(productSearchTerm.trim() || productSelectedCategories.size > 0) && (
                      <div className="w-full">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setProductSearchTerm("")
                            setProductSelectedCategories(new Set())
                          }}
                          className="w-full"
                        >
                          <FilterX className="h-4 w-4 mr-2" />
                          Clear All Filters
                        </Button>
                      </div>
                    )}
                  </div>
                )}
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
                        const productId = product.product_id || ''
                        const productName = product.product_name || ''
                        const productSku = product.product_sku || ''
                        const productType = product.product_type || 'variation'
                        const categoryName = product.category_name || 'Uncategorized'
                        const brand = product.brand || ''
                        const ageRange = product.age_range || ''
                        const gender = product.gender || ''
                        
                        // Calculate total stock from variations
                        const totalStock = product.variations?.reduce((sum, v) => sum + (v.quantity || 0), 0) || 0
                        
                        // Get price from first variation
                        const price = product.variations?.[0]?.price || 0

                        return (
                          <div
                            key={productId}
                        className={`group relative ${
                          viewMode === 'grid' 
                            ? 'p-4 border border-gray-200 rounded-lg hover:border-green-300 hover:shadow-md transition-all duration-200 cursor-pointer bg-white' 
                            : 'p-4 border border-gray-200 rounded-lg hover:border-green-300 transition-all duration-200 cursor-pointer bg-white flex items-center space-x-4'
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
                              ? 'w-full h-12 rounded-lg bg-gradient-to-r from-pink-100 to-purple-100 flex items-center justify-center mb-2' 
                              : 'w-12 h-12 rounded-lg bg-gradient-to-r from-pink-100 to-purple-100 flex items-center justify-center'
                          }`}>
                            <Package className={`${viewMode === 'grid' ? 'h-4 w-4' : 'h-3 w-3'} text-pink-500`} />
                            {/* Category badge (top-left) */}
                            <div className="absolute top-1 left-1">
                              <Badge variant="outline" className={`${viewMode === 'grid' ? 'text-[10px] px-1 py-0.5' : 'text-xs px-1.5 py-0.5'} bg-white/80 backdrop-blur-sm`}>
                                {categoryName}
                              </Badge>
                            </div>
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
                        <div className={`${viewMode === 'grid' ? 'space-y-1' : 'flex-1'}`}>
                          {/* Header Row - Product Name, SKU, and Stock Status */}
                          <div className="flex items-start justify-between mb-1">
                            <div className="flex-1 min-w-0 pr-2">
                              <h3 className={`font-medium text-gray-900 ${viewMode === 'grid' ? 'text-sm' : 'text-base'} truncate leading-tight`}>
                                {productName}
                              </h3>
                            </div>
                            <div className="flex flex-shrink-0 text-right">
                              {productType !== 'variation' && (
                                <p className="font-bold text-lg text-green-600 leading-none">{Number(price).toFixed(0)} ብር</p>
                              )}
                              {productType === 'variation' && (
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  className="h-6 w-6 p-0 rounded-md border-purple-300 bg-purple-50 hover:bg-purple-100 hover:border-purple-400 shadow-sm"
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
                                    <ChevronUp className="h-3 w-3 text-purple-700 font-bold" />
                                  ) : (
                                    <ChevronDown className="h-3 w-3 text-purple-700 font-bold" />
                                  )}
                                </Button>
                              )}
                            </div>
                          </div>

                          {/* SKU and Stock - under price */}
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500">SKU: {productSku}</span>
                            {productType !== 'variation' && (
                              <>
                                <span className="text-xs text-gray-400">•</span>
                                <span className={`text-xs ${
                                  totalStock === 0 ? 'text-red-600' :
                                  totalStock <= 5 ? 'text-yellow-600' : 'text-green-600'
                                } font-medium`}>
                                  {totalStock} available
                                </span>
                              </>
                            )}
                          </div>

                          {/* Product Details */}
                          <div className={`${viewMode === 'grid' ? 'space-y-1' : 'flex items-center space-x-4 mt-1'}`}>
                            {/* Product Tags - Only for uniform products */}
                            {productType !== 'variation' && (
                            <div className="flex flex-wrap gap-1 mb-1">
                                {brand && (
                                <Badge variant="secondary" className="text-xs">
                                    {brand}
                                </Badge>
                              )}
                            </div>
                            )}
                            
                            {/* Variation Info - Only for variation products */}
                            {productType === 'variation' && (
                            <div className="flex flex-wrap gap-1 mb-1">
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
                            <div className={`${viewMode === 'grid' ? 'mt-4 pt-3 border-t border-gray-100' : 'ml-4'}`}>
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
                            <div className={`${viewMode === 'grid' ? 'mt-4 pt-3 border-t border-gray-100' : 'ml-4'}`}>
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
                            <div className="mt-4 space-y-2 border-t border-purple-200 pt-3">
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
                        const productId = product.id || product.product_id || ''
                        const productName = product.name || product.product_name || ''
                        const productSku = product.sku || product.product_sku || ''
                        const productType = product.product_type || 'uniform'
                        const categoryName = product.category_name || 'Uncategorized'
                        const brand = product.brand || ''
                        const ageRange = product.age_range || ''
                        const gender = product.gender || ''
                        const totalStock = product.current_stock || 0
                        const price = product.price || 0
                        const purchasePrice = product.purchase_price || 0
                        const color = product.color || ''
                        const size = product.size || ''
                        const description = product.description || ''

                        return (
                          <div
                            key={productId}
                            className={`group relative ${
                              viewMode === 'grid' 
                                ? 'p-4 border border-gray-200 rounded-lg hover:border-green-300 hover:shadow-md transition-all duration-200 cursor-pointer bg-white' 
                                : 'p-4 border border-gray-200 rounded-lg hover:border-green-300 transition-all duration-200 cursor-pointer bg-white flex items-center space-x-4'
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
                                  ? 'w-full h-12 rounded-lg bg-gradient-to-r from-pink-100 to-purple-100 flex items-center justify-center mb-2' 
                                  : 'w-12 h-12 rounded-lg bg-gradient-to-r from-pink-100 to-purple-100 flex items-center justify-center'
                              }`}>
                                <Package className={`${viewMode === 'grid' ? 'h-4 w-4' : 'h-3 w-3'} text-pink-500`} />
                                {/* Category badge (top-left) */}
                                <div className="absolute top-1 left-1">
                                  <Badge variant="outline" className={`${viewMode === 'grid' ? 'text-[10px] px-1 py-0.5' : 'text-xs px-1.5 py-0.5'} bg-white/80 backdrop-blur-sm`}>
                                    {categoryName}
                                  </Badge>
                                </div>
                              </div>
                            </div>

                            {/* Product Info */}
                            <div className={`${viewMode === 'grid' ? 'space-y-1' : 'flex-1'}`}>
                              {/* Header Row - Product Name, SKU, and Stock Status */}
                              <div className="flex items-start justify-between mb-1">
                                <div className="flex-1 min-w-0 pr-2">
                                  <h3 className={`font-semibold text-gray-900 ${viewMode === 'grid' ? 'text-sm' : 'text-base'} truncate leading-tight`}>
                                    {productName}
                                  </h3>
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className="text-xs text-gray-500">SKU: {productSku}</span>
                                    <span className="text-xs text-gray-400">•</span>
                                    <span className={`text-xs ${
                                      totalStock === 0 ? 'text-red-600' :
                                      totalStock <= 5 ? 'text-yellow-600' : 'text-green-600'
                                    } font-medium`}>
                                      {totalStock} available
                                    </span>
                                  </div>
                                </div>
                                <div className="flex flex-shrink-0 text-right">
                                  <p className="font-bold text-lg text-green-600 leading-none">{Number(price).toFixed(0)} ብር</p>
                                </div>
                              </div>

                              {/* Second Row - Gender */}
                              <div className="flex items-center gap-2 mb-1">
                                {gender && (
                                  <Badge variant="outline" className="text-xs bg-purple-50 text-purple-600 border-purple-200 capitalize">
                                    {gender}
                                  </Badge>
                                )}
                              </div>

                              {/* Product Details Grid */}
                              <div className="space-y-1">

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
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="font-semibold text-xs sm:text-sm">Date</TableHead>
                    <TableHead className="font-semibold text-xs sm:text-sm">Product</TableHead>
                    <TableHead className="font-semibold text-xs sm:text-sm">From</TableHead>
                    <TableHead className="font-semibold text-xs sm:text-sm">To</TableHead>
                    <TableHead className="font-semibold text-xs sm:text-sm">Quantity</TableHead>
                    <TableHead className="font-semibold text-xs sm:text-sm">Status</TableHead>
                    <TableHead className="font-semibold text-xs sm:text-sm">Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {processedTransfers.map((transfer) => (
                    <TableRow key={transfer.id} className="hover:bg-gray-50">
                      <TableCell className="font-medium text-xs sm:text-sm">
                        {new Date(transfer.requested_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-xs sm:text-sm">
                        {(transfer.items ?? []).map((item) => item.product_name).join(", ")}
                      </TableCell>
                      <TableCell className="text-xs sm:text-sm">
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 text-xs">
                          {transfer.from_branch_name || getBranchName(transfer.from_branch_id)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs sm:text-sm">
                        <Badge variant="outline" className="bg-green-50 text-green-700 text-xs">
                          {transfer.to_branch_name || getBranchName(transfer.to_branch_id)}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium text-xs sm:text-sm">
                        {(transfer.items ?? []).reduce((sum, item) => sum + item.quantity, 0)}
                      </TableCell>
                      <TableCell className="text-xs sm:text-sm">
                        {getStatusBadge(transfer.status)}
                      </TableCell>
                      <TableCell className="text-gray-600 max-w-xs truncate text-xs sm:text-sm">{transfer.reason}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
