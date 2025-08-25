"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import { Slider } from "@/components/ui/slider"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { 
  Search, 
  Filter, 
  Package, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Loader2, 
  Plus,
  Edit,
  ShoppingBag,
  Trash2,
  Building2,
  DollarSign,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Image as ImageIcon,
  Trash,
  Grid3X3,
  List,
  Eye,
  EyeOff,
  Star,
  Clock,
  Tag,
  Palette,
  Users,
  Zap,
  Sparkles,
  Target,
  BarChart3,
  Settings,
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
  SortAsc,
  SortDesc,
  X
} from "lucide-react"
import { useLanguage } from "@/lib/language-context"
import { useBranch } from "@/lib/branch-context"
import { ProductEditModal } from "@/components/product-edit-modal"
import { ExpandableProductRow } from "@/components/expandable-product-row"
import apiClient from "@/lib/api-client"
import { useToast } from "@/hooks/use-toast"
import { useDebounce } from "@/hooks/use-debounce"
import { Label } from "@/components/ui/label"
import Image from "next/image"

interface InventoryItem {
  id: string
  product_id: string
  product_name: string
  product_sku: string
  product_type: string
  branch_id: string
  branch_name: string
  quantity: number
  min_stock_level: number
  max_stock_level: number
  stock_status: string
  category_name: string
  price: number
  cost_price?: number
  purchase_price?: number
  color?: string
  size?: string
  brand?: string
  age_range?: string
  gender?: string
  last_restocked?: string
  total_stock: number
  branch_count: number
  image_url?: string
  description?: string
  variation_id: string
  variation_sku: string
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

interface InventoryStats {
  total_items: number
  low_stock_items: number
  out_of_stock_items: number
  overstock_items: number
  total_value: number
  total_cost: number
  profit_margin: number
}

interface PaginationInfo {
  page: number
  limit: number
  total: number
  total_pages: number
  has_next: boolean
  has_prev: boolean
}

export default function InventoryPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [debouncedSearchTerm] = useDebounce(searchTerm, 300)
  const safeDebouncedSearchTerm = debouncedSearchTerm || ""
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSearching, setIsSearching] = useState(false)
  const [selectedStatus, setSelectedStatus] = useState("all")
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [selectedBrand, setSelectedBrand] = useState("all")
  const [selectedGender, setSelectedGender] = useState("all")
  const [selectedAgeRange, setSelectedAgeRange] = useState("all")
  const [selectedSize, setSelectedSize] = useState("all")
  const [selectedColor, setSelectedColor] = useState("all")
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([])
  const [brands, setBrands] = useState<string[]>([])
  const [ageRanges, setAgeRanges] = useState<string[]>([])
  const [sizes, setSizes] = useState<string[]>([])
  const [colors, setColors] = useState<string[]>([])
  const [stats, setStats] = useState<InventoryStats>({
    total_items: 0,
    low_stock_items: 0,
    out_of_stock_items: 0,
    overstock_items: 0,
    total_value: 0,
    total_cost: 0,
    profit_margin: 0,
  })
  const [selectedProduct, setSelectedProduct] = useState<any>(null)
  const [editScope, setEditScope] = useState<'product' | 'variation'>('product')
  const [selectedVariation, setSelectedVariation] = useState<any>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 20,
    total: 0,
    total_pages: 0,
    has_next: false,
    has_prev: false,
  })
  
  // Bulk selection state
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [isSelectAll, setIsSelectAll] = useState(false)
  const [isBulkDeleting, setIsBulkDeleting] = useState(false)
  // Enhanced UI state
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table')
  const [showFilters, setShowFilters] = useState(false)
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false)
  const [searchSuggestions, setSearchSuggestions] = useState<string[]>([])
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const [popularProducts, setPopularProducts] = useState<string[]>([])
  const [isSearchFocused, setIsSearchFocused] = useState(false)
  const [sortBy, setSortBy] = useState<string>('name')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set())
  const [selectedBrands, setSelectedBrands] = useState<Set<string>>(new Set())
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 1000])
  const [stockRange, setStockRange] = useState<[number, number]>([0, 100])
  
  // Cross-branch search state
  const [isCrossBranchSearch, setIsCrossBranchSearch] = useState(false)

  const { t } = useLanguage()
  const { currentBranch } = useBranch()
  const { toast } = useToast()

  // Helper function to get the other branch for cross-branch search
  const getOtherBranch = () => {
    if (currentBranch === "franko") return "mebrat-hayl"
    if (currentBranch === "mebrat-hayl") return "franko"
    return "franko" // Default fallback
  }

  // Helper function to get branch display name
  const getBranchDisplayName = (branch: string) => {
    if (branch === "franko") return "Franko"
    if (branch === "mebrat-hayl") return "Mebrathayl"
    return "All Branches"
  }

  const fetchInventory = useCallback(async (page = 1, search = "", status = "all", category = "all") => {
    setIsLoading(true)
    try {
      const params: any = {
        page,
        limit: 20,
      }

      // Handle branch selection for search
      if (isCrossBranchSearch && currentBranch !== "all") {
        // Cross-branch search: search across all branches
        params.cross_branch = true
        // Note: No branch_id is sent, allowing API to search across all branches
      } else if (currentBranch && currentBranch !== "all") {
        // Current branch search: search only in the specified branch
        // Map frontend branch to database branch id
        const { getBranchIdForDatabase } = await import("@/lib/utils")
        params.branch_id = getBranchIdForDatabase(currentBranch)
        params.cross_branch = false
      }

      // Advanced search implementation
      if (search.trim()) {
        const searchConfig = formatSearchForAPI(search)
        params.search = searchConfig.search
        params.search_type = searchConfig.search_type
        params.search_mode = searchConfig.search_mode
      }

      if (status !== "all") {
        params.status = status
      }

      if (category !== "all") {
        params.category = category
      }

      // Add new filter parameters
      if (selectedBrand !== "all") {
        params.brand = selectedBrand
      }

      if (selectedGender !== "all") {
        params.gender = selectedGender
      }

      if (selectedAgeRange !== "all") {
        params.age_range = selectedAgeRange
      }

      if (selectedSize !== "all") {
        params.size = selectedSize
      }

      if (selectedColor !== "all") {
        params.color = selectedColor
      }

      if (priceRange[0] > 0 || priceRange[1] < 1000) {
        if (priceRange[0] > 0) params.price_min = priceRange[0]
        if (priceRange[1] < 1000) params.price_max = priceRange[1]
      }

      if (stockRange[0] > 0 || stockRange[1] < 100) {
        if (stockRange[0] > 0) params.stock_min = stockRange[0]
        if (stockRange[1] < 100) params.stock_max = stockRange[1]
      }

      console.log('Sending inventory request with params:', params)
      // Temporarily use regular API until optimized function is fixed
      const response = await apiClient.getInventory(params)
      
      console.log('Inventory API response:', response)
      
      if (response.success && response.data) {
        // Regular API returns { success: true, data: [...], pagination: {...} }
        const rawInventoryData = response.data as any[]
        console.log('Raw inventory data from API:', rawInventoryData)
        
        // Transform the data to match the expected InventoryItem interface
        const inventoryData: InventoryItem[] = rawInventoryData.map(item => ({
          id: item.id || item.inventory_id || '',
          product_id: item.product_id || '',
          product_name: item.product_name || '',
          product_sku: item.product_sku || item.sku || '',
          product_type: item.product_type || '',
          branch_id: item.branch_id || '',
          branch_name: item.branch_name || '',
          quantity: item.quantity || 0,
          min_stock_level: item.min_stock_level || 0,
          max_stock_level: item.max_stock_level || 0,
          stock_status: item.stock_status || 'normal',
          category_name: item.category_name || '',
          price: item.price || 0,
          cost_price: item.cost_price || 0,
          purchase_price: item.purchase_price || 0,
          color: item.color || '',
          size: item.size || '',
          brand: item.brand || '',
          age_range: item.age_range || '',
          gender: item.gender || '',
          last_restocked: item.last_restocked || '',
          total_stock: item.quantity || 0, // Use quantity as total_stock for now
          branch_count: 1, // Default to 1 for single branch view
          image_url: item.image_url || '',
          description: item.description || '',
          variation_id: item.variation_id || '',
          variation_sku: item.variation_sku || ''
        }))
        
        console.log('Transformed inventory data:', inventoryData)
        setInventory(inventoryData)
        
        // Handle pagination from the response
        const responseWithPagination = response as any
        if (responseWithPagination.pagination) {
          console.log('Pagination from API:', responseWithPagination.pagination)
          setPagination(responseWithPagination.pagination)
        } else {
          console.log('No pagination from API, using default')
          setPagination({
            page: 1,
            limit: 20,
            total: inventoryData.length,
            total_pages: 1,
            has_next: false,
            has_prev: false,
          })
        }
        calculateStats(inventoryData)
        
        // Clear selections when data changes
        setSelectedItems(new Set())
        setIsSelectAll(false)
      } else {
        console.error('API response error:', response)
        toast({
          title: "Error",
          description: response.error || "Failed to load inventory",
          variant: "destructive",
        })
        setInventory([])
        setPagination({
          page: 1,
          limit: 20,
          total: 0,
          total_pages: 0,
          has_next: false,
          has_prev: false,
        })
      }
    } catch (error: any) {
      console.error("Inventory fetch error:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to load inventory",
        variant: "destructive",
      })
      setInventory([])
      setPagination({
        page: 1,
        limit: 20,
        total: 0,
        total_pages: 0,
        has_next: false,
        has_prev: false,
      })
    } finally {
      setIsLoading(false)
    }
  }, [currentBranch, isCrossBranchSearch, toast])

  // Create a stable reference for filter parameters to prevent unnecessary re-renders
  const filterParams = useMemo(() => ({
    selectedStatus,
    selectedCategory,
    selectedBrand,
    selectedGender,
    selectedAgeRange,
    selectedSize,
    selectedColor,
    priceRange,
    stockRange
  }), [
    selectedStatus,
    selectedCategory,
    selectedBrand,
    selectedGender,
    selectedAgeRange,
    selectedSize,
    selectedColor,
    priceRange,
    stockRange
  ])

  // Create a stable reference for search parameters
  const searchParams = useMemo(() => ({
    searchTerm: safeDebouncedSearchTerm,
    status: selectedStatus,
    category: selectedCategory
  }), [safeDebouncedSearchTerm, selectedStatus, selectedCategory])

  // Single consolidated useEffect for all inventory fetching scenarios
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      // Determine the search term to use
      const effectiveSearchTerm = safeDebouncedSearchTerm.trim()
      
      // Determine the status and category to use
      const effectiveStatus = selectedStatus
      const effectiveCategory = selectedCategory
      
      // Fetch inventory with current parameters
      fetchInventory(1, effectiveSearchTerm, effectiveStatus, effectiveCategory)
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [
    currentBranch,
    isCrossBranchSearch,
    safeDebouncedSearchTerm,
    selectedStatus,
    selectedCategory,
    selectedBrand,
    selectedGender,
    selectedAgeRange,
    selectedSize,
    selectedColor,
    priceRange,
    stockRange
  ])

  // Separate useEffect for initial data loading (categories, brands, etc.)
  useEffect(() => {
    fetchCategories()
    fetchBrandsAndAgeRanges()
  }, [currentBranch])

  // Group inventory items by product for expandable rows
  const groupedProducts = useMemo(() => {
    const grouped = new Map<string, ProductWithVariations>()
    
    inventory.forEach((item) => {
      const productId = item.product_id
      
      if (!grouped.has(productId)) {
        grouped.set(productId, {
          product_id: item.product_id,
          product_name: item.product_name,
          product_sku: item.product_sku,
          product_type: item.product_type,
          brand: item.brand,
          age_range: item.age_range,
          gender: item.gender,
          description: item.description,
          image_url: item.image_url,
          category_name: item.category_name,
          variations: []
        })
      }
      
      const product = grouped.get(productId)!
      product.variations.push({
        id: item.id,
        variation_id: item.variation_id,
        variation_sku: item.variation_sku,
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
      })
    })
    
    let sortedProducts = Array.from(grouped.values())
    
    // Apply sorting
    sortedProducts.sort((a, b) => {
      let aValue: any
      let bValue: any
      
      switch (sortBy) {
        case 'name':
          aValue = a.product_name.toLowerCase()
          bValue = b.product_name.toLowerCase()
          break
        case 'category':
          aValue = a.category_name.toLowerCase()
          bValue = b.category_name.toLowerCase()
          break
        case 'price':
          // Sort by the highest price variation
          aValue = Math.max(...a.variations.map(v => v.price))
          bValue = Math.max(...b.variations.map(v => v.price))
          break
        case 'quantity':
        case 'stock':
          // Sort by total stock across all variations
          aValue = a.variations.reduce((sum, v) => sum + v.quantity, 0)
          bValue = b.variations.reduce((sum, v) => sum + v.quantity, 0)
          break
        default:
          aValue = a.product_name.toLowerCase()
          bValue = b.product_name.toLowerCase()
      }
      
      // Handle string comparison
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        if (sortOrder === 'asc') {
          return aValue.localeCompare(bValue)
        } else {
          return bValue.localeCompare(aValue)
        }
      }
      
      // Handle number comparison
      if (sortOrder === 'asc') {
        return aValue - bValue
      } else {
        return bValue - aValue
      }
    })
    
    return sortedProducts
  }, [inventory, sortBy, sortOrder])

  const fetchCategories = async () => {
    try {
      const response = await apiClient.getCategories()
      if (response.success && response.data) {
        setCategories(response.data as { id: string; name: string }[])
      }
    } catch (error) {
      console.error("Categories fetch error:", error)
    }
  }

  const fetchBrandsAndAgeRanges = async () => {
    try {
      // Fetch broad inventory across all branches to extract lists
      const [invRes, prodRes] = await Promise.all([
        apiClient.getInventory({ limit: 1000, cross_branch: true }),
        apiClient.getProducts({ limit: 1000, cross_branch: true })
      ])

      // Inventory array normalization
      const invOk = (invRes as { success?: boolean }).success === true
      const invDataUnknown = (invRes as { data?: unknown }).data
      const inventoryData: InventoryItem[] = invOk && Array.isArray(invDataUnknown) ? (invDataUnknown as InventoryItem[]) : []

      // Products API normalization (supports both PaginatedResponse and {products: []})
      const prodOk = (prodRes as { success?: boolean }).success === true
      const prodDataUnknown = (prodRes as { data?: unknown }).data
      let productsData: Array<{ brand?: string; age_range?: string }> = []
      if (prodOk) {
        if (Array.isArray(prodDataUnknown)) {
          productsData = prodDataUnknown as Array<{ brand?: string; age_range?: string }>
        } else if (prodDataUnknown && typeof prodDataUnknown === 'object' && Array.isArray((prodDataUnknown as any).products)) {
          productsData = (prodDataUnknown as any).products as Array<{ brand?: string; age_range?: string }>
        }
      }

      // Extract unique brands from inventory and products
      const brandSet = new Set<string>()
      inventoryData.forEach(i => { if (i.brand && i.brand.trim()) brandSet.add(i.brand.trim()) })
      productsData.forEach(p => { if (p.brand && p.brand.trim()) brandSet.add(p.brand.trim()) })
      setBrands(Array.from(brandSet).sort())

      // Extract unique age ranges from inventory and products
      const ageSet = new Set<string>()
      inventoryData.forEach(i => { if (i.age_range && i.age_range.trim()) ageSet.add(i.age_range.trim()) })
      productsData.forEach(p => { if (p.age_range && p.age_range.trim()) ageSet.add(p.age_range.trim()) })
      setAgeRanges(Array.from(ageSet).sort())

      // Extract unique sizes from inventory (UI uses static sizes but keep for potential future use)
      const uniqueSizes = [...new Set(
        inventoryData.map(item => item.size).filter((s): s is string => !!s && s.trim() !== '')
      )].sort()
      setSizes(uniqueSizes)

      // Extract unique colors from inventory variations
      const colorSet = new Set<string>()
      inventoryData.forEach(i => { if (i.color && i.color.trim()) colorSet.add(i.color.trim()) })
      const uniqueColors = Array.from(colorSet).sort()
      setColors(uniqueColors)
    } catch (error) {
      console.error("Brands, age ranges, sizes, and colors fetch error:", error)
    }
  }

  const calculateStats = (data: InventoryItem[]) => {
    const stats: InventoryStats = {
      total_items: data.length,
      low_stock_items: data.filter(item => item.stock_status === 'low_stock').length,
      out_of_stock_items: data.filter(item => item.stock_status === 'out_of_stock').length,
      overstock_items: data.filter(item => item.stock_status === 'overstock').length,
      total_value: data.reduce((sum, item) => sum + (item.quantity * Number(item.price)), 0),
      total_cost: data.reduce((sum, item) => sum + (item.quantity * (Number(item.cost_price) || 0)), 0),
      profit_margin: 0,
    }
    
    if (stats.total_value > 0) {
      stats.profit_margin = ((stats.total_value - stats.total_cost) / stats.total_value) * 100
    }
    
    setStats(stats)
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'out_of_stock':
        return (
          <Badge className="text-xs bg-red-50 text-red-700 border-red-200 hover:bg-red-100 transition-colors">
            <XCircle className="h-3 w-3 mr-1" />
            Out of Stock
          </Badge>
        )
      case 'low_stock':
        return (
          <Badge className="text-xs bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100 transition-colors">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Low Stock
          </Badge>
        )
      case 'overstock':
        return (
          <Badge className="text-xs bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100 transition-colors">
            <TrendingUp className="h-3 w-3 mr-1" />
            Overstock
          </Badge>
        )
      default:
        return (
          <Badge className="text-xs bg-green-50 text-green-700 border-green-200 hover:bg-green-100 transition-colors">
            <CheckCircle className="h-3 w-3 mr-1" />
            In Stock
          </Badge>
        )
    }
  }

  const handleEditProduct = (item: InventoryItem) => {
    // Derive category_id from known categories to keep modal consistent
    const matchedCategory = categories.find((c) => c.name === item.category_name)
    const derivedCategoryId = matchedCategory?.id || ""

    // Convert InventoryItem to Product format for the modal
    const product = {
      id: item.product_id,
      name: item.product_name,
      sku: item.product_sku,
      category_id: derivedCategoryId,
      category_name: item.category_name,
      color: item.color,
      size: item.size,
      price: Number(item.price) || 0,
      cost_price: item.cost_price,
      description: item.description || "",
      image_url: item.image_url || "",
      barcode: undefined as unknown as string | undefined,
      brand: item.brand,
      age_range: item.age_range,
      gender: item.gender,
      total_stock: item.total_stock,
      branch_count: item.branch_count,
    }
    setSelectedProduct(product)
    setSelectedVariation(null)
    setEditScope('product')
    setIsEditModalOpen(true)
  }

  const handleEditVariation = (productId: string, variation: any) => {
    // Build a compact product object for modal with variation details
    const matched = inventory.find(i => i.product_id === productId && i.variation_id === variation.variation_id)
    const matchedCategory = matched ? categories.find(c => c.name === matched.category_name) : undefined
    const product = {
      id: productId,
      name: matched?.product_name || '',
      sku: matched?.product_sku || '',
      category_id: matchedCategory?.id || '',
      category_name: matched?.category_name || '',
      brand: matched?.brand,
      age_range: matched?.age_range,
      gender: matched?.gender,
      description: matched?.description,
      image_url: matched?.image_url,
      price: Number(variation.price) || 0,
      purchase_price: variation.purchase_price,
      color: variation.color,
      size: variation.size,
      total_stock: matched?.total_stock || 0,
      branch_count: matched?.branch_count || 1,
    }
    setSelectedProduct(product)
    setSelectedVariation({
      variation_id: variation.variation_id,
      color: variation.color,
      size: variation.size,
      price: variation.price,
      purchase_price: variation.purchase_price,
    })
    setEditScope('variation')
    setIsEditModalOpen(true)
  }

  const handleEditSuccess = () => {
    fetchInventory(pagination.page, searchTerm, selectedStatus, selectedCategory)
  }

  const handleDeleteProduct = async (item: InventoryItem) => {
    if (!confirm(`Are you sure you want to delete the product "${item.product_name}"? This will also remove all inventory records for this product. This action cannot be undone.`)) {
      return
    }

    try {
      const response = await apiClient.deleteProduct(item.product_id, false)

      if (response.success) {
        toast({
          title: t("save"),
          description: t("delete"),
        })
        fetchInventory(pagination.page, searchTerm, selectedStatus, selectedCategory)
      } else {
        toast({
          title: t("cancel"),
          description: response.error || t("delete"),
          variant: "destructive",
        })
      }
    } catch (error: any) {
      console.error("Delete product error:", error)
      toast({
        title: t("cancel"),
        description: error.message || t("delete"),
        variant: "destructive",
      })
    }
  }

  const handleDeleteInventory = async (item: InventoryItem) => {
    if (!confirm(`Are you sure you want to delete the inventory record for "${item.product_name}" at ${item.branch_name}? This action cannot be undone.`)) {
      return
    }

    try {
      const response = await apiClient.updateInventory({
        product_id: item.product_id,
        branch_id: item.branch_id,
        quantity: 0,
        min_stock_level: item.min_stock_level,
        max_stock_level: item.max_stock_level,
        delete_record: true // Add a flag to indicate deletion
      })

      if (response.success) {
        toast({
          title: t("save"),
          description: t("delete"),
        })
        fetchInventory(pagination.page, searchTerm, selectedStatus, selectedCategory)
      } else {
        toast({
          title: t("cancel"),
          description: response.error || t("delete"),
          variant: "destructive",
        })
      }
    } catch (error: any) {
      console.error("Delete inventory error:", error)
      toast({
        title: t("cancel"),
        description: error.message || t("delete"),
        variant: "destructive",
      })
    }
  }

  const handlePageChange = (newPage: number) => {
    fetchInventory(newPage, searchTerm, selectedStatus, selectedCategory)
  }

  const handleClearFilters = () => {
    setSearchTerm("")
    setSelectedStatus("all")
    setSelectedCategory("all")
    setSelectedBrand("all")
    setSelectedGender("all")
    setSelectedAgeRange("all")
    setSelectedSize("all")
    setSelectedColor("all")
    setPriceRange([0, 1000])
    setStockRange([0, 100])
    setSelectedCategories(new Set())
    setSelectedBrands(new Set())
    setSortBy("name")
    setSortOrder("asc")
    fetchInventory(1, "", "all", "all")
  }

  // Bulk selection handlers
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = new Set(inventory.map(item => item.product_id))
      setSelectedItems(allIds)
      setIsSelectAll(true)
    } else {
      setSelectedItems(new Set())
      setIsSelectAll(false)
    }
  }

  const handleSelectItem = (productId: string, checked: boolean) => {
    const newSelectedItems = new Set(selectedItems)
    if (checked) {
      newSelectedItems.add(productId)
    } else {
      newSelectedItems.delete(productId)
    }
    setSelectedItems(newSelectedItems)
    setIsSelectAll(newSelectedItems.size === inventory.length)
  }

  const handleBulkDelete = async () => {
    if (selectedItems.size === 0) {
      toast({
        title: "No Selection",
        description: "Please select at least one product to delete",
        variant: "destructive",
      })
      return
    }

    const selectedProducts = inventory.filter(item => selectedItems.has(item.product_id))
    const productNames = selectedProducts.map(item => item.product_name).join(", ")
    
    if (!confirm(`Are you sure you want to delete ${selectedItems.size} selected product(s)?\n\nProducts: ${productNames}\n\nThis will also remove all inventory records for these products. This action cannot be undone.`)) {
      return
    }

    setIsBulkDeleting(true)
    let successCount = 0
    let errorCount = 0

    try {
      for (const productId of selectedItems) {
        try {
          const response = await apiClient.deleteProduct(productId, false)
          if (response.success) {
            successCount++
          } else {
            errorCount++
          }
        } catch (error) {
          errorCount++
        }
      }

      if (successCount > 0) {
        toast({
          title: "Bulk Delete Complete",
          description: `Successfully deleted ${successCount} product(s)${errorCount > 0 ? `. ${errorCount} failed.` : ""}`,
        })
        setSelectedItems(new Set())
        setIsSelectAll(false)
        fetchInventory(pagination.page, searchTerm, selectedStatus, selectedCategory)
      } else {
        toast({
          title: "Bulk Delete Failed",
          description: "Failed to delete any products. Please try again.",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An error occurred during bulk deletion",
        variant: "destructive",
      })
    } finally {
      setIsBulkDeleting(false)
    }
  }

  // Advanced search logic with intelligent matching
  const getSearchType = (searchTerm: string) => {
    const trimmedTerm = searchTerm.trim()
    const wordCount = trimmedTerm.split(/\s+/).length
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

  const formatSearchForAPI = (searchTerm: string) => {
    const searchInfo = getSearchType(searchTerm)
    
    switch (searchInfo.type) {
      case 'partial':
        // For 3-5 characters: Partial match with wildcards
        // Searches in names, SKUs, brands, categories, colors, sizes
        return {
          search: searchInfo.term,
          search_type: 'partial',
          search_mode: 'contains'
        }
      case 'phrase':
        // For 6+ characters: Phrase match requiring all words
        // Example: "sun dre" matches "sun dress" but not just "sunhat"
        return {
          search: searchInfo.term,
          search_type: 'phrase',
          search_mode: 'exact'
        }
      default:
        // For < 3 characters: Enhanced exact match
        // Searches for exact text in names, SKUs, brands, categories
        // Also includes "starts with" matching for better results
        return {
          search: searchInfo.term,
          search_type: 'exact',
          search_mode: 'exact'
        }
    }
  }

  // Get search type indicator for UI
  const getSearchTypeIndicator = (searchTerm: string) => {
    if (!searchTerm.trim()) return null
    
    const searchInfo = getSearchType(searchTerm)
    const length = searchTerm.trim().length
    
    switch (searchInfo.type) {
      case 'partial':
        return { 
          type: 'partial', 
          label: 'Partial Match', 
          description: `Finding "${searchTerm}" in product names, SKUs, brands, categories, colors, and sizes`,
          color: 'text-blue-600',
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200'
        }
      case 'phrase':
        return { 
          type: 'phrase', 
          label: 'Phrase Match', 
          description: `Finding all words in "${searchTerm}" across all fields`,
          color: 'text-green-600',
          bgColor: 'bg-green-50',
          borderColor: 'border-green-200'
        }
      default:
        return { 
          type: 'exact', 
          label: 'Enhanced Match', 
          description: `Finding "${searchTerm}" in product names, SKUs, brands, and categories (includes partial matches)`,
          color: 'text-purple-600',
          bgColor: 'bg-purple-50',
          borderColor: 'border-purple-200'
        }
    }
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

  // Enhanced search suggestions
  const generateSearchSuggestions = useMemo(() => {
    if (!searchTerm.trim()) return []
    
    const suggestions: string[] = []
    const searchLower = searchTerm.toLowerCase()
    
    // Add product name suggestions
    inventory.forEach(item => {
      if (item.product_name.toLowerCase().includes(searchLower)) {
        suggestions.push(item.product_name)
      }
    })
    
    // Add brand suggestions
    brands.forEach(brand => {
      if (brand.toLowerCase().includes(searchLower)) {
        suggestions.push(brand)
      }
    })
    
    // Add category suggestions
    categories.forEach(cat => {
      if (cat.name.toLowerCase().includes(searchLower)) {
        suggestions.push(cat.name)
      }
    })
    
    // Remove duplicates and limit results
    return [...new Set(suggestions)].slice(0, 5)
  }, [searchTerm, inventory, brands, categories])

  // Update search suggestions
  useEffect(() => {
    setSearchSuggestions(generateSearchSuggestions)
  }, [generateSearchSuggestions])

  // Persist recent searches in localStorage
  useEffect(() => {
    // On mount, load from localStorage
    const stored = localStorage.getItem('recentInventorySearches');
    if (stored) {
      try {
        setRecentSearches(JSON.parse(stored));
      } catch {}
    }
  }, []);

  useEffect(() => {
    // On update, save to localStorage
    localStorage.setItem('recentInventorySearches', JSON.stringify(recentSearches));
  }, [recentSearches]);

  // When updating recent searches, also update localStorage
  useEffect(() => {
    if (searchTerm.trim() && !recentSearches.includes(searchTerm.trim())) {
      const updated = [searchTerm.trim(), ...recentSearches.slice(0, 8)];
      setRecentSearches(updated);
      localStorage.setItem('recentInventorySearches', JSON.stringify(updated));
    }
  }, [searchTerm]);

  // Add this helper function inside InventoryPage
  const handleRecentSearchClick = (search: string) => {
    setSearchTerm(search);
    setIsSearchFocused(false);
    fetchInventory(1, search, selectedStatus, selectedCategory);
    setTimeout(() => {
      const input = document.querySelector('input[placeholder*="Search products"]') as HTMLInputElement;
      if (input) input.blur();
    }, 0);
  };

  // Helper function to count active filters
  const getActiveFilterCount = () => {
    let count = 0;
    if (selectedStatus !== "all") count++;
    if (selectedCategory !== "all") count++;
    if (selectedBrand !== "all") count++;
    if (selectedGender !== "all") count++;
    if (selectedAgeRange !== "all") count++;
    if (selectedSize !== "all") count++;
    if (selectedColor !== "all") count++;
    if (priceRange[0] > 0 || priceRange[1] < 1000) count++;
    if (stockRange[0] > 0 || stockRange[1] < 100) count++;
    return count;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-3 sm:space-y-0">
        <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-3">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            {t("products")} & {t("inventory")}
            <span className="ml-0 sm:ml-3 mt-2 sm:mt-0 px-2 py-1 rounded-full bg-blue-50 text-blue-700 text-sm font-semibold border border-blue-200 shadow-sm">
              {pagination.total} {t("items")}
            </span>
          </h1>
        </div>
        <Button
          className="w-full sm:w-auto bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white"
          onClick={() => window.location.href = '/dashboard/add-product'}
        >
          <Plus className="h-4 w-4 mr-2" />
          {t("addProduct")}
        </Button>
      </div>

      
      {/* Search and Filters - More Compact */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-3">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-3 lg:space-y-0">
            <CardTitle className="flex items-center space-x-2 text-lg">
              <Search className="h-5 w-5 text-pink-500" />
              <span>{t("searchAndFilters")}</span>
            </CardTitle>
            <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-2">
              {/* View Mode Toggle */}
              <div className="flex items-center bg-gray-100 rounded-lg p-1 w-full sm:w-auto justify-center sm:justify-start">
                <Button
                  variant={viewMode === 'table' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('table')}
                  className="h-7 px-2 text-xs flex-1 sm:flex-none"
                >
                  <List className="h-3 w-3 mr-1" />
                  Table
                </Button>
                <Button
                  variant={viewMode === 'card' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('card')}
                  className="h-7 px-2 text-xs flex-1 sm:flex-none"
                >
                  <Grid3X3 className="h-3 w-3 mr-1" />
                  Cards
                </Button>
              </div>

              {/* Sort Options */}
              <div className="flex flex-row items-center space-x-2 w-full sm:w-auto justify-center sm:justify-start">
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-full sm:w-28 h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name">Name (A-Z)</SelectItem>
                    <SelectItem value="price">Selling Price (Low-High)</SelectItem>
                    <SelectItem value="quantity">Stock (Low-High)</SelectItem>
                    <SelectItem value="category">Category (A-Z)</SelectItem>
                  </SelectContent>
                </Select>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  className="h-7 w-7 p-0"
                  title={`Sort ${sortOrder === 'asc' ? 'Descending' : 'Ascending'}`}
                >
                  {sortOrder === 'asc' ? <SortAsc className="h-3 w-3" /> : <SortDesc className="h-3 w-3" />}
                </Button>
              </div>
               
              <Separator orientation="vertical" className="h-5 hidden sm:block" />

              {/* Compact Filter Actions */}
              <div className="flex flex-row items-center space-x-2 w-full sm:w-auto justify-center sm:justify-start">
                {/* Cross-Branch Search Toggle */}
                <div className="flex items-center space-x-2 bg-gray-50 rounded-lg px-3 py-1 border border-gray-200 w-full sm:w-auto justify-center sm:justify-start">
                  <span className="text-xs font-medium text-gray-700">
                    {getBranchDisplayName(currentBranch || "franko")}
                  </span>
                  <div className="relative">
                    <input
                      type="checkbox"
                      id="crossBranchToggle"
                      checked={isCrossBranchSearch}
                      onChange={(e) => {
                        setIsCrossBranchSearch(e.target.checked)
                        // Refresh search when toggling
                        if (searchTerm.trim()) {
                          fetchInventory(1, searchTerm.trim(), selectedStatus, selectedCategory)
                        }
                      }}
                      className="sr-only"
                    />
                    <label
                      htmlFor="crossBranchToggle"
                      className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors duration-200 ease-in-out cursor-pointer ${
                        isCrossBranchSearch ? 'bg-blue-500' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ease-in-out ${
                          isCrossBranchSearch ? 'translate-x-5' : 'translate-x-1'
                        }`}
                      />
                    </label>
                  </div>
                  <span className="text-xs font-medium text-gray-700">
                    {getBranchDisplayName(getOtherBranch())}
                  </span>
                </div>
                
                <div className="flex flex-row items-center space-x-2 w-full sm:w-auto">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={handleClearFilters}
                    className="text-red-600 border-red-300 hover:bg-red-50 h-7 px-2 text-xs flex-1 sm:flex-none"
                  >
                    <FilterX className="h-3 w-3 mr-1" />
                    {t("clear")}
                  </Button>
                  
                  <Button 
                    variant="default" 
                    size="sm"
                    onClick={() => {
                      fetchInventory(1, safeDebouncedSearchTerm, selectedStatus, selectedCategory)
                      setIsFilterPanelOpen(false)
                    }}
                    className="bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white h-7 px-2 text-xs flex-1 sm:flex-none"
                  >
                    <Filter className="h-3 w-3 mr-1" />
                    {t("apply")}
                  </Button>
                </div>
              </div>
              

            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Smart Search Bar with Autocomplete */}
          <div className="relative">
            <div className="relative">
              <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 ${
                isCrossBranchSearch ? 'text-blue-500' : 'text-gray-400'
              }`} />
              <Input
                placeholder={isCrossBranchSearch 
                  ? `Search in ${getBranchDisplayName(getOtherBranch())} branch...`
                  : "Search products by name, SKU, brand, or category..."
                }
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
                className={`pl-10 pr-20 rounded-xl border-gray-200 focus:border-pink-300 focus:ring-pink-200 h-10 w-full ${
                  isCrossBranchSearch ? 'border-blue-300 bg-blue-50' : ''
                }`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setSearchTerm(searchTerm.trim());
                    setIsSearchFocused(false);
                    fetchInventory(1, searchTerm.trim(), selectedStatus, selectedCategory);
                  }
                }}
              />
              {isSearching && (
                <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin text-pink-500" />
              )}
              <div className="absolute right-8 top-1/2 transform -translate-y-1/2 flex items-center space-x-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600"
                  title="Search Help: < 3 chars = Exact match, 3-5 chars = Partial match, 6+ chars = Phrase match"
                >
                  ?
                </Button>
                {searchTerm && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSearchTerm("")}
                    className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600"
                  >
                    <XCircle className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            {/* Branch Search Indicator */}
            <div className="mt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-2 sm:space-y-0">
              <div className="flex items-center space-x-2">
                <Building2 className={`h-4 w-4 ${isCrossBranchSearch ? 'text-blue-500' : 'text-gray-400'}`} />
                <span className={`text-sm font-medium ${isCrossBranchSearch ? 'text-blue-600' : 'text-gray-600'}`}>
                  {isCrossBranchSearch 
                    ? `Searching in ${getBranchDisplayName(getOtherBranch())} branch` 
                    : `Searching in ${getBranchDisplayName(currentBranch || "franko")} branch`
                  }
                </span>
              </div>
              {isCrossBranchSearch && (
                <Badge variant="outline" className="text-xs bg-blue-50 text-blue-600 border-blue-200">
                  {t("crossBranchSearch")}
                </Badge>
              )}
            </div>

            {/* Autocomplete Dropdown */}
            {isSearchFocused && (searchTerm.trim() || recentSearches.length > 0) && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
                <div className="p-2">
                  {/* Recent Searches */}
                  {recentSearches.length > 0 && !searchTerm.trim() && (
                    <div className="mb-2">
                      <div className="flex items-center space-x-2 mb-1">
                        <Clock className="h-3 w-3 text-gray-500" />
                        <span className="text-xs font-medium text-gray-700">Recent Searches</span>
                      </div>
                      <div className="grid grid-cols-3 gap-1">
                        {recentSearches.slice(0, 6).map((search, index) => (
                          <button
                            key={index}
                            onClick={() => handleRecentSearchClick(search)}
                            className="text-left px-2 py-1 text-xs text-gray-600 hover:bg-gray-50 rounded-md flex items-center justify-between border border-gray-100 bg-white shadow-sm"
                          >
                            <span className="truncate max-w-[70px]">{search}</span>
                            <Search className="h-3 w-3 text-gray-400 ml-1" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Search Suggestions */}
                  {searchTerm.trim() && (
                    <div>
                      <div className="flex items-center space-x-2 mb-1">
                        <Sparkles className="h-3 w-3 text-pink-500" />
                        <span className="text-xs font-medium text-gray-700">Suggestions</span>
                      </div>
                      <div className="space-y-1">
                        {searchSuggestions.map((suggestion, index) => (
                          <button
                            key={index}
                            onClick={() => setSearchTerm(suggestion)}
                            className="w-full text-left px-2 py-1 text-xs text-gray-600 hover:bg-gray-50 rounded-md"
                          >
                            <span dangerouslySetInnerHTML={{ 
                              __html: suggestion.replace(
                                new RegExp(searchTerm, 'gi'), 
                                `<mark class="bg-yellow-200 font-medium">${searchTerm}</mark>`
                              ) 
                            }} />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Popular Categories */}
                  {!searchTerm.trim() && (
                    <div className="mt-2">
                      <div className="flex items-center space-x-2 mb-1">
                        <Tag className="h-3 w-3 text-blue-500" />
                        <span className="text-xs font-medium text-gray-700">Popular Categories</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {categories.slice(0, 6).map((cat) => (
                          <button
                            key={cat.id}
                            onClick={() => setSelectedCategory(cat.id)}
                            className="px-2 py-1 text-xs bg-blue-50 text-blue-600 rounded-full hover:bg-blue-100"
                          >
                            {cat.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* All Quick Filters in One Compact Horizontal Row */}
          <div className="space-y-2 pb-1">
            {/* Mobile Quick Filters Header - Always Visible */}
            <div className="flex items-center justify-between sm:hidden">
              <span className="text-xs font-medium text-gray-600">{t("quickFilters")}</span>
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

            {/* Desktop Quick Filters - Always Visible */}
            <div className="hidden sm:flex sm:flex-row items-start sm:items-center gap-2 sm:gap-2">
              <span className="text-xs font-medium text-gray-600 mr-2 whitespace-nowrap">{t("quickFilters")}</span>
              
              {/* Status Filter */}
              <div className="w-full sm:w-auto">
                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger className="h-8 px-2 text-xs border-gray-200 focus:border-pink-300 focus:ring-pink-200 w-full sm:w-[120px]">
                    <SelectValue placeholder={t("status")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("allStatus")}</SelectItem>
                    <SelectItem value="normal">{t("inStock")}</SelectItem>
                    <SelectItem value="low_stock">{t("lowStock")}</SelectItem>
                    <SelectItem value="out_of_stock">{t("outOfStock")}</SelectItem>
                    <SelectItem value="overstock">{t("overstock")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Category Filter */}
              <div className="w-full sm:w-auto">
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="h-8 px-2 text-xs border-gray-200 focus:border-pink-300 focus:ring-pink-200 w-full sm:w-[160px]">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Brand Filter */}
              <div className="w-full sm:w-auto">
                <Select value={selectedBrand} onValueChange={setSelectedBrand}>
                  <SelectTrigger className="h-8 px-2 text-xs border-gray-200 focus:border-pink-300 focus:ring-pink-200 w-full sm:w-[160px]">
                    <SelectValue placeholder="Brand" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Brands</SelectItem>
                    {brands.map((brand) => (
                      <SelectItem key={brand} value={brand}>
                        {brand}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Gender Filter */}
              <div className="w-full sm:w-auto">
                <Select value={selectedGender} onValueChange={setSelectedGender}>
                  <SelectTrigger className="h-8 px-2 text-xs border-gray-200 focus:border-pink-300 focus:ring-pink-200 w-full sm:w-[120px]">
                    <SelectValue placeholder="Gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Genders</SelectItem>
                    <SelectItem value="boys">Boys</SelectItem>
                    <SelectItem value="girls">Girls</SelectItem>
                    <SelectItem value="unisex">Unisex</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Age Range Filter */}
              <div className="w-full sm:w-auto">
                <Select value={selectedAgeRange} onValueChange={setSelectedAgeRange}>
                  <SelectTrigger className="h-8 px-2 text-xs border-gray-200 focus:border-pink-300 focus:ring-pink-200 w-full sm:w-[100px]">
                    <SelectValue placeholder="Age Range" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Age Ranges</SelectItem>
                    {ageRanges.map((ageRange) => (
                      <SelectItem key={ageRange} value={ageRange}>
                        {ageRange}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Size Filter */}
              <div className="w-full sm:w-auto">
                <Select value={selectedSize} onValueChange={setSelectedSize}>
                  <SelectTrigger className="h-8 px-2 text-xs border-gray-200 focus:border-pink-300 focus:ring-pink-200 w-full sm:w-[120px]">
                    <SelectValue placeholder="Size" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sizes</SelectItem>
                    <SelectItem value="0-3m">0-3 Months</SelectItem>
                    <SelectItem value="3-6m">3-6 Months</SelectItem>
                    <SelectItem value="6-12m">6-12 Months</SelectItem>
                    <SelectItem value="12-18m">12-18 Months</SelectItem>
                    <SelectItem value="18-24m">18-24 Months</SelectItem>
                    <SelectItem value="xs">XS (4-5)</SelectItem>
                    <SelectItem value="s">S (6-7)</SelectItem>
                    <SelectItem value="m">M (8-9)</SelectItem>
                    <SelectItem value="l">L (10-11)</SelectItem>
                    <SelectItem value="xl">XL (12-13)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Color Filter - Compact */}
              <div className="w-full sm:w-auto">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 px-2 text-xs border-gray-200 focus:border-pink-300 focus:ring-pink-200 w-full sm:w-[110px]"
                    >
                      <Palette className="h-3 w-3 mr-1" />
                      {selectedColor === "all" ? "Color" : selectedColor.replace('-', ' ')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-3">
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-gray-700">Select Color</Label>
                      <div className="grid grid-cols-8 gap-1">
                        <button
                          onClick={() => setSelectedColor("all")}
                          className={`w-6 h-6 rounded-full border-2 transition-all duration-200 ${
                            selectedColor === "all" 
                              ? 'border-pink-500 scale-110' 
                              : 'border-gray-300 hover:border-pink-400 hover:scale-105'
                          }`}
                          title="All Colors"
                        >
                          <div className="w-full h-full rounded-full bg-gradient-to-br from-gray-300 to-gray-400 flex items-center justify-center">
                            <span className="text-xs text-white font-bold">A</span>
                          </div>
                        </button>
                        {colors.slice(0, 15).map((color) => (
                          <button
                            key={color}
                            onClick={() => setSelectedColor(color)}
                            className={`w-6 h-6 rounded-full border-2 transition-all duration-200 ${
                              selectedColor === color 
                                ? 'border-pink-500 scale-110' 
                                : 'border-gray-300 hover:border-pink-400 hover:scale-105'
                            }`}
                            style={{
                              backgroundColor: color === 'baby-peach' ? '#FFCBA4' :
                                color === 'baby-mint' ? '#B8E6B8' :
                                color === 'baby-lavender' ? '#E6E6FA' :
                                color === 'cream' ? '#FFFDD0' :
                                color === 'ivory' ? '#FFFFF0' :
                                color === 'beige' ? '#F5F5DC' :
                                color === 'coral' ? '#FF7F50' :
                                color === 'turquoise' ? '#40E0D0' :
                                color === 'lilac' ? '#C8A2C8' :
                                color === 'sage' ? '#9CAF88' :
                                color === 'white' ? '#FFFFFF' :
                                color === 'black' ? '#000000' :
                                color === 'gray' ? '#6B7280' :
                                color === 'red' ? '#EF4444' :
                                color === 'blue' ? '#3B82F6' :
                                color === 'green' ? '#10B981' :
                                color === 'yellow' ? '#F59E0B' :
                                color === 'orange' ? '#F97316' :
                                color === 'purple' ? '#8B5CF6' :
                                color === 'brown' ? '#92400E' :
                                color === 'baby-pink' ? '#FCE7F3' :
                                color === 'baby-blue' ? '#DBEAFE' :
                                color === 'baby-yellow' ? '#FEF3C7' :
                                color === 'baby-green' ? '#D1FAE5' :
                                color === 'baby-purple' ? '#EDE9FE' : '#FFFFFF'
                            }}
                            title={color.replace('-', ' ')}
                          />
                        ))}
                      </div>
                      {colors.length > 15 && (
                        <div className="text-xs text-gray-500 text-center pt-1">
                          +{colors.length - 15} more colors
                        </div>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Active Filters Count */}
              {(selectedStatus !== "all" || selectedCategory !== "all" || selectedBrand !== "all" || selectedGender !== "all" || selectedAgeRange !== "all" || selectedSize !== "all" || selectedColor !== "all") && (
                <Badge variant="secondary" className="h-6 px-2 text-xs bg-pink-100 text-pink-700 w-full sm:w-auto text-center">
                  {getActiveFilterCount()} active
                </Badge>
              )}
            </div>

            {/* Mobile Quick Filters - Collapsible */}
            {showFilters && (
              <div className="sm:hidden space-y-2">
                {/* Status Filter */}
                <div className="w-full">
                  <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                    <SelectTrigger className="h-8 px-2 text-xs border-gray-200 focus:border-pink-300 focus:ring-pink-200 w-full">
                      <SelectValue placeholder={t("status")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("allStatus")}</SelectItem>
                      <SelectItem value="normal">{t("inStock")}</SelectItem>
                      <SelectItem value="low_stock">{t("lowStock")}</SelectItem>
                      <SelectItem value="out_of_stock">{t("outOfStock")}</SelectItem>
                      <SelectItem value="overstock">{t("overstock")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Category Filter */}
                <div className="w-full">
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger className="h-8 px-2 text-xs border-gray-200 focus:border-pink-300 focus:ring-pink-200 w-full">
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Brand Filter */}
                <div className="w-full">
                  <Select value={selectedBrand} onValueChange={setSelectedBrand}>
                    <SelectTrigger className="h-8 px-2 text-xs border-gray-200 focus:border-pink-300 focus:ring-pink-200 w-full">
                      <SelectValue placeholder="Brand" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Brands</SelectItem>
                      {brands.map((brand) => (
                        <SelectItem key={brand} value={brand}>
                          {brand}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Gender Filter */}
                <div className="w-full">
                  <Select value={selectedGender} onValueChange={setSelectedGender}>
                    <SelectTrigger className="h-8 px-2 text-xs border-gray-200 focus:border-pink-300 focus:ring-pink-200 w-full">
                      <SelectValue placeholder="Gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Genders</SelectItem>
                      <SelectItem value="boys">Boys</SelectItem>
                      <SelectItem value="girls">Girls</SelectItem>
                      <SelectItem value="unisex">Unisex</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Age Range Filter */}
                <div className="w-full">
                  <Select value={selectedAgeRange} onValueChange={setSelectedAgeRange}>
                    <SelectTrigger className="h-8 px-2 text-xs border-gray-200 focus:border-pink-300 focus:ring-pink-200 w-full">
                      <SelectValue placeholder="Age Range" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Age Ranges</SelectItem>
                      {ageRanges.map((ageRange) => (
                        <SelectItem key={ageRange} value={ageRange}>
                          {ageRange}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Size Filter */}
                <div className="w-full">
                  <Select value={selectedSize} onValueChange={setSelectedSize}>
                    <SelectTrigger className="h-8 px-2 text-xs border-gray-200 focus:border-pink-300 focus:ring-pink-200 w-full">
                      <SelectValue placeholder="Size" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Sizes</SelectItem>
                      <SelectItem value="0-3m">0-3 Months</SelectItem>
                      <SelectItem value="3-6m">3-6 Months</SelectItem>
                      <SelectItem value="6-12m">6-12 Months</SelectItem>
                      <SelectItem value="12-18m">12-18 Months</SelectItem>
                      <SelectItem value="18-24m">18-24 Months</SelectItem>
                      <SelectItem value="xs">XS (4-5)</SelectItem>
                      <SelectItem value="s">S (6-7)</SelectItem>
                      <SelectItem value="m">M (8-9)</SelectItem>
                      <SelectItem value="l">L (10-11)</SelectItem>
                      <SelectItem value="xl">XL (12-13)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Color Filter - Compact */}
                <div className="w-full">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 px-2 text-xs border-gray-200 focus:border-pink-300 focus:ring-pink-200 w-full"
                      >
                        <Palette className="h-3 w-3 mr-1" />
                        {selectedColor === "all" ? "Color" : selectedColor.replace('-', ' ')}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 p-3">
                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-gray-700">Select Color</Label>
                        <div className="grid grid-cols-8 gap-1">
                          <button
                            onClick={() => setSelectedColor("all")}
                            className={`w-6 h-6 rounded-full border-2 transition-all duration-200 ${
                              selectedColor === "all" 
                                ? 'border-pink-500 scale-110' 
                                : 'border-gray-300 hover:border-pink-400 hover:scale-105'
                            }`}
                            title="All Colors"
                          >
                            <div className="w-full h-full rounded-full bg-gradient-to-br from-gray-300 to-gray-400 flex items-center justify-center">
                              <span className="text-xs text-white font-bold">A</span>
                            </div>
                          </button>
                          {colors.slice(0, 15).map((color) => (
                            <button
                              key={color}
                              onClick={() => setSelectedColor(color)}
                              className={`w-6 h-6 rounded-full border-2 transition-all duration-200 ${
                                selectedColor === color 
                                  ? 'border-pink-500 scale-110' 
                                  : 'border-gray-300 hover:border-pink-400 hover:scale-105'
                              }`}
                              style={{
                                backgroundColor: color === 'baby-peach' ? '#FFCBA4' :
                                  color === 'baby-mint' ? '#B8E6B8' :
                                  color === 'baby-lavender' ? '#E6E6FA' :
                                  color === 'cream' ? '#FFFDD0' :
                                  color === 'ivory' ? '#FFFFF0' :
                                  color === 'beige' ? '#F5F5DC' :
                                  color === 'coral' ? '#FF7F50' :
                                  color === 'turquoise' ? '#40E0D0' :
                                  color === 'lilac' ? '#C8A2C8' :
                                  color === 'sage' ? '#9CAF88' :
                                  color === 'white' ? '#FFFFFF' :
                                  color === 'black' ? '#000000' :
                                  color === 'gray' ? '#6B7280' :
                                  color === 'red' ? '#EF4444' :
                                  color === 'blue' ? '#3B82F6' :
                                  color === 'green' ? '#10B981' :
                                  color === 'yellow' ? '#F59E0B' :
                                  color === 'orange' ? '#F97316' :
                                  color === 'purple' ? '#8B5CF6' :
                                  color === 'brown' ? '#92400E' :
                                  color === 'baby-pink' ? '#FCE7F3' :
                                  color === 'baby-blue' ? '#DBEAFE' :
                                  color === 'baby-yellow' ? '#FEF3C7' :
                                  color === 'baby-green' ? '#D1FAE5' :
                                  color === 'baby-purple' ? '#EDE9FE' : '#FFFFFF'
                              }}
                              title={color.replace('-', ' ')}
                            />
                          ))}
                        </div>
                        {colors.length > 15 && (
                          <div className="text-xs text-gray-500 text-center pt-1">
                            +{colors.length - 15} more colors
                          </div>
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Active Filters Count */}
                {(selectedStatus !== "all" || selectedCategory !== "all" || selectedBrand !== "all" || selectedGender !== "all" || selectedAgeRange !== "all" || selectedSize !== "all" || selectedColor !== "all") && (
                  <Badge variant="secondary" className="h-6 px-2 text-xs bg-pink-100 text-pink-700 w-full text-center">
                    {getActiveFilterCount()} active
                  </Badge>
                )}
              </div>
            )}
          </div>

          {/* Search Type Indicator */}
          {false && searchTerm.trim() && (
            <div className={`mt-2 p-3 rounded-lg border ${getSearchTypeIndicator(searchTerm)?.bgColor} ${getSearchTypeIndicator(searchTerm)?.borderColor}`}>
              <div className="flex items-center space-x-2">
                <Search className={`h-4 w-4 ${getSearchTypeIndicator(searchTerm)?.color}`} />
                <span className={`text-sm font-medium ${getSearchTypeIndicator(searchTerm)?.color}`}>
                  {getSearchTypeIndicator(searchTerm)?.label}
                </span>
                <span className="text-xs text-gray-600">
                  {getSearchTypeIndicator(searchTerm)?.description}
                </span>
              </div>
            </div>
          )}


        </CardContent>
      </Card>

      {/* Bulk Actions Bar */}
      {selectedItems.size > 0 && (
        <Card className="border-0 shadow-lg bg-gradient-to-r from-red-50 to-red-100">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-5 w-5 text-red-600" />
                  <span className="font-medium text-red-800">
                    {selectedItems.size} product(s) selected
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedItems(new Set())
                    setIsSelectAll(false)
                  }}
                  className="text-red-600 border-red-300 hover:bg-red-50"
                >
                  {t("clearSelection")}
                </Button>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleBulkDelete}
                disabled={isBulkDeleting}
                className="bg-red-600 hover:bg-red-700"
              >
                {isBulkDeleting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {t("deleting")}
                  </>
                ) : (
                  <>
                    <Trash className="h-4 w-4 mr-2" />
                    {t("deleteSelected")} ({selectedItems.size})
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}




      {/* Inventory View */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <Package className="h-5 w-5 text-pink-500" />
              <span>
                {isCrossBranchSearch 
                  ? `${t("search")} ${t("inStock")} ${getBranchDisplayName(getOtherBranch())}`
                  : `${t("inventory")} ${getBranchDisplayName(currentBranch || "franko")}`
                }
              </span>
              {isCrossBranchSearch && (
                <Badge variant="outline" className="text-xs bg-blue-50 text-blue-600 border-blue-200">
                  {t("crossBranchSearch")}
                </Badge>
              )}
            </CardTitle>
            <div className="text-sm text-gray-500">
              {pagination.total} {t("products")}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-pink-500" />
            </div>
          ) : (
            <>
              {viewMode === 'table' ? (
                <div className="overflow-x-auto bg-white rounded-xl border border-gray-100 shadow-sm">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                        <TableHead className="w-16 pl-6">
                          <Checkbox
                              checked={isSelectAll}
                              onCheckedChange={handleSelectAll}
                              aria-label="Select all products"
                              className="h-[18px] w-[18px] rounded-md transition-all duration-200 border-gray-300 shadow-sm hover:border-pink-400 focus:ring-pink-500 data-[state=checked]:bg-pink-500 data-[state=checked]:border-pink-500"
                            />
                        </TableHead>
                        <TableHead className="font-semibold text-gray-700">
                          <div className="flex items-center space-x-1">
                            <span>{t("product")}</span>
                            {sortBy === 'name' && (
                              <span className="text-pink-500">
                                {sortOrder === 'asc' ? <SortAsc className="h-3 w-3" /> : <SortDesc className="h-3 w-3" />}
                              </span>
                            )}
                          </div>
                        </TableHead>
                        <TableHead className="font-semibold text-gray-700 w-48">
                          <div className="flex items-center space-x-1">
                            <span>{t("details")}</span>
                            {sortBy === 'category' && (
                              <span className="text-pink-500">
                                {sortOrder === 'asc' ? <SortAsc className="h-3 w-3" /> : <SortDesc className="h-3 w-3" />}
                              </span>
                            )}
                          </div>
                        </TableHead>
                        <TableHead className="font-semibold text-gray-700">
                          <div className="flex items-center space-x-1">
                            <span>{t("stockLevel")}</span>
                            {(sortBy === 'quantity' || sortBy === 'stock') && (
                              <span className="text-pink-500">
                                {sortOrder === 'asc' ? <SortAsc className="h-3 w-3" /> : <SortDesc className="h-3 w-3" />}
                              </span>
                            )}
                          </div>
                        </TableHead>
                        <TableHead className="font-semibold text-gray-700">{t("status")}</TableHead>
                        {/* Show Branch column when doing cross-branch search */}
                        {isCrossBranchSearch && (
                          <TableHead className="font-semibold text-gray-700">{t("branch")}</TableHead>
                        )}
                        <TableHead className="font-semibold text-gray-700">
                          <div className="flex items-center space-x-1">
                            <span>{t("sellingPrice")}</span>
                            {sortBy === 'price' && (
                              <span className="text-pink-500">
                                {sortOrder === 'asc' ? <SortAsc className="h-3 w-3" /> : <SortDesc className="h-3 w-3" />}
                              </span>
                            )}
                          </div>
                        </TableHead>
                        <TableHead className="font-semibold text-gray-700 text-center">{t("actions")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {groupedProducts.map((product) => (
                        <ExpandableProductRow
                          key={product.product_id}
                          product={product}
                          isSelected={selectedItems.has(product.product_id)}
                          onSelect={handleSelectItem}
                          showBranchColumn={isCrossBranchSearch}
                          disableActions={isCrossBranchSearch}
                          onEditProduct={(product) => {
                            // Convert ProductWithVariations to InventoryItem for compatibility
                            const firstVariation = product.variations[0]
                            const item: InventoryItem = {
                              id: firstVariation.id,
                              product_id: product.product_id,
                              product_name: product.product_name,
                              product_sku: product.product_sku,
                              product_type: product.product_type,
                              branch_id: firstVariation.branch_name, // This will be updated
                              branch_name: firstVariation.branch_name,
                              quantity: firstVariation.quantity,
                              min_stock_level: firstVariation.min_stock_level,
                              max_stock_level: firstVariation.max_stock_level,
                              stock_status: firstVariation.stock_status,
                              category_name: product.category_name,
                              price: firstVariation.price,
                              cost_price: firstVariation.cost_price,
                              purchase_price: firstVariation.purchase_price,
                              color: firstVariation.color,
                              size: firstVariation.size,
                              brand: product.brand,
                              age_range: product.age_range,
                              gender: product.gender,
                              last_restocked: "",
                              total_stock: product.variations.reduce((sum, v) => sum + v.quantity, 0),
                              branch_count: 1,
                              image_url: product.image_url,
                              description: product.description,
                              variation_id: firstVariation.variation_id,
                              variation_sku: firstVariation.variation_sku
                            }
                            handleEditProduct(item)
                          }}
                          onEditVariation={handleEditVariation}
                          onDeleteProduct={(product) => {
                            // Convert ProductWithVariations to InventoryItem for compatibility
                            const firstVariation = product.variations[0]
                            const item: InventoryItem = {
                              id: firstVariation.id,
                              product_id: product.product_id,
                              product_name: product.product_name,
                              product_sku: product.product_sku,
                              product_type: product.product_type,
                              branch_id: firstVariation.branch_name, // This will be updated
                              branch_name: firstVariation.branch_name,
                              quantity: firstVariation.quantity,
                              min_stock_level: firstVariation.min_stock_level,
                              max_stock_level: firstVariation.max_stock_level,
                              stock_status: firstVariation.stock_status,
                              category_name: product.category_name,
                              price: firstVariation.price,
                              cost_price: firstVariation.cost_price,
                              purchase_price: firstVariation.purchase_price,
                              color: firstVariation.color,
                              size: firstVariation.size,
                              brand: product.brand,
                              age_range: product.age_range,
                              gender: product.gender,
                              last_restocked: "",
                              total_stock: product.variations.reduce((sum, v) => sum + v.quantity, 0),
                              branch_count: 1,
                              image_url: product.image_url,
                              description: product.description,
                              variation_id: firstVariation.variation_id,
                              variation_sku: firstVariation.variation_sku
                            }
                            handleDeleteProduct(item)
                          }}
                          onSellProduct={(productId) => {
                            window.location.href = `/dashboard/sell?productId=${productId}`
                          }}
                          getStatusBadge={getStatusBadge}
                          getColorClass={getColorClass}
                          getColorStyle={getColorStyle}
                        />
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
                  {groupedProducts.map((product) => {
                    const firstVariation = product.variations[0]
                    const totalStock = product.variations.reduce((sum, v) => sum + v.quantity, 0)
                    const totalValue = product.variations.reduce((sum, v) => sum + (v.price * v.quantity), 0)
                    const hasLowStock = product.variations.some(v => v.stock_status === 'low_stock')
                    const hasOutOfStock = product.variations.some(v => v.stock_status === 'out_of_stock')
                    const hasOverstock = product.variations.some(v => v.stock_status === 'overstock')
                    
                    const getOverallStatus = () => {
                      if (hasOutOfStock) return 'out_of_stock'
                      if (hasLowStock) return 'low_stock'
                      if (hasOverstock) return 'overstock'
                      return 'normal'
                    }
                    
                                         return (
                    <Card 
                        key={product.product_id} 
                      className="group hover:shadow-2xl hover:scale-[1.02] transition-all duration-300 border-0 shadow-lg bg-white overflow-hidden relative"
                    >
                      {/* Product Header */}
                      <div className="relative p-4 bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 border-b border-gray-100">
                        <div className="flex items-center justify-between">
                          {/* Selection Checkbox */}
                          <Checkbox
                              checked={selectedItems.has(product.product_id)}
                              onCheckedChange={(checked) => handleSelectItem(product.product_id, checked as boolean)}
                              aria-label={`Select ${product.product_name}`}
                            className="data-[state=checked]:bg-pink-500 data-[state=checked]:border-pink-500"
                          />
                          
                          {/* Status Badge */}
                            {getStatusBadge(getOverallStatus())}
                        </div>
                      </div>

                      <CardContent className="p-5 space-y-4">
                        {/* Product Title & SKU */}
                        <div>
                          <h3 className="font-bold text-gray-900 mb-2 text-lg leading-tight line-clamp-2" title={product.product_name}>
                            {product.product_name}
                          </h3>
                          <p className="text-sm text-gray-500 font-mono bg-gray-50 px-2 py-1 rounded-md inline-block">
                            SKU: {product.product_sku}
                          </p>
                        </div>

                        {/* Tags */}
                        <div className="flex flex-wrap gap-2">
                          <Badge 
                            variant="outline" 
                            className="text-xs bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100 transition-colors px-2 py-1"
                          >
                            <Tag className="h-3 w-3 mr-1" />
                            {product.category_name}
                          </Badge>
                          {product.brand && (
                            <Badge 
                              variant="outline" 
                              className="text-xs bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100 transition-colors px-2 py-1"
                            >
                              <Star className="h-3 w-3 mr-1" />
                              {product.brand}
                            </Badge>
                          )}
                          {product.product_type === 'variation' && (
                            <Badge 
                              variant="outline" 
                              className="text-xs bg-purple-50 text-purple-600 border-purple-200 hover:bg-purple-100 transition-colors px-2 py-1"
                            >
                              <Package className="h-3 w-3 mr-1" />
                              {product.variations.length} variations
                            </Badge>
                          )}
                        </div>

                        {/* Branch Info */}
                        <div className="flex items-center space-x-2 p-2 rounded-lg bg-blue-50 border border-blue-100">
                          <Building2 className="h-4 w-4 text-blue-500" />
                          <span className="text-sm font-medium text-blue-700">{firstVariation.branch_name}</span>
                        </div>

                        {/* Stock Info Card */}
                        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100 shadow-sm">
                          <div className="text-center space-y-2">
                            <div className="flex items-center justify-center space-x-1">
                              <span className="text-2xl font-bold text-blue-700">{totalStock}</span>
                              <span className="text-sm font-medium text-blue-600">pieces</span>
                          </div>
                            <div className="flex items-center justify-center space-x-3 text-xs">
                              <span className="text-gray-500">
                                {product.variations.length} variation{product.variations.length !== 1 ? 's' : ''}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Price Card */}
                        <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-4 border border-green-200">
                          <div className="text-center">
                            <p className="text-2xl font-bold text-green-700 mb-1">
                              {Number(totalValue).toFixed(0)} ብር
                            </p>
                            <p className="text-xs text-gray-500">Total Value</p>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                          <div className="flex space-x-2">
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => {
                                // Convert ProductWithVariations to InventoryItem for compatibility
                                const item: InventoryItem = {
                                  id: firstVariation.id,
                                  product_id: product.product_id,
                                  product_name: product.product_name,
                                  product_sku: product.product_sku,
                                  product_type: product.product_type,
                                  branch_id: firstVariation.branch_name,
                                  branch_name: firstVariation.branch_name,
                                  quantity: firstVariation.quantity,
                                  min_stock_level: firstVariation.min_stock_level,
                                  max_stock_level: firstVariation.max_stock_level,
                                  stock_status: firstVariation.stock_status,
                                  category_name: product.category_name,
                                  price: firstVariation.price,
                                  cost_price: firstVariation.cost_price,
                                  purchase_price: firstVariation.purchase_price,
                                  color: firstVariation.color,
                                  size: firstVariation.size,
                                  brand: product.brand,
                                  age_range: product.age_range,
                                  gender: product.gender,
                                  last_restocked: "",
                                  total_stock: totalStock,
                                  branch_count: 1,
                                  image_url: product.image_url,
                                  description: product.description,
                                  variation_id: firstVariation.variation_id,
                                  variation_sku: firstVariation.variation_sku
                                }
                                handleEditProduct(item)
                              }}
                              className="h-9 px-3 border-blue-200 text-blue-600 hover:bg-blue-50 hover:border-blue-300 transition-all duration-200"
                              disabled={isCrossBranchSearch}
                              title="Edit Product"
                            >
                              <Edit className="h-4 w-4 mr-1" />
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => {
                                window.location.href = `/dashboard/sell?productId=${product.product_id}`
                              }}
                              className="h-9 px-3 bg-green-100 text-green-600 hover:bg-green-200 border-green-200 transition-all duration-200"
                              disabled={isCrossBranchSearch}
                              title="Sell Product"
                            >
                              <ShoppingBag className="h-4 w-4 mr-1" />
                              Sell
                            </Button>
                          </div>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              // Convert ProductWithVariations to InventoryItem for compatibility
                              const item: InventoryItem = {
                                id: firstVariation.id,
                                product_id: product.product_id,
                                product_name: product.product_name,
                                product_sku: product.product_sku,
                                product_type: product.product_type,
                                branch_id: firstVariation.branch_name,
                                branch_name: firstVariation.branch_name,
                                quantity: firstVariation.quantity,
                                min_stock_level: firstVariation.min_stock_level,
                                max_stock_level: firstVariation.max_stock_level,
                                stock_status: firstVariation.stock_status,
                                category_name: product.category_name,
                                price: firstVariation.price,
                                cost_price: firstVariation.cost_price,
                                purchase_price: firstVariation.purchase_price,
                                color: firstVariation.color,
                                size: firstVariation.size,
                                brand: product.brand,
                                age_range: product.age_range,
                                gender: product.gender,
                                last_restocked: "",
                                total_stock: totalStock,
                                branch_count: 1,
                                image_url: product.image_url,
                                description: product.description,
                                variation_id: firstVariation.variation_id,
                                variation_sku: firstVariation.variation_sku
                              }
                              handleDeleteProduct(item)
                            }}
                            className="h-9 w-9 p-0 bg-red-100 text-red-600 hover:bg-red-200 border-red-200 transition-all duration-200"
                            disabled={isCrossBranchSearch}
                            title="Delete Product"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )})}
                </div>
              )}

              {/* Pagination */}
              {pagination.total_pages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between mt-8 p-6 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl border border-gray-200">
                  <div className="text-sm text-gray-600 mb-4 sm:mb-0 flex items-center space-x-2">
                    <Activity className="h-4 w-4 text-pink-500" />
                    <span className="font-medium">
                      {t("showing")} <span className="text-pink-600 font-bold">{((pagination.page - 1) * pagination.limit) + 1}</span> {t("to")}{' '}
                      <span className="text-pink-600 font-bold">{Math.min(pagination.page * pagination.limit, pagination.total)}</span> {t("of")}{' '}
                      <span className="text-pink-600 font-bold">{pagination.total}</span> {t("results")}
                    </span>
                  </div>
                  <div className="flex items-center space-x-3">
                    {/* First Page */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(1)}
                      disabled={!pagination.has_prev}
                      className="h-10 w-10 p-0 border-gray-300 hover:border-pink-300 hover:bg-pink-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                      title={t("firstPage")}
                    >
                      <ChevronsLeft className="h-4 w-4" />
                    </Button>
                    
                    {/* Previous Page */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(pagination.page - 1)}
                      disabled={!pagination.has_prev}
                      className="h-10 w-10 p-0 border-gray-300 hover:border-pink-300 hover:bg-pink-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                      title={t("previousPage")}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>

                    {/* Page Numbers */}
                    <div className="flex items-center space-x-1">
                      {Array.from({ length: Math.min(5, pagination.total_pages) }, (_, i) => {
                        let pageNum;
                        if (pagination.total_pages <= 5) {
                          pageNum = i + 1;
                        } else if (pagination.page <= 3) {
                          pageNum = i + 1;
                        } else if (pagination.page >= pagination.total_pages - 2) {
                          pageNum = pagination.total_pages - 4 + i;
                        } else {
                          pageNum = pagination.page - 2 + i;
                        }
                        
                        return (
                          <Button
                            key={pageNum}
                            variant={pageNum === pagination.page ? "default" : "outline"}
                            size="sm"
                            onClick={() => handlePageChange(pageNum)}
                            className={`h-10 w-10 p-0 transition-all duration-200 ${
                              pageNum === pagination.page
                                ? "bg-gradient-to-r from-pink-500 to-purple-500 text-white border-transparent shadow-lg"
                                : "border-gray-300 hover:border-pink-300 hover:bg-pink-50"
                            }`}
                          >
                            {pageNum}
                          </Button>
                        );
                      })}
                    </div>

                    {/* Next Page */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(pagination.page + 1)}
                      disabled={!pagination.has_next}
                      className="h-10 w-10 p-0 border-gray-300 hover:border-pink-300 hover:bg-pink-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                      title={t("nextPage")}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    
                    {/* Last Page */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(pagination.total_pages)}
                      disabled={!pagination.has_next}
                      className="h-10 w-10 p-0 border-gray-300 hover:border-pink-300 hover:bg-pink-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                      title={t("lastPage")}
                    >
                      <ChevronsRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              {/* Empty State */}
              {inventory.length === 0 && !isLoading && (
                <div className="text-center py-16">
                  <div className="max-w-md mx-auto">
                    <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center">
                      <Package className="h-12 w-12 text-gray-400" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">{t("noProductsFoundTitle" as any)}</h3>
                    <p className="text-gray-500 mb-6">
                      {searchTerm || selectedStatus !== "all" || selectedCategory !== "all" 
                        ? t("noProductsMatchFilters" as any)
                        : t("noProductsAddedYet" as any)
                      }
                    </p>
                    <div className="flex flex-col sm:flex-row items-center justify-center space-y-2 sm:space-y-0 sm:space-x-4">
                      {(searchTerm || selectedStatus !== "all" || selectedCategory !== "all") && (
                        <Button
                          variant="outline"
                          onClick={handleClearFilters}
                          className="border-pink-200 text-pink-600 hover:bg-pink-50"
                        >
                          <FilterX className="h-4 w-4 mr-2" />
                          {t("filter")}
                        </Button>
                      )}
                      <Button 
                        onClick={() => window.location.href = '/dashboard/add-product'}
                        className="bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        {t("addProduct")}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      

      {/* Product Edit Modal */}
      <ProductEditModal
        product={selectedProduct}
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false)
          setSelectedProduct(null)
                  setSelectedVariation(null)
        }}
        onSuccess={handleEditSuccess}
                scope={editScope}
                variation={selectedVariation}
      />
    </div>
  )
} 