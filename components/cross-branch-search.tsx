"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import { 
  Loader2, 
  Package, 
  Building2, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  TrendingUp,
  Star,
  Tag,
  Palette,
  Edit,
  ShoppingBag,
  Trash2,
  Search,
  Clock,
  Sparkles,
  X
} from "lucide-react"
import apiClient from "@/lib/api-client"
import { useBranch } from "@/lib/branch-context"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Label } from "@/components/ui/label"

interface Product {
  id: string
  name: string
  sku: string
  category_name: string
  price: number
  cost_price?: number
  purchase_price?: number
  color?: string
  size?: string
  brand?: string
  age_range?: string
  gender?: string
  description?: string
  total_stock: number
  total_branch_count: number
  inventory?: {
    branch_id: string
    branch_name: string
    quantity: number
    min_stock_level: number
    max_stock_level: number
    stock_status: string
  }[]
}

interface CrossBranchSearchProps {
  searchTerm: string
  filters?: {
    status?: string
    category?: string
    brand?: string
    gender?: string
    ageRange?: string
    size?: string
    color?: string
    priceMin?: number
    priceMax?: number
    stockMin?: number
    stockMax?: number
  }
}

export function CrossBranchSearch({ searchTerm, filters = {} }: CrossBranchSearchProps) {
  const [products, setProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [isSelectAll, setIsSelectAll] = useState(false)
  const [isSearchFocused, setIsSearchFocused] = useState(false)
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const [searchSuggestions, setSearchSuggestions] = useState<string[]>([])
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([])
  const [brands, setBrands] = useState<string[]>([])
  const [ageRanges, setAgeRanges] = useState<string[]>([])
  const [colors, setColors] = useState<string[]>([])
  const { currentBranch } = useBranch()

  useEffect(() => {
    if (searchTerm.trim()) {
      fetchOtherBranchProducts()
    } else {
      setProducts([])
    }
  }, [searchTerm, filters])

  useEffect(() => {
    fetchCategories()
    fetchBrandsAndAgeRanges()
    loadRecentSearches()
  }, [])

  const fetchCategories = async () => {
    try {
      const response = await apiClient.getCategories()
      if (response.success && response.data) {
        setCategories(response.data as { id: string; name: string }[])
      }
    } catch (error) {
      console.error("Error fetching categories:", error)
    }
  }

  const fetchBrandsAndAgeRanges = async () => {
    try {
      // Since getBrandsAndAgeRanges doesn't exist, we'll fetch them separately or use a different approach
      // For now, we'll set empty arrays and they can be populated later
      setBrands([])
      setAgeRanges([])
      setColors([])
    } catch (error) {
      console.error("Error fetching brands and age ranges:", error)
    }
  }

  const loadRecentSearches = () => {
    const saved = localStorage.getItem('crossBranchRecentSearches')
    if (saved) {
      setRecentSearches(JSON.parse(saved))
    }
  }

  const saveRecentSearch = (search: string) => {
    if (!search.trim()) return
    const updated = [search, ...recentSearches.filter(s => s !== search)].slice(0, 10)
    setRecentSearches(updated)
    localStorage.setItem('crossBranchRecentSearches', JSON.stringify(updated))
  }

  const handleRecentSearchClick = (search: string) => {
    saveRecentSearch(search)
    // This would need to be handled by the parent component
    // For now, we'll just save it locally
  }

  const generateSearchSuggestions = (term: string) => {
    if (term.length < 2) return []
    
    const suggestions: string[] = []
    
    // Add category suggestions
    categories.forEach(cat => {
      if (cat.name.toLowerCase().includes(term.toLowerCase())) {
        suggestions.push(cat.name)
      }
    })
    
    // Add brand suggestions
    brands.forEach(brand => {
      if (brand.toLowerCase().includes(term.toLowerCase())) {
        suggestions.push(brand)
      }
    })
    
    // Add age range suggestions
    ageRanges.forEach(age => {
      if (age.toLowerCase().includes(term.toLowerCase())) {
        suggestions.push(age)
      }
    })
    
    return suggestions.slice(0, 5)
  }

  const getSearchTypeIndicator = (searchTerm: string) => {
    if (searchTerm.length < 3) {
      return {
        label: 'Exact Match Search',
        description: 'Searching for exact product matches',
        bgColor: 'bg-yellow-50',
        borderColor: 'border-yellow-200',
        color: 'text-yellow-700'
      }
    } else if (searchTerm.length < 6) {
      return {
        label: 'Partial Match Search',
        description: 'Searching for partial product matches',
        bgColor: 'bg-blue-50',
        borderColor: 'border-blue-200',
        color: 'text-blue-700'
      }
    } else {
      return {
        label: 'Phrase Match Search',
        description: 'Searching for phrase-based matches',
        bgColor: 'bg-green-50',
        borderColor: 'border-green-200',
        color: 'text-green-700'
      }
    }
  }

  const fetchOtherBranchProducts = async () => {
    setIsLoading(true)
    try {
      const params: any = {
        search: searchTerm,
        cross_branch: true,
        limit: 50,
        ...filters // Spread all filter parameters
      }

      const response = await apiClient.getProducts(params)

      if (response.success && response.data) {
        const productsData = (response.data as any).products as Product[]
        setProducts(productsData)
      } else {
        setProducts([])
      }
    } catch (error) {
      console.error("Cross-branch search error:", error)
      setProducts([])
    } finally {
      setIsLoading(false)
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

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedItems(new Set(products.map(p => p.id)))
      setIsSelectAll(true)
    } else {
      setSelectedItems(new Set())
      setIsSelectAll(false)
    }
  }

  const handleSelectItem = (productId: string, checked: boolean) => {
    const newSelected = new Set(selectedItems)
    if (checked) {
      newSelected.add(productId)
    } else {
      newSelected.delete(productId)
    }
    setSelectedItems(newSelected)
    setIsSelectAll(newSelected.size === products.length)
  }

  if (isLoading) {
    return (
      <Card className="border-0 shadow-lg">
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-8 w-8 animate-spin text-pink-500" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (products.length === 0) {
    return (
      <Card className="border-0 shadow-lg bg-gray-50">
        <CardContent className="p-6">
          <div className="text-center text-gray-500">
            <Package className="h-8 w-8 mx-auto mb-2" />
            <p>No products found across branches</p>
            <p className="text-sm mt-1">Try a different search term</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2 mb-4">
          <Building2 className="h-5 w-5 text-blue-500" />
          <span>Cross-Branch Search Results ({products.length} products)</span>
        </CardTitle>
        
        {/* Enhanced Search Bar with Autocomplete */}
        <div className="relative">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search products by name, SKU, brand, or category..."
              value={searchTerm}
              onChange={(e) => {
                // This would need to be handled by the parent component
                // For now, we'll just show the current search term
              }}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
              className="pl-10 pr-20 rounded-xl border-gray-200 focus:border-blue-300 focus:ring-blue-200 h-10"
              disabled
            />
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center space-x-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600"
                title="Search Help: < 3 chars = Exact match, 3-5 chars = Partial match, 6+ chars = Phrase match"
              >
                ?
              </Button>
            </div>
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
                      <Sparkles className="h-3 w-3 text-blue-500" />
                      <span className="text-xs font-medium text-gray-700">Suggestions</span>
                    </div>
                    <div className="space-y-1">
                      {generateSearchSuggestions(searchTerm).map((suggestion, index) => (
                        <button
                          key={index}
                          onClick={() => {
                            // This would need to be handled by the parent component
                          }}
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
                          onClick={() => {
                            // This would need to be handled by the parent component
                          }}
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

        <CardDescription className="mt-3">
          Showing products found across all branches for "{searchTerm}"
        </CardDescription>

        {/* Quick Filters Row */}
        <div className="mt-4 flex items-center gap-2 flex-nowrap overflow-x-auto pb-1">
          <span className="text-xs font-medium text-gray-600 mr-2 whitespace-nowrap">Quick Filters:</span>
          
          {/* Status Filter */}
          <div className="flex-shrink-0">
            <Select value={filters.status || "all"} onValueChange={(value) => {
              // This would need to be handled by the parent component
            }}>
              <SelectTrigger className="h-5 px-2 text-xs border-gray-200 focus:border-blue-300 focus:ring-blue-200 w-[120px]">
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
          <div className="flex-shrink-0">
            <Select value={filters.category || "all"} onValueChange={(value) => {
              // This would need to be handled by the parent component
            }}>
              <SelectTrigger className="h-5 px-2 text-xs border-gray-200 focus:border-blue-300 focus:ring-blue-200 w-[160px]">
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
          <div className="flex-shrink-0">
            <Select value={filters.brand || "all"} onValueChange={(value) => {
              // This would need to be handled by the parent component
            }}>
              <SelectTrigger className="h-5 px-2 text-xs border-gray-200 focus:border-blue-300 focus:ring-blue-200 w-[120px]">
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
          <div className="flex-shrink-0">
            <Select value={filters.gender || "all"} onValueChange={(value) => {
              // This would need to be handled by the parent component
            }}>
              <SelectTrigger className="h-5 px-2 text-xs border-gray-200 focus:border-blue-300 focus:ring-blue-200 w-[120px]">
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
          <div className="flex-shrink-0">
            <Select value={filters.ageRange || "all"} onValueChange={(value) => {
              // This would need to be handled by the parent component
            }}>
              <SelectTrigger className="h-5 px-2 text-xs border-gray-200 focus:border-blue-300 focus:ring-blue-200 w-[100px]">
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
          <div className="flex-shrink-0">
            <Select value={filters.size || "all"} onValueChange={(value) => {
              // This would need to be handled by the parent component
            }}>
              <SelectTrigger className="h-5 px-2 text-xs border-gray-200 focus:border-blue-300 focus:ring-blue-200 w-[110px]">
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
          <div className="flex-shrink-0">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-5 px-2 text-xs border-gray-200 focus:border-blue-300 focus:ring-blue-200 w-[110px]"
                >
                  <Palette className="h-3 w-3 mr-1" />
                  {filters.color === "all" || !filters.color ? "Color" : filters.color.replace('-', ' ')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-3">
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-gray-700">Select Color</Label>
                  <div className="grid grid-cols-8 gap-1">
                    <button
                      onClick={() => {
                        // This would need to be handled by the parent component
                      }}
                      className={`w-6 h-6 rounded-full border-2 transition-all duration-200 ${
                        filters.color === "all" || !filters.color
                          ? 'border-blue-500 scale-110' 
                          : 'border-gray-300 hover:border-blue-400 hover:scale-105'
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
                        onClick={() => {
                          // This would need to be handled by the parent component
                        }}
                        className={`w-6 h-6 rounded-full border-2 transition-all duration-200 ${
                          filters.color === color 
                            ? 'border-blue-500 scale-110' 
                            : 'border-gray-300 hover:border-blue-400 hover:scale-105'
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
          {(filters.status !== "all" || filters.category !== "all" || filters.brand !== "all" || filters.gender !== "all" || filters.ageRange !== "all" || filters.size !== "all" || filters.color !== "all") && (
            <Badge variant="secondary" className="h-6 px-2 text-xs bg-blue-100 text-blue-700">
              {Object.values(filters).filter(v => v !== "all" && v !== undefined).length} active
            </Badge>
          )}

          {/* Clear Filters Button */}
          {(filters.status !== "all" || filters.category !== "all" || filters.brand !== "all" || filters.gender !== "all" || filters.ageRange !== "all" || filters.size !== "all" || filters.color !== "all" || filters.priceMin || filters.priceMax || filters.stockMin || filters.stockMax) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                // This would need to be handled by the parent component
              }}
              className="h-6 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <X className="h-3 w-3 mr-1" />
              Clear All
            </Button>
          )}
        </div>

        {/* Price and Stock Range Filters */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Price Range */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium text-gray-700">Selling Price Range (ብር)</Label>
              <span className="text-xs text-gray-500">
                {filters.priceMin || 0} - {filters.priceMax || 1000}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <Input
                type="number"
                placeholder="Min"
                value={filters.priceMin || ""}
                onChange={(e) => {
                  // This would need to be handled by the parent component
                }}
                className="h-7 text-xs w-20"
                min="0"
                max="1000"
              />
              <span className="text-xs text-gray-400">to</span>
              <Input
                type="number"
                placeholder="Max"
                value={filters.priceMax || ""}
                onChange={(e) => {
                  // This would need to be handled by the parent component
                }}
                className="h-7 text-xs w-20"
                min="0"
                max="1000"
              />
            </div>
          </div>

          {/* Stock Range */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium text-gray-700">Stock Range</Label>
              <span className="text-xs text-gray-500">
                {filters.stockMin || 0} - {filters.stockMax || 100}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <Input
                type="number"
                placeholder="Min"
                value={filters.stockMin || ""}
                onChange={(e) => {
                  // This would need to be handled by the parent component
                }}
                className="h-7 text-xs w-20"
                min="0"
                max="100"
              />
              <span className="text-xs text-gray-400">to</span>
              <Input
                type="number"
                placeholder="Max"
                value={filters.stockMax || ""}
                onChange={(e) => {
                  // This would need to be handled by the parent component
                }}
                className="h-7 text-xs w-20"
                min="0"
                max="100"
              />
            </div>
          </div>
        </div>
      </CardHeader>

      {/* Search Type Indicator */}
      {searchTerm.trim() && (
        <div className="px-6 pb-4">
          <div className="p-3 rounded-lg border bg-blue-50 border-blue-200">
            <div className="flex items-center space-x-2">
              <Search className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-600">
                {searchTerm.length < 3 ? 'Exact Match Search' : 
                 searchTerm.length < 6 ? 'Partial Match Search' : 'Phrase Match Search'}
              </span>
              <span className="text-xs text-gray-600">
                {searchTerm.length < 3 ? 'Searching for exact product matches' :
                 searchTerm.length < 6 ? 'Searching for partial product matches' :
                 'Searching for phrase-based matches'}
              </span>
            </div>
          </div>
        </div>
      )}



      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center space-y-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
              <p className="text-gray-600">Searching across all branches...</p>
            </div>
          </div>
        ) : products.length === 0 && searchTerm.trim() ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center space-y-4">
              <Search className="h-12 w-12 text-gray-300 mx-auto" />
              <div>
                <h3 className="text-lg font-medium text-gray-900">No products found</h3>
                <p className="text-gray-500 mt-1">
                  No products matching "{searchTerm}" were found across all branches.
                </p>
                <div className="mt-4 space-y-2">
                  <p className="text-sm text-gray-600">Try:</p>
                  <ul className="text-sm text-gray-500 space-y-1">
                    <li>• Checking your spelling</li>
                    <li>• Using different keywords</li>
                    <li>• Adjusting your filters</li>
                    <li>• Searching for a broader term</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        ) : (
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
                <TableHead className="font-semibold text-gray-700">Product</TableHead>
                <TableHead className="font-semibold text-gray-700">Details</TableHead>
                <TableHead className="font-semibold text-gray-700">Total Stock</TableHead>
                <TableHead className="font-semibold text-gray-700">Selling Price</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product, index) => (
                <TableRow 
                  key={product.id} 
                  className={`group transition-all duration-200 hover:bg-gradient-to-r hover:from-pink-50 hover:to-purple-50 border-b border-gray-100 ${
                    index % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'
                  }`}
                >
                  <TableCell className="pl-6">
                    <Checkbox
                      checked={selectedItems.has(product.id)}
                      onCheckedChange={(checked) => handleSelectItem(product.id, checked as boolean)}
                      aria-label={`Select ${product.name}`}
                      className="h-[18px] w-[18px] rounded-md transition-all duration-200 border-gray-300 shadow-sm hover:border-pink-400 focus:ring-pink-500 data-[state=checked]:bg-pink-500 data-[state=checked]:border-pink-500"
                    />
                  </TableCell>
                  <TableCell className="py-3">
                    <div className="space-y-2">
                      {/* Product Name */}
                      <h3 className="font-semibold text-gray-900 text-base leading-tight line-clamp-2 hover:text-blue-600 transition-colors" title={product.name}>
                        {product.name}
                      </h3>
                      
                      {/* SKU */}
                      <div className="flex items-center space-x-1">
                        <span className="text-xs font-medium text-gray-400">SKU:</span>
                        <span className="text-xs font-mono text-gray-600 bg-gray-50 px-1.5 py-0.5 rounded">
                          {product.sku}
                        </span>
                      </div>
                      
                      {/* Category */}
                      <div className="flex items-center flex-wrap gap-1">
                        <Badge 
                          variant="outline" 
                          className="text-xs bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100 transition-colors"
                        >
                          <Tag className="h-2.5 w-2.5 mr-1" />
                          {product.category_name}
                        </Badge>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="py-3">
                    <div className="space-y-2">
                      {/* Color and Size */}
                      <div className="flex items-center space-x-2">
                        {product.color && (
                          <div className="flex items-center space-x-1">
                            <div 
                              className={`w-4 h-4 rounded-full border border-gray-300 ${getColorClass(product.color)}`}
                              style={getColorStyle(product.color)}
                              title={product.color.replace('-', ' ')}
                            />
                            <span className="text-xs text-gray-600 capitalize">{product.color.replace('-', ' ')}</span>
                          </div>
                        )}
                        {product.size && (
                          <>
                            <span className="text-gray-300">•</span>
                            <span className="text-xs text-gray-600 font-medium">{product.size}</span>
                          </>
                        )}
                      </div>
                      
                      {/* Brand */}
                      {product.brand && (
                        <div className="flex items-center space-x-1">
                          <Star className="h-3 w-3 text-yellow-500" />
                          <span className="text-xs text-gray-600">{product.brand}</span>
                        </div>
                      )}
                      
                      {/* Age Range and Gender */}
                      {(product.age_range || product.gender) && (
                        <div className="flex items-center space-x-2 text-xs text-gray-500">
                          {product.age_range && (
                            <span>{product.age_range}</span>
                          )}
                          {product.gender && (
                            <>
                              <span className="text-gray-300">•</span>
                              <span className="capitalize">{product.gender}</span>
                            </>
                          )}
                        </div>
                      )}
                      
                      {/* Description */}
                      {product.description && (
                        <div className="pt-1">
                          <p className="text-xs text-gray-500 line-clamp-2 leading-tight" title={product.description}>
                            {product.description}
                          </p>
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="py-3">
                    <div className="text-center space-y-1">
                      <div className="flex items-center justify-center space-x-1">
                        <span className="text-xl font-bold text-blue-700">{product.total_stock}</span>
                        <span className="text-xs font-medium text-blue-600">pieces</span>
                      </div>
                    </div>
                                     </TableCell>
                   <TableCell className="py-3">
                      <div className="text-center space-y-1">
                        <p className="text-lg font-bold text-green-700">{Number(product.price).toFixed(0)} ብር</p>
                       {product.purchase_price && (
                         <p className="text-[10px] text-gray-400 leading-tight">
                           Purchase: {Number(product.purchase_price).toFixed(0)} ብር
                         </p>
                       )}
                       {product.cost_price && (
                         <p className="text-xs text-gray-600">
                           Cost: {Number(product.cost_price).toFixed(0)} ብር
                         </p>
                       )}
                       {product.cost_price && (
                         <p className="text-xs text-green-500 font-medium">
                           Margin: {(((Number(product.price) - Number(product.cost_price)) / Number(product.price)) * 100).toFixed(1)}%
                         </p>
                       )}
                     </div>
                   </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        )}
      </CardContent>
    </Card>
  )
}
