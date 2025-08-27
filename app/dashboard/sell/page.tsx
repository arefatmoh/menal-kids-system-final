"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
// removed unused Label
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
// removed unused Table, Command, Popover, ScrollArea
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { 
  ShoppingBag, 
  Plus, 
  Minus, 
  Trash2, 
  DollarSign, 
  Package, 
  Clock, 
  Loader2,
  Search,
  Sparkles,
  XCircle,
  CheckCircle,
  Users,
  CreditCard,
  Smartphone,
  Building2,
  Zap,
  SortAsc,
  SortDesc,
  Grid3X3,
  List,
  RefreshCw,
  BarChart3,
  ChevronDown,
  ChevronUp,
  Layers,
  X
} from "lucide-react"
import apiClient from "@/lib/api-client"
import { useToast } from "@/hooks/use-toast"
import { useLanguage } from "@/lib/language-context"
import { useBranch } from "@/lib/branch-context"
import { useSearchParams } from "next/navigation"
import { useDebounce } from "@/hooks/use-debounce"

interface Product {
  id: string
  name: string
  sku: string
  price: number
  purchase_price?: number
  total_stock: number
  category_name: string
  color?: string
  size?: string
  brand?: string
  age_range?: string
  gender?: string
  product_type?: string
  variations?: Variation[]
}

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

interface CartItem {
  id: string
  name: string
  original_price: number
  current_price: number
  quantity: number
  category?: string
  size?: string
  color?: string
  brand?: string
  age?: string
  sex?: string
  variation_id?: string
  variation_sku?: string
  product_type?: string
  max_quantity?: number
  productId?: string
}

export default function SellProductsPage() {
  const { t } = useLanguage()
  // removed unused userRole
  const [products, setProducts] = useState<Product[]>([])
  const [productsWithVariations, setProductsWithVariations] = useState<ProductWithVariations[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [selectedProduct, setSelectedProduct] = useState("")
  const [selectedVariation, setSelectedVariation] = useState("")
  const [quantity, setQuantity] = useState("1")
  const [customerName, setCustomerName] = useState("")
  const [customerPhone, setCustomerPhone] = useState("")
  const [paymentMethod, setPaymentMethod] = useState("cash")
  const [isProcessing, setIsProcessing] = useState(false)
  interface LastSale { items: CartItem[]; total: number; sale: unknown }
  const [lastSale, setLastSale] = useState<LastSale | null>(null)
  // Auto-dismiss success card after a short delay
  useEffect(() => {
    if (!lastSale) return
    const timer = setTimeout(() => setLastSale(null), 6000)
    return () => clearTimeout(timer)
  }, [lastSale])
  const [searchTerm, setSearchTerm] = useState("")
  const [debouncedSearchTerm] = useDebounce(searchTerm, 300)
  const [isSearchFocused, setIsSearchFocused] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [sortBy, setSortBy] = useState<string>('name')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [showFilters, setShowFilters] = useState(false)
  const [selectedCategories] = useState<Set<string>>(new Set())
  const [selectedBrands] = useState<Set<string>>(new Set())
  // removed unused showManualAdd setter usage
  const [showManualAdd] = useState(false)
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false)
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null)
  const [editingPriceValue, setEditingPriceValue] = useState("")
  const [searchSuggestions, setSearchSuggestions] = useState<string[]>([])
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  // removed unused local filtered arrays
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set())
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false)
  // Quick filter states (aligned with Inventory page)
  const [selectedStatus, setSelectedStatus] = useState("all")
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [selectedBrand, setSelectedBrand] = useState("all")
  const [selectedGender, setSelectedGender] = useState("all")
  const [selectedAgeRange, setSelectedAgeRange] = useState("all")
  const [selectedSize, setSelectedSize] = useState("all")
  const [selectedColor, setSelectedColor] = useState("all")
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 1000])
  const [stockRange, setStockRange] = useState<[number, number]>([0, 100])
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([])
  const [brands, setBrands] = useState<string[]>([])
  const [ageRanges, setAgeRanges] = useState<string[]>([])
  const [colors, setColors] = useState<string[]>([])
  
  const { currentBranch } = useBranch()
  const { toast } = useToast()
  const searchParams = useSearchParams()
  const formRef = useRef<HTMLFormElement>(null)

  // Manual add form state
  const [manualProduct, setManualProduct] = useState({
    name: "",
    category: "",
    size: "",
    color: "",
    price: "",
    quantity: "1",
    brand: "",
    age: "",
    sex: "",
  })

  // Smart search logic (similar to inventory page)
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

  const formatSearchForAPI = (searchTerm: string) => {
    const searchInfo = getSearchType(searchTerm)
    
    switch (searchInfo.type) {
      case 'partial':
        return {
          search: searchInfo.term,
          search_type: 'partial',
          search_mode: 'contains'
        }
      case 'phrase':
        return {
          search: searchInfo.term,
          search_type: 'phrase',
          search_mode: 'exact'
        }
      default:
        return {
          search: searchInfo.term,
          search_type: 'exact',
          search_mode: 'exact'
        }
    }
  }

  // Enhanced search suggestions
  const generateSearchSuggestions = useMemo<string[]>(() => {
    if (!searchTerm.trim()) return []
    
    const suggestions: string[] = []
    const searchLower = searchTerm.toLowerCase()
    
    // Add product name suggestions from simple products
    products.forEach(product => {
      if (product.name.toLowerCase().includes(searchLower)) {
        suggestions.push(product.name)
      }
    })
    
    // Add product name suggestions from variation products
    productsWithVariations.forEach(product => {
      if (product.product_name.toLowerCase().includes(searchLower)) {
        suggestions.push(product.product_name)
      }
    })
    
    // Add brand suggestions
    const brands = [...new Set([
      ...products.map(p => p.brand).filter((brand): brand is string => brand !== undefined),
      ...productsWithVariations.map(p => p.brand).filter((brand): brand is string => brand !== undefined)
    ])]
    brands.forEach(brand => {
      if (brand && brand.toLowerCase().includes(searchLower)) {
        suggestions.push(brand)
      }
    })
    
    // Add category suggestions
    const categories = [...new Set([
      ...products.map(p => p.category_name).filter(Boolean),
      ...productsWithVariations.map(p => p.category_name).filter(Boolean)
    ])]
    categories.forEach(category => {
      if (category.toLowerCase().includes(searchLower)) {
        suggestions.push(category)
      }
    })
    
    // Remove duplicates and limit results
    return [...new Set(suggestions)].slice(0, 5)
  }, [searchTerm, products, productsWithVariations])

  // Update search suggestions
  useEffect(() => {
    setSearchSuggestions(generateSearchSuggestions)
  }, [generateSearchSuggestions])

  // Add to recent searches when search is performed
  useEffect(() => {
    if (searchTerm.trim() && !recentSearches.includes(searchTerm.trim())) {
      setRecentSearches(prev => [searchTerm.trim(), ...prev.slice(0, 4)])
    }
  }, [searchTerm, recentSearches])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl/Cmd + K: Focus search
      if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
        event.preventDefault()
        const searchInput = document.querySelector('input[placeholder*="Search products"]') as HTMLInputElement
        if (searchInput) {
          searchInput.focus()
        }
      }
      
      // Ctrl/Cmd + Enter: Complete sale
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && cart.length > 0) {
        event.preventDefault()
        handleCompleteSale()
      }
      
      // Escape: Clear search
      if (event.key === 'Escape') {
        setSearchTerm("")
        setIsSearchFocused(false)
      }
      
      // Ctrl/Cmd + R: Refresh products
      if ((event.ctrlKey || event.metaKey) && event.key === 'r') {
        event.preventDefault()
        handleRefreshProducts()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [cart.length])

  // Auto-refresh products every 10 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isRefreshing) {
        handleRefreshProducts()
      }
    }, 600000) // 10 minutes

    return () => clearInterval(interval)
  }, [isRefreshing])

  // Handle refresh products
  const handleRefreshProducts = async () => {
    setIsRefreshing(true)
    try {
      await fetchProducts(searchTerm)
      setLastUpdate(new Date())
      toast({
        title: "Products Updated",
        description: "Inventory has been refreshed",
      })
    } catch (error) {
      console.error("Refresh error:", error)
    } finally {
      setIsRefreshing(false)
    }
  }

  // Filter and sort products
  const processedProducts = useMemo(() => {
    let filtered = products

    // Apply search filter
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase()
      filtered = filtered.filter(product => 
        (product.name || "").toLowerCase().includes(searchLower) ||
        (product.sku || "").toLowerCase().includes(searchLower) ||
        (product.brand && product.brand.toLowerCase().includes(searchLower)) ||
        (product.category_name || "").toLowerCase().includes(searchLower)
      )
    }

    // Apply category filter
    if (selectedCategories.size > 0) {
      filtered = filtered.filter(product => 
        selectedCategories.has(product.category_name)
      )
    }

    // Apply brand filter
    if (selectedBrands.size > 0) {
      filtered = filtered.filter(product => 
        product.brand && selectedBrands.has(product.brand)
      )
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue: string | number
      let bValue: string | number
      
      switch (sortBy) {
        case 'name':
          aValue = a.name.toLowerCase()
          bValue = b.name.toLowerCase()
          break
        case 'price':
          aValue = a.price
          bValue = b.price
          break
        case 'stock':
          aValue = a.total_stock
          bValue = b.total_stock
          break
        case 'category':
          aValue = a.category_name.toLowerCase()
          bValue = b.category_name.toLowerCase()
          break
        default:
          aValue = a.name.toLowerCase()
          bValue = b.name.toLowerCase()
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1
      } else {
        return aValue < bValue ? 1 : -1
      }
    })

    return filtered
  }, [products, searchTerm, selectedCategories, selectedBrands, sortBy, sortOrder])

  // Filter and sort products with variations
  const processedProductsWithVariations = useMemo(() => {
    let filtered = productsWithVariations

    // Apply search filter
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase()
      filtered = filtered.filter(product => 
        (product.product_name || "").toLowerCase().includes(searchLower) ||
        (product.product_sku || "").toLowerCase().includes(searchLower) ||
        (product.brand && product.brand.toLowerCase().includes(searchLower)) ||
        (product.category_name || "").toLowerCase().includes(searchLower)
      )
    }

    // Apply category filter
    if (selectedCategories.size > 0) {
      filtered = filtered.filter(product => 
        selectedCategories.has(product.category_name)
      )
    }

    // Apply brand filter
    if (selectedBrands.size > 0) {
      filtered = filtered.filter(product => 
        product.brand && selectedBrands.has(product.brand)
      )
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue: string | number
      let bValue: string | number
      
      switch (sortBy) {
        case 'name':
          aValue = a.product_name.toLowerCase()
          bValue = b.product_name.toLowerCase()
          break
        case 'price':
          // Use the minimum price among variations
          aValue = Math.min(...a.variations.map(v => v.price))
          bValue = Math.min(...b.variations.map(v => v.price))
          break
        case 'stock':
          // Use total stock across all variations
          aValue = a.variations.reduce((sum, v) => sum + v.quantity, 0)
          bValue = b.variations.reduce((sum, v) => sum + v.quantity, 0)
          break
        case 'category':
          aValue = a.category_name.toLowerCase()
          bValue = b.category_name.toLowerCase()
          break
        default:
          aValue = a.product_name.toLowerCase()
          bValue = b.product_name.toLowerCase()
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1
      } else {
        return aValue < bValue ? 1 : -1
      }
    })

    return filtered
  }, [productsWithVariations, searchTerm, selectedCategories, selectedBrands, sortBy, sortOrder])

  // Combined products for display (simple products + variation products)
  const allProductsForDisplay = useMemo(() => {
    const simpleProducts = processedProducts.map(product => ({
      ...product,
      isVariation: false,
      displayName: product.name,
      displaySku: product.sku,
      displayPrice: product.price,
      displayPurchasePrice: product.purchase_price,
      displayStock: product.total_stock,
      displayCategory: product.category_name,
      displayBrand: product.brand,
      displayColor: product.color,
      displaySize: product.size,
      product_id: product.id, // Add this for consistency
      variations: undefined // Add this for consistency
    }))

    const variationProducts = processedProductsWithVariations.map(product => ({
      ...product,
      isVariation: true,
      displayName: product.product_name,
      displaySku: product.product_sku,
      displayPrice: Math.min(...product.variations.map(v => v.price)),
      displayPurchasePrice: (() => {
        const vals = product.variations.map(v => v.purchase_price).filter((p): p is number => typeof p === 'number')
        return vals.length ? Math.min(...vals) : undefined
      })(),
      displayStock: product.variations.reduce((sum, v) => sum + v.quantity, 0),
      displayCategory: product.category_name,
      displayBrand: product.brand,
      displayColor: product.variations[0]?.color,
      displaySize: product.variations[0]?.size,
      id: product.product_id, // Add this for consistency
      variations: product.variations
    }))

    return [...simpleProducts, ...variationProducts]
  }, [processedProducts, processedProductsWithVariations])

  useEffect(() => {
    fetchProducts()
  }, [currentBranch])

  // Debounced server search aligned with Inventory page
  useEffect(() => {
    const safe = debouncedSearchTerm || ""
    fetchProducts(safe)
  }, [debouncedSearchTerm, currentBranch])

  // Populate option lists
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const res = await apiClient.getCategories()
        if (res.success && res.data) {
          setCategories(res.data as { id: string; name: string }[])
        }
      } catch {}
    }
    loadCategories()
  }, [])

  // Derive brands, age ranges, colors from fetched inventory data
  useEffect(() => {
    const brandSet = new Set<string>()
    const ageSet = new Set<string>()
    const colorSet = new Set<string>()
    products.forEach(p => {
      if (p.brand) brandSet.add(p.brand)
      if (p.age_range) ageSet.add(p.age_range)
      if (p.color) colorSet.add(p.color)
    })
    productsWithVariations.forEach(p => {
      if (p.brand) brandSet.add(p.brand)
      if (p.age_range) ageSet.add(p.age_range)
      p.variations.forEach(v => { if (v.color) colorSet.add(v.color) })
    })
    setBrands(Array.from(brandSet).sort())
    setAgeRanges(Array.from(ageSet).sort())
    setColors(Array.from(colorSet).sort())
  }, [products, productsWithVariations])

  useEffect(() => {
    // Pre-select product if productId is in query params
    const productId = searchParams.get("productId")
    if (productId && products.length > 0) {
      setSelectedProduct(productId)
    }
  }, [searchParams, products])

  const fetchProducts = async (search: string = "") => {
    setIsLoading(true)
    try {
      const params: Record<string, unknown> = {
        page: 1,
        limit: 100,
      }

      if (currentBranch !== "all") {
        const { getBranchIdForDatabase } = await import("@/lib/utils")
        params.branch_id = getBranchIdForDatabase(currentBranch)
      }

      // Advanced search params (same behavior as inventory)
      if (search && search.trim()) {
        const cfg = formatSearchForAPI(search)
        params.search = cfg.search
        params.search_type = cfg.search_type
        params.search_mode = cfg.search_mode
      }

      // Quick filter params
      if (selectedStatus !== "all") params.status = selectedStatus
      if (selectedCategory !== "all") params.category = selectedCategory
      if (selectedBrand !== "all") params.brand = selectedBrand
      if (selectedGender !== "all") params.gender = selectedGender
      if (selectedAgeRange !== "all") params.age_range = selectedAgeRange
      if (selectedSize !== "all") params.size = selectedSize
      if (selectedColor !== "all") params.color = selectedColor
      if (priceRange[0] > 0) params.price_min = priceRange[0]
      if (priceRange[1] < 1000) params.price_max = priceRange[1]
      if (stockRange[0] > 0) params.stock_min = stockRange[0]
      if (stockRange[1] < 100) params.stock_max = stockRange[1]

      // Use inventory API to get products with stock information
      const response = await apiClient.getInventory(params)
      
      if (response.success && response.data) {
        // Transform inventory data to product format
        const inventoryData = Array.isArray(response.data) ? (response.data as Array<Record<string, unknown>>) : []
        
        // Group by product_id to handle variations
        const productGroups = new Map<string, Array<Record<string, any>>>()
        inventoryData.forEach((item) => {
          const pid = (item as any).product_id as string
          if (!productGroups.has(pid)) {
            productGroups.set(pid, [])
          }
          productGroups.get(pid)!.push(item as Record<string, any>)
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
              total_stock: totalQuantity,
              category_name: firstItem.category_name,
              color: firstItem.color,
              size: firstItem.size,
              brand: firstItem.brand,
              age_range: firstItem.age_range,
              gender: firstItem.gender,
              product_type: firstItem.product_type || 'uniform'
            }
            simpleProducts.push(simpleProduct)
          }
        })

        setProductsWithVariations(productsWithVariations)
        setProducts(simpleProducts)
      } else {
        toast({
          title: "Error",
          description: "Failed to load products",
          variant: "destructive",
        })
      }
    } catch (error: unknown) {
      console.error("Products fetch error:", error)
      toast({
        title: "Error",
        description: "Failed to load products",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Count active filters
  const getActiveFilterCount = () => {
    let count = 0
    if (selectedStatus !== "all") count++
    if (selectedCategory !== "all") count++
    if (selectedBrand !== "all") count++
    if (selectedGender !== "all") count++
    if (selectedAgeRange !== "all") count++
    if (selectedSize !== "all") count++
    if (selectedColor !== "all") count++
    if (priceRange[0] > 0 || priceRange[1] < 1000) count++
    if (stockRange[0] > 0 || stockRange[1] < 100) count++
    return count
  }

  const handleClearFilters = () => {
    setSelectedStatus("all")
    setSelectedCategory("all")
    setSelectedBrand("all")
    setSelectedGender("all")
    setSelectedAgeRange("all")
    setSelectedSize("all")
    setSelectedColor("all")
    setPriceRange([0, 1000])
    setStockRange([0, 100])
    fetchProducts(searchTerm)
  }

  // Auto-refetch when quick filters change (debounced with search)
  useEffect(() => {
    const timeout = setTimeout(() => {
      fetchProducts(debouncedSearchTerm || "")
    }, 300)
    return () => clearTimeout(timeout)
  }, [selectedStatus, selectedCategory, selectedBrand, selectedGender, selectedAgeRange, selectedSize, selectedColor, priceRange, stockRange, debouncedSearchTerm])

  const addToCart = () => {
    if (!selectedProduct) return

    // Check if it's a variation product
    const variationProduct = productsWithVariations.find((p) => p.product_id === selectedProduct)
    
    if (variationProduct) {
      // Handle variation product
      if (!selectedVariation) {
        toast({
          title: "Variation Required",
          description: "Please select a variation for this product",
          variant: "destructive",
        })
        return
      }

      const variation = variationProduct.variations.find((v) => v.variation_id === selectedVariation)
      if (!variation) return
      // Price validation removed - allow items with price 0

      const cartId = `${variationProduct.product_id}:${selectedVariation}`
      const existingItem = cart.find((item) => item.id === cartId)
      const qtyToAdd = Number.parseInt(quantity) || 1
      const max = variation.quantity || 0
      const existingQty = existingItem?.quantity || 0
      if (max <= 0 || existingQty + qtyToAdd > max) {
        toast({
          title: "❌ Not enough stock available.",
          description: `(Available: ${max}, Requested: ${existingQty + qtyToAdd})`,
          variant: "destructive",
        })
        return
      }

      if (existingItem) {
        setCart(cart.map((item) => 
          item.id === cartId
            ? { ...item, quantity: item.quantity + qtyToAdd } 
            : item
        ))
      } else {
        setCart([
          ...cart,
          {
            id: cartId,
            name: `${variationProduct.product_name} (${variation.color || ''} ${variation.size || ''})`.trim(),
            original_price: Number(variation.price),
            current_price: Number(variation.price),
            quantity: qtyToAdd,
            category: variationProduct.category_name,
            size: variation.size,
            color: variation.color,
            brand: variationProduct.brand,
            age: variationProduct.age_range,
            sex: variationProduct.gender,
            variation_id: variation.variation_id,
            variation_sku: variation.variation_sku,
            product_type: 'variation',
            max_quantity: max,
            productId: variationProduct.product_id,
          },
        ])
      }
    } else {
      // Handle simple product
      const product = products.find((p) => p.id === selectedProduct)
      if (!product) return
      // Price validation removed - allow items with price 0

      const existingItem = cart.find((item) => item.id === product.id && !item.variation_id)
      const qtyToAdd = Number.parseInt(quantity) || 1
      const candidate = allProductsForDisplay.find((p: any) => !p.isVariation && p.id === product.id)
      const max = (candidate && (candidate as any).displayStock) || product.total_stock || 0
      const existingQty = existingItem?.quantity || 0
      if (max <= 0 || existingQty + qtyToAdd > max) {
        toast({
          title: "❌ Not enough stock available.",
          description: `(Available: ${max}, Requested: ${existingQty + qtyToAdd})`,
          variant: "destructive",
        })
        return
      }

      if (existingItem) {
        setCart(cart.map((item) => 
          (item.id === product.id && !item.variation_id) 
            ? { ...item, quantity: item.quantity + qtyToAdd } 
            : item
        ))
      } else {
        setCart([
          ...cart,
          {
            id: product.id,
            name: product.name,
            original_price: Number(product.price),
            current_price: Number(product.price),
            quantity: qtyToAdd,
            category: product.category_name,
            size: product.size,
            color: product.color,
            brand: product.brand,
            age: product.age_range,
            sex: product.gender,
            product_type: 'uniform',
            max_quantity: max,
            productId: product.id,
          },
        ])
      }
    }

    // Reset form
    setSelectedProduct("")
    setSelectedVariation("")
    setQuantity("1")
  }

  const addManualProduct = () => {
    if (!manualProduct.name || !manualProduct.price) return

    const newItem: CartItem = {
      id: `manual-${Date.now()}`,
      name: manualProduct.name,
      original_price: Number.parseFloat(manualProduct.price),
      current_price: Number.parseFloat(manualProduct.price),
      quantity: Number.parseInt(manualProduct.quantity),
      category: manualProduct.category,
      size: manualProduct.size,
      color: manualProduct.color,
      brand: manualProduct.brand,
      age: manualProduct.age,
      sex: manualProduct.sex,
    }

    setCart([...cart, newItem])
    setManualProduct({
      name: "",
      category: "",
      size: "",
      color: "",
      price: "",
      quantity: "1",
      brand: "",
      age: "",
      sex: "",
    })
  }

  const updateQuantity = (id: string, newQuantity: number) => {
    const item = cart.find((i) => i.id === id)
    if (!item) return

    const effectiveMax = item.max_quantity ?? Number.POSITIVE_INFINITY
    if (newQuantity > effectiveMax) {
      setCart(cart.map((ci) => (ci.id === id ? { ...ci, quantity: effectiveMax } : ci)))
      toast({
        title: "❌ Not enough stock available.",
        description: `(Available: ${effectiveMax}, Requested: ${newQuantity})`,
        variant: "destructive",
      })
      return
    }

    if (newQuantity <= 0) {
      removeFromCart(id)
      return
    }
    setCart(cart.map((ci) => (ci.id === id ? { ...ci, quantity: newQuantity } : ci)))
  }

  const removeFromCart = (id: string) => {
    setCart(cart.filter((item) => item.id !== id))
  }

  const startEditingPrice = (item: CartItem) => {
    setEditingPriceId(item.id)
    setEditingPriceValue(item.current_price.toString())
  }

  const savePrice = (itemId: string) => {
    const newPrice = parseFloat(editingPriceValue)
    if (isNaN(newPrice) || newPrice < 0) {
      toast({
        title: "Invalid Price",
        description: "Please enter a valid price (0 or greater)",
        variant: "destructive",
      })
      return
    }
    
    setCart(cart.map(item => 
      item.id === itemId 
        ? { ...item, current_price: newPrice }
        : item
    ))
    setEditingPriceId(null)
    setEditingPriceValue("")
  }

  const cancelEditingPrice = () => {
    setEditingPriceId(null)
    setEditingPriceValue("")
  }

  const getTotalAmount = () => {
    return cart.reduce((total, item) => total + item.current_price * item.quantity, 0)
  }

  const getTotalSavings = () => {
    return cart.reduce((total, item) => {
      if (item.current_price < item.original_price) {
        return total + (item.original_price - item.current_price) * item.quantity
      }
      return total
    }, 0)
  }

  const getOriginalTotal = () => {
    return cart.reduce((total, item) => total + item.original_price * item.quantity, 0)
  }

  const handleCompleteSale = async () => {
    if (cart.length === 0) {
      toast({
        title: "Error",
        description: "Please add items to cart",
        variant: "destructive",
      })
      return
    }

    // Ensure a specific branch is selected (no sales in "all" view)
    if (!currentBranch || currentBranch === "all") {
      toast({
        title: "Select a branch",
        description: "Please select a branch to complete the sale.",
        variant: "destructive",
      })
      return
    }

    const isValidUUID = (s: string) => /^(?:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12})$/.test(s)

    // Filter valid items only
    const itemsToSend = cart
      .filter((item) => (item.productId && isValidUUID(item.productId)) && item.current_price >= 0 && item.quantity > 0)
      .map((item) => ({
        product_id: item.productId!,
        variation_id: item.variation_id || undefined,
        quantity: item.quantity,
        unit_price: Number(item.current_price),
      }))

    if (itemsToSend.length === 0) {
      toast({ title: "No valid items", description: "Please ensure items have valid product and price", variant: "destructive" })
      return
    }

    setIsProcessing(true)

    try {
      const { getBranchIdForDatabase } = await import("@/lib/utils")
      const saleData = {
        branch_id: currentBranch === "all" ? getBranchIdForDatabase("franko") : getBranchIdForDatabase(currentBranch),
        customer_name: customerName || undefined,
        customer_phone: customerPhone || undefined,
        payment_method: paymentMethod,
        items: itemsToSend,
      }

      const response = await apiClient.createSale(saleData)
      
      if (response.success) {
        toast({
          title: "Success",
          description: "Sale completed successfully!",
        })
        // Refresh inventory immediately after successful sale
        await handleRefreshProducts()
        setLastSale({
          items: cart,
          total: getTotalAmount(),
          sale: response.data,
        })
        setCart([])
        setCustomerName("")
        setCustomerPhone("")
        setPaymentMethod("cash")
        setSelectedProduct("")
        setSelectedVariation("")
        setQuantity("1")
        setExpandedProducts(new Set())
        if (formRef.current) formRef.current.reset();
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        // Handle known stock errors by refreshing inventory and clamping cart
        if (typeof response.error === 'string' && response.error.toLowerCase().includes('insufficient stock')) {
          await handleRefreshProducts()

          // Build a lookup for latest available stock
          const simpleStockMap = new Map<string, number>() // product_id -> stock
          const variationStockMap = new Map<string, number>() // `${product_id}:${variation_id}` -> stock

      allProductsForDisplay.forEach((p) => {
            if (p.isVariation) {
          (p.variations as any)?.forEach((v: any) => {
                variationStockMap.set(`${p.product_id}:${v.variation_id}`, v.quantity)
              })
            } else {
          simpleStockMap.set((p as any).id, (p as any).displayStock)
            }
          })

          // Clamp cart quantities to current stock
          setCart(prev => prev.map(ci => {
            if (ci.variation_id) {
              const key = `${ci.productId || ''}:${ci.variation_id}`
              const max = variationStockMap.get(key)
              return typeof max === 'number' ? { ...ci, quantity: Math.min(ci.quantity, Math.max(0, max)), max_quantity: max } : ci
            } else if (ci.productId) {
              const max = simpleStockMap.get(ci.productId)
              return typeof max === 'number' ? { ...ci, quantity: Math.min(ci.quantity, Math.max(0, max)), max_quantity: max } : ci
            }
            return ci
          }))

          toast({
            title: 'Stock updated',
            description: 'Some items exceeded available stock. Cart quantities were adjusted to current availability.',
            variant: 'destructive',
          })
        } else {
          toast({
            title: "Error",
            description: response.error || "Failed to complete sale",
            variant: "destructive",
          })
        }
      }
    } catch (error: unknown) {
      console.error("Sale completion error:", error)
      toast({
        title: "Error",
        description: (error as Error)?.message || "Failed to complete sale",
        variant: "destructive",
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const quickAddProduct = (product: any) => {
    if (product.isVariation) {
      // For variation products, expand to show variations instead of auto-adding
      const newExpanded = new Set(expandedProducts)
      if (!newExpanded.has(product.product_id)) {
        newExpanded.add(product.product_id)
        setExpandedProducts(newExpanded)
      }
      return
    } else {
      // Handle simple product
      // Price validation removed - allow items with price 0
      const existingItem = cart.find((item) => item.id === product.id && !item.variation_id)
      const max = product.displayStock || 0
      const currentQty = existingItem?.quantity || 0
      if (max <= 0 || currentQty + 1 > max) {
        toast({
          title: "❌ Not enough stock available.",
          description: `(Available: ${max}, Requested: ${currentQty + 1})`,
          variant: "destructive",
        })
        return
      }
      
      if (existingItem) {
        updateQuantity(product.id, existingItem.quantity + 1)
      } else {
        setCart([
          ...cart,
          {
            id: product.id,
            name: product.name,
            original_price: Number(product.price),
            current_price: Number(product.price),
            quantity: 1,
            category: product.category_name,
            size: product.size,
            color: product.color,
            brand: product.brand,
            age: product.age_range,
            sex: product.gender,
            product_type: 'uniform',
            max_quantity: max,
            productId: product.id,
          },
        ])
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

  return (
    <div className="space-y-6">
      {lastSale && (
        <div className="lg:mr-96">
        <Card className="max-w-3xl ml-auto border border-green-200 shadow-lg rounded-xl overflow-hidden animate-in slide-in-from-top-2 duration-500">
          <CardHeader className="bg-gradient-to-r from-green-100 to-emerald-100 border-b border-green-200">
            <CardTitle className="flex items-center space-x-2 text-green-800 text-sm">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span>Sale Completed Successfully!</span>
            </CardTitle>
            <CardDescription className="text-green-700 text-xs">Inventory updated</CardDescription>
          </CardHeader>
          <CardContent className="p-3">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              {/* Sale Details */}
              <div className="lg:col-span-2">
                <div className="space-y-2">
                  <h4 className="font-semibold text-green-800 text-sm">Items Sold</h4>
                  <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                    {lastSale.items.map((item: any) => (
                      <div key={item.id} className="flex items-center justify-between p-2 bg-white rounded-md border border-green-200">
                        <div className="flex items-center space-x-3">
                          <Package className="h-4 w-4 text-green-600" />
                          <div>
                            <p className="font-medium text-gray-900 text-sm">{item.name}</p>
                            <p className="text-xs text-gray-500">Qty: {item.quantity}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-green-600 text-sm">{(Number(item.price) * item.quantity).toFixed(0)} ብር</p>
                          <p className="text-[10px] text-gray-500">{Number(item.price).toFixed(0)} ብር each</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Sale Summary */}
              <div className="space-y-4">
                <div className="bg-white rounded-md p-3 border border-green-200">
                  <h4 className="font-semibold text-green-800 mb-2 text-sm">Sale Summary</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Items:</span>
                      <span className="font-medium">{lastSale.items.length}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Total Quantity:</span>
                      <span className="font-medium">
                        {lastSale.items.reduce((sum: number, item: any) => sum + item.quantity, 0)}
                      </span>
                    </div>
                    <Separator />
                    <div className="flex justify-between text-sm">
                      <span className="font-semibold text-gray-900">Total Amount:</span>
                      <span className="font-bold text-green-600">{lastSale.total.toFixed(0)} ብር</span>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="space-y-2">
                  <Button
                    onClick={() => setLastSale(null)}
                    className="w-full h-8 text-sm bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white"
                  >
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Continue Selling
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setLastSale(null)
                      setCart([])
                      setCustomerName("")
                      setCustomerPhone("")
                      setPaymentMethod("cash")
                    }}
                    className="w-full h-8 text-sm border-green-300 text-green-700 hover:bg-green-50"
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Start New Sale
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        </div>
      )}
      <div className="flex flex-col space-y-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">
            {t("sellProductsTitle" as any)}
          </h1>
          <p className="text-gray-600 mt-1">Process sales and manage transactions</p>
          
          {/* Action Buttons */}
          <div className="flex items-center space-x-3 mt-4">
            <Button 
              variant="outline"
              onClick={() => window.location.href = '/dashboard/inventory'}
              className="border-gray-200 hover:bg-gray-50 shadow-sm"
            >
              <Package className="h-4 w-4 mr-2" />
              {t("viewInventory" as any)}
            </Button>
            <Button 
              variant="outline"
              onClick={() => window.location.href = '/dashboard/reports'}
              className="border-gray-200 hover:bg-gray-50 shadow-sm"
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              {t("viewReports" as any)}
            </Button>
          </div>
        </div>
      </div>



      {/* Main Content Area with Fixed Cart */}
      <div className="main-content">
        <div className="flex-1 space-y-6">
          {/* Smart Product Search */}
          <Card className="border-0 shadow-xl bg-gradient-to-br from-white to-gray-50">
            <CardHeader className="bg-gradient-to-r from-pink-50 to-purple-50 border-b border-pink-100">
             <CardTitle className="flex items-center space-x-2 text-gray-800 text-lg">
                <div className="w-8 h-8 bg-gradient-to-r from-pink-500 to-purple-500 rounded-lg flex items-center justify-center">
                  <Search className="h-4 w-4 text-white" />
                </div>
                <span>{t("findProducts")}</span>
              </CardTitle>
              <CardDescription className="text-gray-600">
                {lastUpdate && (
                  <span className="block text-xs text-gray-500 mt-1">
                    {t("lastUpdated")}: {lastUpdate.toLocaleTimeString()} ({t("autoEvery10Min")})
                  </span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Smart Search Bar */}
              <div className="relative">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder={t("searchProductsPlaceholder")}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onFocus={() => setIsSearchFocused(true)}
                    onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const term = searchTerm.trim()
                        setIsSearchFocused(false)
                        setSearchTerm(term)
                        fetchProducts(term)
                      }
                    }}
                    className="pl-10 pr-20 rounded-xl border-gray-200 focus:border-pink-300 focus:ring-pink-200 w-full"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center space-x-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600"
                      title={t("searchHelp")}
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

                {/* Search Suggestions */}
                {isSearchFocused && (searchTerm.trim() || recentSearches.length > 0) && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto">
                    <div className="p-2">
                      {/* Recent Searches */}
                      {recentSearches.length > 0 && !searchTerm.trim() && (
                        <div className="mb-3">
                          <div className="flex items-center space-x-2 mb-2">
                            <Clock className="h-4 w-4 text-gray-500" />
                            <span className="text-sm font-medium text-gray-700">Recent Searches</span>
                          </div>
                          <div className="space-y-1">
                            {recentSearches.slice(0, 3).map((search, index) => (
                              <button
                                key={index}
                                onClick={() => setSearchTerm(search)}
                                className="w-full text-left px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-md flex items-center justify-between"
                              >
                                <span>{search}</span>
                                <Search className="h-3 w-3 text-gray-400" />
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Search Suggestions */}
                      {searchTerm.trim() && (
                        <div>
                          <div className="flex items-center space-x-2 mb-2">
                            <Sparkles className="h-4 w-4 text-pink-500" />
                            <span className="text-sm font-medium text-gray-700">Suggestions</span>
                          </div>
                          <div className="space-y-1">
                            {searchSuggestions.map((suggestion, index) => (
                              <button
                                key={index}
                                onClick={() => setSearchTerm(suggestion)}
                                className="w-full text-left px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-md"
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
                    </div>
                  </div>
                )}
              </div>

              {/* View/Sort/Actions */}
              <div className="flex flex-row items-center justify-between space-x-2">
                <div className="flex items-center space-x-2">
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="w-24 sm:w-32 h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="name">Name</SelectItem>
                      <SelectItem value="price">Selling Price</SelectItem>
                      <SelectItem value="stock">Stock</SelectItem>
                      <SelectItem value="category">Category</SelectItem>
                    </SelectContent>
                  </Select>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                    className="h-8 w-8 p-0"
                  >
                    {sortOrder === 'asc' ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />}
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRefreshProducts}
                    disabled={isRefreshing}
                    className="h-8 w-8 p-0 border-blue-200 text-blue-600 hover:bg-blue-50"
                  >
                    {isRefreshing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                  </Button>
                </div>

                <div className="flex items-center space-x-2">
                  <div className="flex items-center bg-gray-100 rounded-lg p-1">
                    <Button
                      variant={viewMode === 'grid' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setViewMode('grid')}
                      className="h-8 w-8 p-0"
                    >
                      <Grid3X3 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={viewMode === 'list' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setViewMode('list')}
                      className="h-8 w-8 p-0"
                    >
                      <List className="h-4 w-4" />
                    </Button>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowKeyboardShortcuts(true)}
                    className="h-8 w-8 p-0 border-purple-200 text-purple-600 hover:bg-purple-50"
                  >
                    <Zap className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Compact Quick Filters Row (always visible) */}
              <div className="space-y-2 pb-1 mt-3">
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
                        <Search className="h-3 w-3 mr-1" />
                        Show
                      </>
                    )}
                  </Button>
                </div>

                {/* Desktop Quick Filters - Always Visible */}
                <div className="hidden sm:flex items-center gap-2 flex-nowrap overflow-x-auto">
                  {/* Status */}
                  <div className="flex-shrink-0">
                    <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                      <SelectTrigger className="h-5 px-2 text-xs border-gray-200 focus:border-pink-300 focus:ring-pink-200 w-[100px]">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="normal">In Stock</SelectItem>
                        <SelectItem value="low_stock">Low Stock</SelectItem>
                        <SelectItem value="out_of_stock">Out of Stock</SelectItem>
                        <SelectItem value="overstock">Overstock</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Category */}
                  <div className="flex-shrink-0">
                    <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                      <SelectTrigger className="h-5 px-2 text-xs border-gray-200 focus:border-pink-300 focus:ring-pink-200 w-[140px]">
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

                  {/* Brand */}
                  <div className="flex-shrink-0">
                    <Select value={selectedBrand} onValueChange={setSelectedBrand}>
                      <SelectTrigger className="h-5 px-2 text-xs border-gray-200 focus:border-pink-300 focus:ring-pink-200 w-[100px]">
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

                  {/* Gender */}
                  <div className="flex-shrink-0">
                    <Select value={selectedGender} onValueChange={setSelectedGender}>
                      <SelectTrigger className="h-5 px-2 text-xs border-gray-200 focus:border-pink-300 focus:ring-pink-200 w-[100px]">
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

                  {/* Age Range */}
                  <div className="flex-shrink-0">
                    <Select value={selectedAgeRange} onValueChange={setSelectedAgeRange}>
                      <SelectTrigger className="h-5 px-2 text-xs border-gray-200 focus:border-pink-300 focus:ring-pink-200 w-[100px]">
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

                  {/* Size */}
                  <div className="flex-shrink-0">
                    <Select value={selectedSize} onValueChange={setSelectedSize}>
                      <SelectTrigger className="h-5 px-2 text-xs border-gray-200 focus:border-pink-300 focus:ring-pink-200 w-[100px]">
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

                  {/* Color - Compact Popover-like selection via Select for simplicity */}
                  <div className="flex-shrink-0">
                    <Select value={selectedColor} onValueChange={setSelectedColor}>
                        <SelectTrigger className="h-5 px-2 text-xs border-gray-200 focus:border-pink-300 focus:ring-pink-200 w-[100px]">
                        <SelectValue placeholder="Color" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Colors</SelectItem>
                        {colors.map((c) => (
                          <SelectItem key={c} value={c}>{c.replace('-', ' ')}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Active Filters Count */}
                  {(selectedStatus !== "all" || selectedCategory !== "all" || selectedBrand !== "all" || selectedGender !== "all" || selectedAgeRange !== "all" || selectedSize !== "all" || selectedColor !== "all" || priceRange[0] > 0 || priceRange[1] < 1000 || stockRange[0] > 0 || stockRange[1] < 100) && (
                    <Badge variant="secondary" className="h-6 px-2 text-xs bg-pink-100 text-pink-700">
                      {getActiveFilterCount()} active
                    </Badge>
                  )}
                  {(selectedStatus !== "all" || selectedCategory !== "all" || selectedBrand !== "all" || selectedGender !== "all" || selectedAgeRange !== "all" || selectedSize !== "all" || selectedColor !== "all" || priceRange[0] > 0 || priceRange[1] < 1000 || stockRange[0] > 0 || stockRange[1] < 100) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleClearFilters}
                      className="h-6 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      Clear
                    </Button>
                  )}
                </div>
              </div>

              {/* Mobile Quick Filters - Collapsible */}
              {showFilters && (
                <div className="sm:hidden space-y-2">
                  {/* Status Filter */}
                  <div className="w-full">
                    <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                      <SelectTrigger className="h-8 px-2 text-xs border-gray-200 focus:border-pink-300 focus:ring-pink-200 w-full">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="normal">In Stock</SelectItem>
                        <SelectItem value="low_stock">Low Stock</SelectItem>
                        <SelectItem value="out_of_stock">Out of Stock</SelectItem>
                        <SelectItem value="overstock">Overstock</SelectItem>
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

                  {/* Color Filter */}
                  <div className="w-full">
                    <Select value={selectedColor} onValueChange={setSelectedColor}>
                      <SelectTrigger className="h-8 px-2 text-xs border-gray-200 focus:border-pink-300 focus:ring-pink-200 w-full">
                        <SelectValue placeholder="Color" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Colors</SelectItem>
                        {colors.map((c) => (
                          <SelectItem key={c} value={c}>{c.replace('-', ' ')}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Active Filters Count and Clear Button */}
                  {(selectedStatus !== "all" || selectedCategory !== "all" || selectedBrand !== "all" || selectedGender !== "all" || selectedAgeRange !== "all" || selectedSize !== "all" || selectedColor !== "all" || priceRange[0] > 0 || priceRange[1] < 1000 || stockRange[0] > 0 || stockRange[1] < 100) && (
                    <div className="flex flex-col space-y-2">
                      <Badge variant="secondary" className="h-6 px-2 text-xs bg-pink-100 text-pink-700 w-full text-center">
                        {getActiveFilterCount()} active
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleClearFilters}
                        className="h-8 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 w-full"
                      >
                        Clear All Filters
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Enhanced Product Display */}
          <Card className="border-0 shadow-xl bg-gradient-to-br from-white to-gray-50">
            <CardHeader className="bg-gradient-to-r from-blue-50 to-purple-50 border-b border-blue-100">
            <CardTitle className="flex items-center space-x-2 text-gray-800 text-lg">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg flex items-center justify-center">
                  <Package className="h-4 w-4 text-white" />
                </div>
                <span>{t("availableProducts")} ({processedProducts.length})</span>
              </CardTitle>
              <CardDescription className="text-gray-600">
                Click on products to quickly add them to cart
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="h-6 w-6 animate-spin text-pink-500" />
                </div>
              ) : allProductsForDisplay.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-gradient-to-r from-gray-100 to-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Package className="h-8 w-8 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">{t("clickProductsToAddToCart")}</h3>
                  <p className="text-gray-500">{t("selectProductsToStartSale")}</p>
                </div>
              ) : (
                <div className={viewMode === 'grid' ? 
                  `gap-3 grid grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-4` : 
                  "space-y-3"
                }>
                  {allProductsForDisplay.map((product) => (
                    <div
                      key={product.isVariation ? product.product_id : product.id}
                      className={`group relative ${
                        viewMode === 'grid' 
                          ? `p-3 border border-gray-200 rounded-lg hover:border-pink-300 hover:shadow-lg transition-all duration-200 cursor-pointer bg-white flex flex-col h-full` 
                          : 'p-4 border border-gray-200 rounded-lg hover:border-pink-300 transition-all duration-200 cursor-pointer bg-white flex items-center space-x-4'
                      } ${
                        product.isVariation && expandedProducts.has(product.product_id) ? 'border-purple-500' : ''
                      }`}
                      onClick={() => {
                        if (product.isVariation) {
                          // For single variations, auto-select the variation instead of toggling expansion
                          if (product.variations?.length === 1) {
                            const singleVariation = product.variations[0]
                            setSelectedVariation(singleVariation.variation_id)
                            // Also expand to show the variation details
                            const newExpanded = new Set(expandedProducts)
                            newExpanded.add(product.product_id)
                            setExpandedProducts(newExpanded)
                          } else {
                            // For multiple variations, toggle expansion
                            const newExpanded = new Set(expandedProducts)
                            if (newExpanded.has(product.product_id)) {
                              newExpanded.delete(product.product_id)
                            } else {
                              newExpanded.add(product.product_id)
                            }
                            setExpandedProducts(newExpanded)
                          }
                        } else {
                          // For uniform products, add directly to cart
                          quickAddProduct(product)
                        }
                      }}
                    >
                      {/* Product Header */}
                      <div className={viewMode === 'grid' ? 'mb-3' : 'flex-shrink-0'}>
                        <div className={`relative ${
                          viewMode === 'grid' 
                            ? `w-full h-10 rounded-md bg-gradient-to-r from-pink-100 to-purple-100 flex items-center justify-center mb-2` 
                            : 'w-10 h-10 rounded-md bg-gradient-to-r from-pink-100 to-purple-100 flex items-center justify-center'
                        }`}>
                          <Package className={`${viewMode === 'grid' ? 'h-4 w-4' : 'h-4 w-4'} text-pink-500`} />
                          {/* Category badge (top-left) */}
                          <div className="absolute top-1 left-1">
                            <Badge variant="outline" className={`${viewMode === 'grid' ? 'text-[10px] px-1 py-0.5' : 'text-xs px-1.5 py-0.5'} bg-white/80 backdrop-blur-sm`}>
                              {product.displayCategory}
                            </Badge>
                          </div>
                          {/* Variation Count Badge - Only for variation products */}
                          {product.isVariation && (
                            <div className="absolute -top-2 -right-2">
                                                          <Badge 
                              variant="secondary" 
                              className={`text-white ${viewMode === 'grid' ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-1.5 py-0.5'} rounded-full shadow-sm ${
                                product.variations?.length === 1 
                                  ? 'bg-indigo-600' // Different color for single variations
                                  : 'bg-purple-600' // Original color for multiple variations
                              }`}
                            >
                                {(product.variations?.length || 0)} {product.variations?.length === 1 ? 'variation' : 'variations'}
                              </Badge>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Product Info */}
                      <div className={`${viewMode === 'grid' ? 'space-y-2' : 'flex-1'}`}>
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <h3 className={`font-medium text-gray-900 ${viewMode === 'grid' ? 'text-xs line-clamp-2' : 'text-base truncate'}`}>
                              {product.displayName}
                            </h3>
                            <p className={`${viewMode === 'grid' ? 'text-[11px]' : 'text-sm'} text-gray-500 mt-1`}>{product.displaySku}</p>
                            {/* Removed duplicate variation text inside card */}
                          </div>
                          <div className="flex flex-col items-end space-y-1">
                            {product.isVariation && (
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="h-7 w-7 p-0 rounded-md border-purple-300 bg-purple-50 hover:bg-purple-100 hover:border-purple-400 shadow-sm"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  // For single variations, auto-select on click
                                  if (product.variations?.length === 1) {
                                    const singleVariation = product.variations[0]
                                    setSelectedVariation(singleVariation.variation_id)
                                  }
                                  // Always toggle expansion for both single and multiple variations
                                  const newExpanded = new Set(expandedProducts)
                                  if (newExpanded.has(product.product_id)) {
                                    newExpanded.delete(product.product_id)
                                  } else {
                                    newExpanded.add(product.product_id)
                                  }
                                  setExpandedProducts(newExpanded)
                                }}
                              >
                                {expandedProducts.has(product.product_id) ? (
                                  <ChevronUp className="h-4 w-4 text-purple-700 font-bold" />
                                ) : (
                                  <ChevronDown className="h-4 w-4 text-purple-700 font-bold" />
                                )}
                              </Button>
                            )}
                            {!product.isVariation && (
                            <div className="text-right">
                              <p className={`${viewMode === 'grid' ? 'text-sm' : 'text-lg'} font-bold text-green-600`}>{(Number((product as any).displayPrice || 0)).toFixed(0)}</p>
                              {typeof (product as any).displayPurchasePrice === 'number' && (
                                <p className="text-[10px] text-gray-500">{Number(((product as any).displayPurchasePrice) as number).toFixed(0)}</p>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Product Details */}
                        <div className={`${viewMode === 'grid' ? 'space-y-1.5' : 'flex items-center space-x-4 mt-2'}`}>
                          {/* Stock Status */}
                          <div className="flex items-center space-x-2 text-[11px]">
                            <span className={`${viewMode === 'grid' ? 'text-[10px]' : 'text-xs'} ${
                              product.displayStock === 0 ? 'text-red-600' :
                              product.displayStock <= 5 ? 'text-yellow-600' : 'text-green-600'
                            } font-medium`}>
                              {product.displayStock === 0 ? 'Out of Stock' :
                               product.displayStock <= 5 ? 'Low Stock' : 'In Stock'}
                            </span>
                            <span className={`${viewMode === 'grid' ? 'text-[10px]' : 'text-xs'} text-gray-500`}>
                              ({product.displayStock} available)
                            </span>
                          </div>

                          {/* Product Tags */}
                          <div className="flex flex-wrap gap-1">
                            {product.displayBrand && (
                              <Badge variant="secondary" className={`${viewMode === 'grid' ? 'text-[10px] px-1 py-0.5' : 'text-xs'}`}>
                                {product.displayBrand}
                              </Badge>
                            )}
                            {product.displayColor && product.displaySize && (
                              <Badge variant="outline" className={`${viewMode === 'grid' ? 'text-[10px] px-1 py-0.5' : 'text-xs'}`}>
                                {product.displayColor} • {product.displaySize}
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* Quick Add Button - Only for uniform products */}
                        {!product.isVariation && (
                          <div className={`${viewMode === 'grid' ? 'mt-2' : 'ml-4'} mt-auto`}>
                            <Button
                              size="sm"
                              className={`w-full h-8 text-xs bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white`}
                              onClick={(e) => {
                                e.stopPropagation()
                                quickAddProduct(product)
                              }}
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              Add
                            </Button>
                          </div>
                        )}

                        {/* Variation Products - Show when expanded */}
                        {product.isVariation && expandedProducts.has(product.product_id) && (
                          <div className="mt-3 space-y-2 border-t border-purple-200 pt-3">
                            <h4 className="text-xs font-medium text-purple-700 flex items-center">
                              <Layers className="h-3 w-3 mr-1" />
                              Variations
                            </h4>
                          <div className="space-y-1 max-h-36 overflow-y-auto pr-2">
                              {product.variations?.map((variation) => (
                                <div 
                                  key={variation.variation_id} 
                                  className={`p-1.5 rounded-md border ${selectedVariation === variation.variation_id ? 'border-purple-500 bg-purple-50' : 'border-gray-200'} hover:border-purple-300 hover:bg-purple-50 transition-all duration-200 overflow-hidden w-full box-border`}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setSelectedVariation(variation.variation_id)
                                  }}
                                >
                                  <div className="flex items-center justify-between gap-2 w-full">
                                    <div className="flex items-center space-x-2">
                                      {variation.color && (
                                        <div 
                                          className={`w-4 h-4 rounded-full border border-gray-300 ${getColorClass(variation.color)}`}
                                          style={getColorStyle(variation.color)}
                                          title={variation.color}
                                        />
                                      )}
                                      <div className="flex-1 min-w-0">
                                        {/* First line: size + prices */}
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <p className="text-xs font-medium">
                                            {variation.size || ''}
                                          </p>
                                          <span className="text-[10px] text-green-700 font-semibold whitespace-nowrap">{Number(variation.price).toFixed(0)} ብር</span>
                                          {variation.purchase_price !== undefined && (
                                            <span className="text-[8px] text-gray-500 whitespace-nowrap">{Number(variation.purchase_price).toFixed(0)}</span>
                                          )}
                                        </div>
                                        {/* Second line: stock + other details */}
                                        <div className="flex items-center gap-2 mt-1">
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
                                          {product.displayBrand && (
                                            <span className="text-[10px] text-gray-500 bg-gray-100 px-1 py-0.5 rounded">
                                              {product.displayBrand}
                                            </span>
                                          )}
                                          {product.age_range && (
                                            <span className="text-[10px] text-gray-500 bg-gray-100 px-1 py-0.5 rounded">
                                              {product.age_range}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                    <div className="flex flex-col items-end space-y-1 ml-2 flex-none w-28 sm:w-32 overflow-hidden" />
                                  </div>
                                  <div className="mt-1 w-full">
                                    <Button
                                      size="sm"
                                      className="w-full h-5 text-[9px] px-2 bg-gradient-to-r from-purple-500/80 to-pink-500/80 hover:from-purple-600/80 hover:to-pink-600/80 text-white"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        // Add variation to cart with quantity 1 (respect stock)
                                        // Price validation removed - allow items with price 0
                                        const cartId = `${product.product_id}:${variation.variation_id}`
                                        const existingItem = cart.find((item) => item.id === cartId)
                                        const currentQty = existingItem?.quantity || 0
                                        const max = variation.quantity || 0
                                        if (currentQty + 1 > max) {
                                          toast({
                                            title: "Stock limit reached",
                                            description: `Only ${max} available for this variation`,
                                            variant: "destructive",
                                          })
                                          return
                                        }
                                        if (existingItem) {
                                          updateQuantity(cartId, existingItem.quantity + 1)
                                        } else {
                                          setCart([
                                            ...cart,
                                            {
                                              id: cartId,
                                              name: `${product.displayName} (${variation.color || ''} ${variation.size || ''})`.trim(),
                                              original_price: Number(variation.price),
                                              current_price: Number(variation.price),
                                              quantity: 1,
                                              category: product.displayCategory,
                                              size: variation.size,
                                              color: variation.color,
                                              brand: product.displayBrand,
                                              age: product.age_range,
                                              sex: product.gender,
                                              variation_id: variation.variation_id,
                                              variation_sku: variation.variation_sku,
                                              product_type: 'variation',
                                              max_quantity: max,
                                              productId: product.product_id,
                                            },
                                          ])
                                        }
                                      }}
                                      disabled={variation.quantity === 0}
                                    >
                                      Add
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Hover Overlay */}
                      <div className="absolute inset-0 bg-gradient-to-r from-pink-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-200 rounded-lg pointer-events-none" />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Fixed Cart on Right Side (Desktop only) */}
        <div className="hidden lg:flex fixed top-0 right-0 w-96 h-screen bg-white shadow-2xl border-l border-gray-200 z-40 flex-col">
          {/* Cart Header */}
          <div className="flex-shrink-0 bg-gradient-to-r from-green-500 to-emerald-500 text-white p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                  <ShoppingBag className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">{t("cart")}</h2>
                  <p className="text-sm text-green-100">{cart.length} {t("items")}</p>
                </div>
              </div>
              {cart.length > 0 && (
                <div className="text-right">
                  <p className="text-sm text-green-100">Total</p>
                  <p className="text-xl font-bold">{getTotalAmount().toFixed(0)} ብር</p>
                </div>
              )}
            </div>
          </div>

          {/* Cart Content */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {cart.length === 0 ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-gradient-to-r from-gray-100 to-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                    <ShoppingBag className="h-8 w-8 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">{t("cartIsEmpty" as any)}</h3>
                  <p className="text-gray-500">{t("addProductsToStartSale" as any)}</p>
                </div>
              </div>
            ) : (
              <>
                {/* Cart Items - Scrollable */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {cart.map((item) => (
                    <div key={item.id} className="group relative p-3 bg-gray-50 border border-gray-200 rounded-lg hover:border-green-300 hover:shadow-sm transition-all duration-200">
                      <div className="space-y-2">
                        {/* Product Header */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2 flex-1 min-w-0">
                            <div className="w-8 h-8 bg-gradient-to-r from-pink-100 to-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                              <Package className="h-4 w-4 text-pink-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium text-gray-900 text-sm truncate">{item.name}</h4>
                              <div className="flex items-center space-x-1 mt-0.5">
                                {item.color && (
                                  <Badge variant="outline" className="text-xs px-1 py-0">
                                    {item.color}
                                  </Badge>
                                )}
                                {item.size && (
                                  <Badge variant="secondary" className="text-xs px-1 py-0">
                                    {item.size}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-green-600 text-sm">
                              {(Number(item.current_price) * item.quantity).toFixed(0)} ብር
                            </p>
                          </div>
                        </div>

                        {/* Price and Quantity Controls */}
                        <div className="flex justify-between items-center">
                          <div className="flex items-center">
                            {editingPriceId === item.id ? (
                              <div className="flex items-center space-x-1">
                                <Input
                                  type="number"
                                  value={editingPriceValue}
                                  onChange={(e) => setEditingPriceValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      savePrice(item.id)
                                    } else if (e.key === 'Escape') {
                                      cancelEditingPrice()
                                    }
                                  }}
                                  className="w-16 h-6 text-xs"
                                  step="0.01"
                                  min="0"
                                />
                                <Button
                                  size="sm"
                                  onClick={() => savePrice(item.id)}
                                  className="h-6 px-1 bg-green-500 hover:bg-green-600 text-white"
                                >
                                  <CheckCircle className="h-3 w-3" />
                                </Button>
                              </div>
                            ) : (
                              <div 
                                className="cursor-pointer hover:bg-gray-100 px-1 py-0.5 rounded text-xs"
                                onClick={() => startEditingPrice(item)}
                              >
                                <p className="text-xs font-medium text-gray-700">
                                  {(Number(item.current_price)).toFixed(0)} ብር each
                                </p>
                              </div>
                            )}
                          </div>
                          
                          {/* Quantity Controls */}
                          <div className="flex items-center space-x-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateQuantity(item.id, item.quantity - 1)}
                              className="h-6 w-6 p-0 border-gray-300 hover:border-red-300 hover:bg-red-50"
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="font-medium text-gray-900 min-w-[1.5rem] text-center text-sm">
                              {item.quantity}
                            </span>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateQuantity(item.id, item.quantity + 1)}
                              className="h-6 w-6 p-0 border-gray-300 hover:border-green-300 hover:bg-green-50"
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => removeFromCart(item.id)}
                              className="h-6 w-6 p-0 border-gray-300 hover:border-red-300 hover:bg-red-50 text-red-600 hover:text-red-700 ml-1"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>

                      {/* Hover Overlay */}
                      <div className="absolute inset-0 bg-gradient-to-r from-green-500/5 to-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 rounded-lg pointer-events-none" />
                    </div>
                  ))}
                </div>
                
                {/* Customer Info Section */}
                <div className="flex-shrink-0 p-4 border-t border-gray-200 bg-gray-50">
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-gray-800 flex items-center">
                      <Users className="h-4 w-4 mr-2" />
                      Customer Info
                    </h3>
                    <div className="grid grid-cols-1 gap-2">
                      <Input
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="Customer name (optional)"
                        className="h-8 text-sm border-gray-300 focus:border-green-400"
                      />
                      <Input
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        placeholder="Phone number (optional)"
                        className="h-8 text-sm border-gray-300 focus:border-green-400"
                      />
                      <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                        <SelectTrigger className="h-8 text-sm border-gray-300 focus:border-green-400">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cash">
                            <div className="flex items-center">
                              <DollarSign className="h-3 w-3 mr-2" />
                              Cash
                            </div>
                          </SelectItem>
                          <SelectItem value="card">
                            <div className="flex items-center">
                              <CreditCard className="h-3 w-3 mr-2" />
                              Card
                            </div>
                          </SelectItem>
                          <SelectItem value="mobile">
                            <div className="flex items-center">
                              <Smartphone className="h-3 w-3 mr-2" />
                              Mobile
                            </div>
                          </SelectItem>
                          <SelectItem value="bank_transfer">
                            <div className="flex items-center">
                              <Building2 className="h-3 w-3 mr-2" />
                              Bank Transfer
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                
                {/* Checkout Section */}
                <div className="flex-shrink-0 p-4 border-t border-gray-200 bg-white">
                  <div className="space-y-3">
                    {/* Sale Summary */}
                    <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-3 border border-green-200">
                      <div className="flex justify-between items-center text-sm mb-1">
                        <span className="text-gray-700">Items:</span>
                        <span className="font-medium">{cart.length}</span>
                      </div>
                      {getTotalSavings() > 0 && (
                        <>
                          <div className="flex justify-between items-center text-sm mb-1">
                            <span className="text-gray-700">Original:</span>
                            <span className="line-through">{(getOriginalTotal()).toFixed(0)} ብር</span>
                          </div>
                          <div className="flex justify-between items-center text-sm mb-1">
                            <span className="text-green-700">Savings:</span>
                            <span className="font-bold text-green-600">-{(getTotalSavings()).toFixed(0)} ብር</span>
                          </div>
                        </>
                      )}
                      <div className="flex justify-between items-center text-sm border-t border-green-200 pt-2 mt-2">
                        <span className="font-semibold text-gray-800">Total:</span>
                        <span className="font-bold text-lg text-green-600">{(getTotalAmount()).toFixed(0)} ብር</span>
                      </div>
                    </div>
                    
                    {/* Complete Sale Button */}
                    <Button
                      onClick={handleCompleteSale}
                      disabled={cart.length === 0 || isProcessing}
                      className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-semibold py-3 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <DollarSign className="mr-2 h-4 w-4" />
                          Complete Sale
                        </>
                      )}
                    </Button>
                    
                    {/* Quick Actions */}
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setCart([])
                          setCustomerName("")
                          setCustomerPhone("")
                          setPaymentMethod("cash")
                        }}
                        disabled={cart.length === 0}
                        className="flex-1 border-gray-300 text-gray-700 hover:bg-gray-50 text-sm py-2"
                      >
                        <RefreshCw className="mr-1 h-3 w-3" />
                        Clear
                      </Button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Cart Trigger (Floating Button) */}
      <div className="lg:hidden fixed bottom-4 right-4 z-50">
        <Button
          onClick={() => setIsMobileCartOpen(true)}
          className="relative bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg hover:shadow-xl"
        >
          <ShoppingBag className="h-4 w-4 mr-2" />
          Cart
          {cart.length > 0 && (
            <span className="ml-2 px-2 py-0.5 rounded-full bg-white/90 text-emerald-700 text-xs font-semibold">
              {cart.length}
            </span>
          )}
        </Button>
      </div>

      {/* Mobile Cart Drawer */}
      <Sheet open={isMobileCartOpen} onOpenChange={setIsMobileCartOpen}>
        <SheetContent side="right" className="w-[92vw] sm:w-[420px] p-0">
          <div className="flex h-full flex-col">
            {/* Header */}
            <div className="flex-shrink-0 bg-gradient-to-r from-green-500 to-emerald-500 text-white p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                    <ShoppingBag className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold">{t("cart")}</h2>
                    <p className="text-sm text-green-100">{cart.length} {t("items")}</p>
                  </div>
                </div>
                {cart.length > 0 && (
                  <div className="text-right">
                    <p className="text-sm text-green-100">Total</p>
                    <p className="text-xl font-bold">{getTotalAmount().toFixed(0)} ብር</p>
                  </div>
                )}
              </div>
            </div>

            {/* Items */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {cart.length === 0 ? (
                <div className="flex h-full items-center justify-center">
                  <div className="text-center py-8">
                    <div className="w-16 h-16 bg-gradient-to-r from-gray-100 to-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                      <ShoppingBag className="h-8 w-8 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">{t("cartIsEmpty" as any)}</h3>
                    <p className="text-gray-500">{t("addProductsToStartSale" as any)}</p>
                  </div>
                </div>
              ) : (
                cart.map((item) => (
                  <div key={item.id} className="group relative p-3 bg-gray-50 border border-gray-200 rounded-lg hover:border-green-300 hover:shadow-sm transition-all duration-200">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2 flex-1 min-w-0">
                          <div className="w-8 h-8 bg-gradient-to-r from-pink-100 to-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                            <Package className="h-4 w-4 text-pink-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-gray-900 text-sm truncate">{item.name}</h4>
                            <div className="flex items-center space-x-1 mt-0.5">
                              {item.color && (
                                <Badge variant="outline" className="text-xs px-1 py-0">{item.color}</Badge>
                              )}
                              {item.size && (
                                <Badge variant="secondary" className="text-xs px-1 py-0">{item.size}</Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-green-600 text-sm">{(Number(item.current_price) * item.quantity).toFixed(0)} ብር</p>
                        </div>
                      </div>

                      <div className="flex justify-between items-center">
                        <div className="flex items-center">
                          {editingPriceId === item.id ? (
                            <div className="flex items-center space-x-1">
                              <Input
                                type="number"
                                value={editingPriceValue}
                                onChange={(e) => setEditingPriceValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    savePrice(item.id)
                                  } else if (e.key === 'Escape') {
                                    cancelEditingPrice()
                                  }
                                }}
                                className="w-16 h-6 text-xs"
                                step="0.01"
                                min="0"
                              />
                              <Button size="sm" onClick={() => savePrice(item.id)} className="h-6 px-1 bg-green-500 hover:bg-green-600 text-white">
                                <CheckCircle className="h-3 w-3" />
                              </Button>
                            </div>
                          ) : (
                            <div className="cursor-pointer hover:bg-gray-100 px-1 py-0.5 rounded text-xs" onClick={() => startEditingPrice(item)}>
                              <p className="text-xs font-medium text-gray-700">{(Number(item.current_price)).toFixed(0)} ብር each</p>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center space-x-1">
                          <Button size="sm" variant="outline" onClick={() => updateQuantity(item.id, item.quantity - 1)} className="h-6 w-6 p-0 border-gray-300 hover:border-red-300 hover:bg-red-50">
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="font-medium text-gray-900 min-w-[1.5rem] text-center text-sm">{item.quantity}</span>
                          <Button size="sm" variant="outline" onClick={() => updateQuantity(item.id, item.quantity + 1)} className="h-6 w-6 p-0 border-gray-300 hover:border-green-300 hover:bg-green-50">
                            <Plus className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => removeFromCart(item.id)} className="h-6 w-6 p-0 border-gray-300 hover:border-red-300 hover:bg-red-50 text-red-600 hover:text-red-700 ml-1">
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Customer Info & Checkout */}
            <div className="flex-shrink-0 border-t border-gray-200 bg-white">
              <div className="p-4 space-y-3">
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-gray-800 flex items-center">
                    <Users className="h-4 w-4 mr-2" />
                    Customer Info
                  </h3>
                  <div className="grid grid-cols-1 gap-2">
                    <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Customer name (optional)" className="h-8 text-sm border-gray-300 focus:border-green-400" />
                    <Input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="Phone number (optional)" className="h-8 text-sm border-gray-300 focus:border-green-400" />
                    <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                      <SelectTrigger className="h-8 text-sm border-gray-300 focus:border-green-400">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash"><div className="flex items-center"><DollarSign className="h-3 w-3 mr-2" />Cash</div></SelectItem>
                        <SelectItem value="card"><div className="flex items-center"><CreditCard className="h-3 w-3 mr-2" />Card</div></SelectItem>
                        <SelectItem value="mobile"><div className="flex items-center"><Smartphone className="h-3 w-3 mr-2" />Mobile</div></SelectItem>
                        <SelectItem value="bank_transfer"><div className="flex items-center"><Building2 className="h-3 w-3 mr-2" />Bank Transfer</div></SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-3 border border-green-200">
                    <div className="flex justify-between items-center text-sm mb-1">
                      <span className="text-gray-700">Items:</span>
                      <span className="font-medium">{cart.length}</span>
                    </div>
                    {getTotalSavings() > 0 && (
                      <>
                        <div className="flex justify-between items-center text-sm mb-1">
                          <span className="text-gray-700">Original:</span>
                          <span className="line-through">{(getOriginalTotal()).toFixed(0)} ብር</span>
                        </div>
                        <div className="flex justify-between items-center text-sm mb-1">
                          <span className="text-green-700">Savings:</span>
                          <span className="font-bold text-green-600">-{(getTotalSavings()).toFixed(0)} ብር</span>
                        </div>
                      </>
                    )}
                    <div className="flex justify-between items-center text-sm border-t border-green-200 pt-2 mt-2">
                      <span className="font-semibold text-gray-800">Total:</span>
                      <span className="font-bold text-lg text-green-600">{(getTotalAmount()).toFixed(0)} ብር</span>
                    </div>
                  </div>

                  <Button onClick={handleCompleteSale} disabled={cart.length === 0 || isProcessing} className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-semibold py-3 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed">
                    {isProcessing ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing...</>) : (<><DollarSign className="mr-2 h-4 w-4" />Complete Sale</>)}
                  </Button>

                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      onClick={() => { setCart([]); setCustomerName(""); setCustomerPhone(""); setPaymentMethod("cash") }}
                      disabled={cart.length === 0}
                      className="flex-1 border-gray-300 text-gray-700 hover:bg-gray-50 text-sm py-2"
                    >
                      <RefreshCw className="mr-1 h-3 w-3" />
                      Clear
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Add padding to main content to account for fixed cart (desktop only) */}
      <style jsx global>{`
        .main-content {
          margin-right: 384px; /* 96 * 4 = 384px (w-96) */
        }
        @media (max-width: 1024px) {
          .main-content {
            margin-right: 0;
          }
        }
      `}</style>

      {/* Keyboard Shortcuts Help Modal */}
      <Dialog open={showKeyboardShortcuts} onOpenChange={setShowKeyboardShortcuts}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Zap className="h-5 w-5 text-purple-500" />
              <span>Keyboard Shortcuts</span>
            </DialogTitle>
            <DialogDescription>
              Use these shortcuts to work faster
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-2">
                  <Search className="h-4 w-4 text-blue-500" />
                  <span className="text-sm font-medium">{t("focusSearch")}</span>
                </div>
                <kbd className="px-2 py-1 text-xs font-semibold text-gray-800 bg-gray-200 border border-gray-300 rounded">
                  Ctrl + K
                </kbd>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-2">
                  <DollarSign className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-medium">Complete Sale</span>
                </div>
                <kbd className="px-2 py-1 text-xs font-semibold text-gray-800 bg-gray-200 border border-gray-300 rounded">
                  Ctrl + Enter
                </kbd>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-2">
                  <RefreshCw className="h-4 w-4 text-blue-500" />
                  <span className="text-sm font-medium">{t("refreshProducts")}</span>
                </div>
                <kbd className="px-2 py-1 text-xs font-semibold text-gray-800 bg-gray-200 border border-gray-300 rounded">
                  Ctrl + R
                </kbd>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-2">
                  <XCircle className="h-4 w-4 text-red-500" />
                  <span className="text-sm font-medium">{t("clearSearch")}</span>
                </div>
                <kbd className="px-2 py-1 text-xs font-semibold text-gray-800 bg-gray-200 border border-gray-300 rounded">
                  Escape
                </kbd>
              </div>
            </div>
            
            <div className="text-xs text-gray-500 text-center">
              Auto-refresh occurs every 30 seconds to keep inventory up to date
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
