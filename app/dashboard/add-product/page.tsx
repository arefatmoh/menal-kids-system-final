"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Plus, Upload, Package, Loader2, CheckCircle, Trash2, AlertTriangle, Search } from "lucide-react"
import { useLanguage } from "@/lib/language-context"
import apiClient from "@/lib/api-client"
import { useToast } from "@/hooks/use-toast"
import { useBranch } from "@/lib/branch-context"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { ProductTypeSelector } from "@/components/product-type-selector"
import { VariationBuilder } from "@/components/variation-builder"

interface Variation {
  id?: string
  color?: string
  size?: string
  price?: number
  cost_price?: number
  purchase_price?: number
  initial_quantity: number
  min_stock_level?: number
  max_stock_level?: number
}

export default function AddProductPage() {
  const { t } = useLanguage()
  const { toast } = useToast()
  const { currentBranch } = useBranch()
  const router = useRouter()
  
  // Product type state
  const [productType, setProductType] = useState<"uniform" | "variation" | "existing-variation">("uniform")
  
  // Form data for both uniform and variation products
  const [formData, setFormData] = useState({
    name: "",
    category_id: "",
    customCategory: "",
    description: "",
    brand: "",
    age_range: "",
    gender: "",
    image: null as File | null,
    // Uniform product fields
    color: "",
    size: "",
    price: "",
    purchase_price: "",
    initial_quantity: "",
    min_stock_level: "",
    max_stock_level: "",
  })

  // Variations state for variation products
  const [variations, setVariations] = useState<Variation[]>([])

  const [categories, setCategories] = useState<{ id: string; name: string }[]>([])
  const [showAddCategory, setShowAddCategory] = useState(false)
  const [newCategory, setNewCategory] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [lastAddedProduct, setLastAddedProduct] = useState<any>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const [isDuplicateName, setIsDuplicateName] = useState(false)
  const [nameCheckLoading, setNameCheckLoading] = useState(false)
  const [nameError, setNameError] = useState("")
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)

  // State for existing product search
  const [existingProductSearch, setExistingProductSearch] = useState("")
  const [existingProducts, setExistingProducts] = useState<any[]>([])
  const [selectedExistingProduct, setSelectedExistingProduct] = useState<any>(null)
  const [existingVariations, setExistingVariations] = useState<any[]>([])
  const [isSearchingProducts, setIsSearchingProducts] = useState(false)
  const [isLoadingVariations, setIsLoadingVariations] = useState(false)
  const [showProductSearch, setShowProductSearch] = useState(false)

  useEffect(() => {
    fetchCategories()
  }, [])



  const fetchCategories = async () => {
    try {
      const response = await apiClient.getCategories()
      if (response.success && response.data) {
        const categoriesData = response.data as { id: string; name: string }[]
        setCategories(categoriesData)
        return categoriesData
      }
      return []
    } catch (error) {
      console.error("Categories fetch error:", error)
      return []
    }
  }

  const searchExistingProducts = async (searchTerm: string) => {
    if (!searchTerm.trim() || !currentBranch || currentBranch === "all") {
      setExistingProducts([])
      return
    }

    setIsSearchingProducts(true)
    try {
      const response = await apiClient.getProducts({
        search: searchTerm.trim(),
        branch_id: currentBranch,
        limit: 10,
        product_type: "variation" // Only show variation products
      })
      
      if (response.success && response.data && (response.data as any).products) {
        const products = (response.data as any).products
        setExistingProducts(products)
      } else {
        setExistingProducts([])
      }
    } catch (error) {
      console.error("Search products error:", error)
      setExistingProducts([])
    } finally {
      setIsSearchingProducts(false)
    }
  }

  // Debounced search for existing products
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (existingProductSearch.trim()) {
        searchExistingProducts(existingProductSearch)
      }
    }, 500)

    return () => clearTimeout(timeoutId)
  }, [existingProductSearch])

  // Fetch existing variations when a product is selected
  const fetchExistingVariations = async (productId: string) => {
    setIsLoadingVariations(true)
    try {
      const response = await apiClient.getVariations(productId)
      if (response.success && response.data) {
        const data = response.data as any
        setExistingVariations(data.variations || [])
      } else {
        setExistingVariations([])
      }
    } catch (error) {
      console.error("Fetch variations error:", error)
      setExistingVariations([])
    } finally {
      setIsLoadingVariations(false)
    }
  }

  const checkDuplicateProductName = async (name: string) => {
    if (!name.trim()) {
      setIsDuplicateName(false)
      setNameError("")
      return
    }
    if (!currentBranch || currentBranch === "all") {
      setIsDuplicateName(false)
      setNameError("")
      return
    }
    setNameCheckLoading(true)
    try {
      const response = await apiClient.getProducts({
        search: name.trim(),
        branch_id: currentBranch,
        name_exact: true,
        limit: 1
      })
      let products: any[] = [];
      if (response.success && response.data && (response.data as any).products) {
        products = (response.data as any).products;
      }
      const exists = products.length > 0;
      if (exists) {
        setIsDuplicateName(true)
        setNameError(
          "This product name already exists. If you're adding more stock, please use the Stock page. Otherwise, change the product name."
        )
        toast({
          title: "Duplicate Product Name",
          description: "This product name already exists. If you're adding more stock, please use the Stock page. Otherwise, change the product name.",
          variant: "destructive",
        })
        return
      }
      setIsDuplicateName(false)
      setNameError("")
    } catch (err) {
      setIsDuplicateName(false)
      setNameError("")
    } finally {
      setNameCheckLoading(false)
    }
  }

  const handleNameBlur = async (e: React.FocusEvent<HTMLInputElement>) => {
    await checkDuplicateProductName(e.target.value)
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (field === "name") {
      setIsDuplicateName(false)
      setNameError("")
    }
  }

  const handleColorSelect = (color: string) => {
    setFormData((prev) => ({ ...prev, color }))
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null
    setFormData((prev) => ({ ...prev, image: file }))
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

  const handleAddCategory = async () => {
    if (newCategory.trim() && !categories.find(cat => cat.name.toLowerCase() === newCategory.toLowerCase())) {
      try {
        const response = await apiClient.createCategory({
          name: newCategory,
          description: `Category for ${newCategory}`,
        })
        
        if (response.success) {
          toast({
            title: "Success",
            description: "Category created successfully",
          })
          
          // Get the newly created category data
          const categoryData = response.data as { id: string; name: string }
          
          // Update categories list first and wait for it to complete
          await fetchCategories()
          
          // Small delay to ensure state updates are synchronized
          await new Promise(resolve => setTimeout(resolve, 100))
          
          // Update form data to select the new category
          setFormData(prev => ({ ...prev, category_id: categoryData.id }))
          
          // Close the dialog and reset new category input
          setNewCategory("")
          setShowAddCategory(false)
        } else {
          toast({
            title: "Error",
            description: response.error || "Failed to create category",
            variant: "destructive",
          })
        }
      } catch (error: any) {
        console.error("Create category error:", error)
        toast({
          title: "Error",
          description: "Failed to create category",
          variant: "destructive",
        })
      }
    }
  }

  const validateForm = () => {
    if (productType === "existing-variation") {
      if (!selectedExistingProduct) {
        toast({
          title: "Error",
          description: "Please select an existing product to add variations to",
          variant: "destructive",
        })
        return false
      }
      
      if (variations.length === 0) {
        toast({
          title: "Error",
          description: "Please add at least one variation to add to the existing product",
          variant: "destructive",
        })
        return false
      }

      // Validate variations
      for (const variation of variations) {
        if (!variation.initial_quantity || variation.initial_quantity <= 0) {
          toast({
            title: "Error",
            description: "All variations must have initial stock quantity greater than 0",
            variant: "destructive",
          })
          return false
        }
      }
      
      return true
    }

    if (!formData.name || !formData.category_id) {
      toast({
        title: "Error",
        description: "Please fill in all required fields (Product Name and Category)",
        variant: "destructive",
      })
      return false
    }

    if (productType === "uniform") {
      if (!formData.initial_quantity) {
        toast({
          title: "Error",
          description: "Please enter initial stock quantity for uniform product",
          variant: "destructive",
        })
        return false
      }
    } else if (productType === "variation") {
      if (variations.length === 0) {
        toast({
          title: "Error",
          description: "Please add at least one variation for variation product",
          variant: "destructive",
        })
        return false
      }

      // Validate variations
      for (const variation of variations) {
        if (!variation.initial_quantity || variation.initial_quantity <= 0) {
          toast({
            title: "Error",
            description: "All variations must have initial stock quantity greater than 0",
            variant: "destructive",
          })
          return false
        }
      }
    }

    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (isDuplicateName) {
      toast({
        title: "Duplicate Product Name",
        description: "A product with this name already exists. Please change the name or go to the Stock page to update stock.",
        variant: "destructive",
      })
      return
    }

    if (!validateForm()) {
      return
    }

    setIsSubmitting(true)

    try {
      let productData: any = {
        name: formData.name,
        category_id: formData.category_id,
        description: formData.description || undefined,
        brand: formData.brand || undefined,
        age_range: formData.age_range || undefined,
        gender: formData.gender || undefined,
        product_type: productType,
        branch_id: currentBranch === "all" ? "branch1" : currentBranch,
      }

      if (productType === "uniform") {
        // For uniform products, use the existing structure
        productData = {
          ...productData,
          color: formData.color || undefined,
          size: formData.size || undefined,
          price: formData.price ? Number.parseFloat(formData.price) : undefined,
          purchase_price: formData.purchase_price ? Number.parseFloat(formData.purchase_price) : undefined,
          initial_quantity: Number.parseInt(formData.initial_quantity),
          min_stock_level: formData.min_stock_level ? Number.parseInt(formData.min_stock_level) : null,
          max_stock_level: formData.max_stock_level ? Number.parseInt(formData.max_stock_level) : null,
        }
      } else if (productType === "variation") {
        // For variation products, include variations
        productData.variations = variations.map(variation => ({
          color: variation.color || undefined,
          size: variation.size || undefined,
          price: variation.price || undefined,
          purchase_price: variation.purchase_price || undefined,
          initial_quantity: variation.initial_quantity,
          min_stock_level: variation.min_stock_level || null,
          max_stock_level: variation.max_stock_level || null,
        }))
      }

      const response = await apiClient.createProduct(productData)
      
      if (response.success) {
        const currentDate = new Date().toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })
        
        toast({
          title: "Product Added Successfully!",
          description: `The ${productType} product has been added to ${currentBranch === "all" ? "Branch 1" : currentBranch === "branch1" ? "Franko (Main)" : "Mebrathayl"} inventory on ${currentDate}. You can now manage it from the inventory page.`,
        })
        setLastAddedProduct({
          ...(response.data as any), 
          registration_date: currentDate,
          product_type: productType,
          variations: productType === 'variation' ? variations : [],
          form_data: productType === 'uniform' ? formData : null
        })
        
        // Reset form
        setFormData({
          name: "",
          category_id: "",
          customCategory: "",
          description: "",
          brand: "",
          age_range: "",
          gender: "",
          image: null,
          color: "",
          size: "",
          price: "",
          purchase_price: "",
          initial_quantity: "",
          min_stock_level: "",
          max_stock_level: "",
        })
        setVariations([])
        setProductType("uniform")
        if (formRef.current) formRef.current.reset()
        
        window.scrollTo({ top: 0, behavior: 'smooth' })
      } else {
        toast({
          title: "Error",
          description: response.error || "Failed to add product",
          variant: "destructive",
        })
      }
    } catch (error: any) {
      console.error("Add product error:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to add product",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleAddVariationToExisting = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!selectedExistingProduct || variations.length === 0) {
      toast({
        title: "Error",
        description: "Please select an existing product and add at least one variation",
        variant: "destructive",
      })
      return
    }

    // Validate each variation before submitting
    for (const [index, variation] of variations.entries()) {
      const hasColorOrSize = Boolean((variation.color && variation.color.trim()) || (variation.size && variation.size.trim()))
      if (!hasColorOrSize) {
        toast({
          title: "Incomplete Variation",
          description: `Variation ${index + 1} must have at least a Color or a Size selected`,
          variant: "destructive",
        })
        return
      }
      if (!variation.initial_quantity || variation.initial_quantity <= 0) {
        toast({
          title: "Invalid Quantity",
          description: `Variation ${index + 1} must have initial stock greater than 0`,
          variant: "destructive",
        })
        return
      }
    }

    setIsSubmitting(true)

    try {
      // Add each variation to the existing product
      const addedVariations = []
      
      for (const variation of variations) {
        const variationData = {
          color: variation.color || undefined,
          size: variation.size || undefined,
          price: variation.price || undefined,
          purchase_price: variation.purchase_price || undefined,
          initial_quantity: variation.initial_quantity,
          min_stock_level: variation.min_stock_level || null,
          max_stock_level: variation.max_stock_level || null,
          branch_id: currentBranch === "all" ? "branch1" : currentBranch,
        }

        const response = await apiClient.addVariationToProduct(selectedExistingProduct.id, variationData)
        
        if (response.success) {
          addedVariations.push(variation)
        } else {
          throw new Error(`Failed to add variation: ${response.error}`)
        }
      }

      const currentDate = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
      
      toast({
        title: "Variations Added Successfully!",
        description: `${addedVariations.length} variations have been added to ${selectedExistingProduct.name} on ${currentDate}.`,
      })

      setLastAddedProduct({
        id: selectedExistingProduct.id,
        name: selectedExistingProduct.name,
        product_type: 'existing-variation',
        variations: addedVariations,
        registration_date: currentDate
      })
      
      // Reset form
      setVariations([])
      setSelectedExistingProduct(null)
      setExistingProductSearch("")
      setExistingProducts([])
      setExistingVariations([])
      setProductType("uniform")
      
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (error: any) {
      console.error("Add variation error:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to add variations to existing product",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      {lastAddedProduct && (
        <Card className="border-0 shadow-xl bg-gradient-to-br from-emerald-50 via-green-50 to-teal-50 border border-emerald-200 animate-in slide-in-from-top-2 duration-500">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full flex items-center justify-center shadow-lg">
                    <CheckCircle className="h-5 w-5 text-white" />
                  </div>
                </div>
                <div>
                  <CardTitle className="text-lg text-emerald-800 flex items-center space-x-2">
                    <span>
                      {lastAddedProduct.product_type === 'existing-variation' 
                        ? '🎉 Variations Successfully Added!' 
                        : '🎉 Product Successfully Added!'
                      }
                    </span>
                  </CardTitle>
                  <CardDescription className="text-emerald-700 text-sm">
                    {lastAddedProduct.product_type === 'existing-variation'
                      ? `${lastAddedProduct.variations?.length || 0} variations added to existing product`
                      : lastAddedProduct.product_type === 'variation' 
                      ? `Variation product with ${lastAddedProduct.variations?.length || 0} variations added to inventory`
                      : 'Uniform product added to inventory system'
                    }
                  </CardDescription>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLastAddedProduct(null)}
                className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 p-1 h-8 w-8"
              >
                ×
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
              {/* Product Details */}
              <div className="lg:col-span-3">
                <div className="bg-white rounded-xl p-4 border border-emerald-200 shadow-sm">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-bold text-lg text-gray-800 truncate">{lastAddedProduct.name}</h3>
                    <div className="flex items-center space-x-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        lastAddedProduct.product_type === 'existing-variation'
                          ? 'bg-blue-100 text-blue-700 border border-blue-200'
                          : lastAddedProduct.product_type === 'variation' 
                          ? 'bg-purple-100 text-purple-700 border border-purple-200'
                          : 'bg-blue-100 text-blue-700 border border-blue-200'
                      }`}>
                        {lastAddedProduct.product_type === 'existing-variation' 
                          ? 'Existing + Variations' 
                          : lastAddedProduct.product_type === 'variation' 
                            ? 'Variation' 
                            : 'Uniform'
                        }
                      </span>
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200">
                        {lastAddedProduct.sku || 'N/A'}
                      </span>
                    </div>
                  </div>
                  
                  {/* Basic Info Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                    <div className="space-y-1">
                      <span className="text-xs text-gray-500 uppercase tracking-wide">Category</span>
                      <p className="text-sm font-medium text-gray-800">{lastAddedProduct.category_name || "-"}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs text-gray-500 uppercase tracking-wide">Branch</span>
                      <p className="text-sm font-medium text-gray-800">
                        {currentBranch === "branch1" ? "Franko (Main)" : currentBranch === "branch2" ? "Mebrathayl" : "All Branches"}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs text-gray-500 uppercase tracking-wide">Added</span>
                      <p className="text-sm font-medium text-gray-800">
                        {lastAddedProduct.registration_date || new Date().toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>

                  {/* Variation Details */}
                  {(lastAddedProduct.product_type === 'variation' || lastAddedProduct.product_type === 'existing-variation') && lastAddedProduct.variations && lastAddedProduct.variations.length > 0 && (
                    <div className="border-t border-emerald-100 pt-3">
                      <div className="flex items-center space-x-2 mb-2">
                        <span className="text-xs text-gray-500 uppercase tracking-wide">Variations ({lastAddedProduct.variations.length})</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {lastAddedProduct.variations.slice(0, 4).map((variation: any, index: number) => (
                          <div key={index} className="bg-emerald-50 rounded-lg p-2 border border-emerald-100">
                            <div className="flex items-center justify-between text-xs">
                              <div className="flex items-center space-x-2">
                                {variation.color && (
                                  <div className="flex items-center space-x-1">
                                    <div 
                                      className="w-3 h-3 rounded-full border border-gray-300"
                                      style={{ backgroundColor: getColorStyle(variation.color) as string }}
                                    />
                                    <span className="text-gray-700 capitalize">{variation.color.replace('-', ' ')}</span>
                                  </div>
                                )}
                                {variation.size && (
                                  <span className="text-gray-700">• {variation.size}</span>
                                )}
                              </div>
                              <span className="font-medium text-emerald-700">
                                ${variation.price || 0}
                              </span>
                            </div>
                            <div className="flex items-center justify-between mt-1 text-xs text-gray-600">
                              <span>Qty: {variation.initial_quantity}</span>
                              {lastAddedProduct.variations.length > 4 && index === 3 && (
                                <span className="text-emerald-600 font-medium">+{lastAddedProduct.variations.length - 4} more</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Uniform Product Details */}
                  {lastAddedProduct.product_type === 'uniform' && lastAddedProduct.form_data && (
                    <div className="border-t border-emerald-100 pt-3">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {lastAddedProduct.form_data.color && (
                          <div className="space-y-1">
                            <span className="text-xs text-gray-500 uppercase tracking-wide">Color</span>
                            <div className="flex items-center space-x-2">
                              <div 
                                className="w-4 h-4 rounded-full border border-gray-300"
                                style={{ backgroundColor: getColorStyle(lastAddedProduct.form_data.color) as string }}
                              />
                              <span className="text-sm font-medium text-gray-800 capitalize">{lastAddedProduct.form_data.color.replace('-', ' ')}</span>
                            </div>
                          </div>
                        )}
                        {lastAddedProduct.form_data.size && (
                          <div className="space-y-1">
                            <span className="text-xs text-gray-500 uppercase tracking-wide">Size</span>
                            <p className="text-sm font-medium text-gray-800">{lastAddedProduct.form_data.size}</p>
                          </div>
                        )}
                        {lastAddedProduct.form_data.price && (
                          <div className="space-y-1">
                            <span className="text-xs text-gray-500 uppercase tracking-wide">Selling Price</span>
                            <p className="text-sm font-medium text-gray-800">${lastAddedProduct.form_data.price}</p>
                          </div>
                        )}
                        {lastAddedProduct.form_data.initial_quantity && (
                          <div className="space-y-1">
                            <span className="text-xs text-gray-500 uppercase tracking-wide">Stock</span>
                            <p className="text-sm font-medium text-gray-800">{lastAddedProduct.form_data.initial_quantity}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Additional Product Details */}
                  <div className="border-t border-emerald-100 pt-3">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {lastAddedProduct.description && (
                        <div className="space-y-1">
                          <span className="text-xs text-gray-500 uppercase tracking-wide">Description</span>
                          <p className="text-sm font-medium text-gray-800 line-clamp-2">{lastAddedProduct.description}</p>
                        </div>
                      )}
                      {lastAddedProduct.brand && (
                        <div className="space-y-1">
                          <span className="text-xs text-gray-500 uppercase tracking-wide">Brand</span>
                          <p className="text-sm font-medium text-gray-800">{lastAddedProduct.brand}</p>
                        </div>
                      )}
                      {lastAddedProduct.age_range && (
                        <div className="space-y-1">
                          <span className="text-xs text-gray-500 uppercase tracking-wide">Age Range</span>
                          <p className="text-sm font-medium text-gray-800">{lastAddedProduct.age_range}</p>
                        </div>
                      )}
                      {lastAddedProduct.gender && (
                        <div className="space-y-1">
                          <span className="text-xs text-gray-500 uppercase tracking-wide">Gender</span>
                          <p className="text-sm font-medium text-gray-800 capitalize">{lastAddedProduct.gender}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Action Buttons */}
              <div className="space-y-3">
                <Button 
                  onClick={() => window.location.href = '/dashboard/inventory'}
                  className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-lg rounded-xl"
                >
                  <Package className="h-4 w-4 mr-2" />
                  {t("viewInventory" as any)}
                </Button>
                <Button 
                  variant="destructive"
                  onClick={() => setIsDeleteConfirmOpen(true)}
                  className="w-full bg-red-600 hover:bg-red-700 text-white shadow-lg rounded-xl"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {t("deleteProduct" as any)}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setLastAddedProduct(null)}
                  className="w-full border-emerald-300 text-emerald-700 hover:bg-emerald-50 rounded-xl"
                >
                  {t("dismiss" as any)}
                </Button>
                <div className="text-center">
                  <div className="flex items-center justify-center space-x-1 text-emerald-600 text-xs">
                    <CheckCircle className="h-3 w-3" />
                    <span>{t("readyForManagement" as any)}</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">
            {t("addNewProductTitle" as any)}
          </h1>
          <p className="text-gray-600 mt-1">{t("addNewProductSubtitle" as any)}</p>
        </div>
        <Button 
          variant="outline"
          onClick={() => window.location.href = '/dashboard/inventory'}
          className="border-gray-200 hover:bg-gray-50 shadow-sm"
        >
          <Package className="h-4 w-4 mr-2" />
          {t("viewInventory" as any)}
        </Button>
      </div>

      <Card className="border-0 shadow-xl max-w-4xl bg-gradient-to-br from-white to-gray-50">
        <CardHeader className="bg-gradient-to-r from-pink-50 to-purple-50 border-b border-pink-100">
          <CardTitle className="flex items-center space-x-2 text-gray-800">
            <div className="w-10 h-10 bg-gradient-to-r from-pink-500 to-purple-500 rounded-lg flex items-center justify-center">
              <Plus className="h-5 w-5 text-white" />
            </div>
            <span>{t("productInformation" as any)}</span>
          </CardTitle>
          <CardDescription className="text-gray-600">
            {t("productInformationDesc" as any)}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form 
            onSubmit={(e) => {
              e.preventDefault()
              
              // Prevent submission if trying to add to existing but no product selected
              if (productType === "existing-variation" && !selectedExistingProduct) {
                toast({
                  title: "Error",
                  description: "Please select an existing product first",
                  variant: "destructive",
                })
                return
              }
              
              if (productType === "existing-variation") {
                handleAddVariationToExisting(e)
              } else {
                handleSubmit(e)
              }
            }} 
            className="space-y-6" 
            ref={formRef}
          >
            {/* Product Type Selector */}
            <ProductTypeSelector 
              selectedType={productType}
              onTypeChange={setProductType}
            />

            {/* Existing Product Search - Only show when adding variations to existing product */}
            {productType === "existing-variation" && (
              <div className="space-y-4 p-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-200">
                <div className="flex items-center space-x-2 mb-4">
                  <Search className="h-5 w-5 text-blue-600" />
                  <h3 className="text-lg font-semibold text-blue-800">{t("selectExistingProduct" as any)}</h3>
                </div>
                
                <div className="space-y-4">
                  {/* Product Search Input */}
                  <div className="space-y-2">
                    <Label htmlFor="existing-product-search">{t("searchExistingVariationProduct" as any)}</Label>
                    <Input
                      id="existing-product-search"
                      placeholder={t("typeToSearch" as any)}
                      value={existingProductSearch}
                      onChange={(e) => setExistingProductSearch(e.target.value)}
                      className="rounded-xl border-blue-200 focus:border-blue-400 focus:ring-blue-200"
                    />
                    {isSearchingProducts && (
                      <div className="flex items-center space-x-2 text-sm text-blue-600">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>{t("searching" as any)}</span>
                      </div>
                    )}
                  </div>

                  {/* Search Results */}
                  {existingProducts.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-blue-700">{t("selectAProduct" as any)}</Label>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-60 overflow-y-auto">
                        {existingProducts.map((product) => (
                          <Card
                            key={product.id}
                            className={`cursor-pointer transition-all duration-200 hover:shadow-md ${
                              selectedExistingProduct?.id === product.id
                                ? "ring-2 ring-blue-500 bg-blue-50 border-blue-300"
                                : "border-blue-200 hover:border-blue-300"
                            }`}
                            onClick={() => {
                              setSelectedExistingProduct(product)
                              fetchExistingVariations(product.id)
                            }}
                          >
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <h4 className="font-semibold text-gray-800 mb-1">{product.name}</h4>
                                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                                    <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs">
                                      {product.category_name || t("noCategory" as any)}
                                    </span>
                                    <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs">
                                      {product.variations_count || 0} {t("variationsLabel" as any)}
                                    </span>
                                  </div>
                                  {product.description && (
                                    <p className="text-sm text-gray-500 mt-2 line-clamp-2">
                                      {product.description}
                                    </p>
                                  )}
                                </div>
                                {selectedExistingProduct?.id === product.id && (
                                  <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center ml-2">
                                    <div className="w-2 h-2 bg-white rounded-full"></div>
                                  </div>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Selected Product Display */}
                  {selectedExistingProduct && (
                    <div className="p-4 bg-white rounded-lg border border-blue-200">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-semibold text-gray-800">{t("selectedProduct" as any)}</h4>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedExistingProduct(null)}
                          className="text-blue-600 hover:text-blue-700"
                        >
                          {t("change" as any)}
                        </Button>
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-center space-x-2">
                          <span className="font-medium text-gray-700">{selectedExistingProduct.name}</span>
                          <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs">
                            {t("readyForVariations" as any)}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2 text-sm text-gray-600">
                          <span>{t("category")}: {selectedExistingProduct.category_name || t("noCategory" as any)}</span>
                          <span>•</span>
                          <span>{selectedExistingProduct.variations_count || 0} {t("variationsLabel" as any)}</span>
                        </div>
                        <p className="text-sm text-gray-600">
                          {t("addVariationsToProduct" as any)}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Existing Variations Display */}
                  {selectedExistingProduct && existingVariations.length > 0 && (
                    <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-semibold text-gray-800">{t("variationsLabel" as any)}</h4>
                        {isLoadingVariations && (
                          <div className="flex items-center space-x-2 text-sm text-gray-600">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>{t("loading" as any)}</span>
                          </div>
                        )}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {existingVariations.slice(0, 6).map((variation: any, index: number) => (
                          <div key={variation.id || index} className="bg-white rounded-lg p-3 border border-gray-200">
                            <div className="flex items-center justify-between text-sm">
                              <div className="flex items-center space-x-2">
                                {variation.color && (
                                  <div className="flex items-center space-x-1">
                                    <div 
                                      className="w-3 h-3 rounded-full border border-gray-300"
                                      style={{ backgroundColor: getColorStyle(variation.color) as string }}
                                    />
                                    <span className="text-gray-700 capitalize">{variation.color.replace('-', ' ')}</span>
                                  </div>
                                )}
                                {variation.size && (
                                  <span className="text-gray-700">• {variation.size}</span>
                                )}
                              </div>
                              <span className="font-medium text-gray-700">
                                ${variation.price || 0}
                              </span>
                            </div>
                            {variation.inventory && variation.inventory.length > 0 && (
                              <div className="mt-1 text-xs text-gray-600">
                                Stock: {variation.inventory[0].quantity || 0}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                      {existingVariations.length > 6 && (
                        <div className="mt-2 text-center">
                          <span className="text-sm text-gray-600">
                            +{existingVariations.length - 6} {t("more" as any)} {t("variationsLabel" as any)}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* No Results Message */}
                  {existingProductSearch && existingProducts.length === 0 && !isSearchingProducts && (
                    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <div className="flex items-center space-x-2 text-yellow-800">
                        <AlertTriangle className="h-4 w-4" />
                        <span className="text-sm font-medium">{t("noProductsFound" as any)}</span>
                      </div>
                      <p className="text-sm text-yellow-700 mt-1">
                        {t("noProductsFoundHelp" as any)}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Product Name - Only show for new products */}
            {productType !== "existing-variation" && (
            <div className="space-y-2">
              <Label htmlFor="name">{`${t("productName" as any)} *`}</Label>
              <Input
                id="name"
                placeholder="e.g., Rainbow Unicorn Dress"
                value={formData.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
                onBlur={handleNameBlur}
                className={cn(
                  "rounded-xl border-gray-200 focus:border-pink-300 focus:ring-pink-200",
                  isDuplicateName ? "border-red-500 focus:border-red-500 ring-red-200" : "",
                  nameCheckLoading ? "opacity-70" : ""
                )}
                required
                disabled={isSubmitting}
              />
              {nameError && (
                <div className="mt-1 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 animate-in fade-in duration-200">
                  <strong>{nameError}</strong>
                </div>
              )}
            </div>
            )}

            {/* Category - Only show for new products */}
            {productType !== "existing-variation" && (
            <div className="space-y-2">
              <Label htmlFor="category">{`${t("category")} *`}</Label>
              <Select
                key={`category-select-${categories.length}`}
                value={formData.category_id}
                onValueChange={(value) => {
                  if (value === "add-new-category") {
                    setShowAddCategory(true)
                  } else {
                    handleInputChange("category_id", value)
                  }
                }}
                required
                disabled={isSubmitting}
              >
                <SelectTrigger className="rounded-xl border-gray-200 focus:border-pink-300 focus:ring-pink-200">
                  <SelectValue placeholder={t("selectCategory" as any)}>
                    {formData.category_id && categories.length > 0 && categories.find(cat => cat.id === formData.category_id)?.name}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                  <SelectItem value="add-new-category" className="text-pink-600 font-medium">
                    <Plus className="h-4 w-4 mr-2 inline" />
                    {t("addNewCategory" as any)}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            )}

            {/* Brand, Gender, Age Range Row - Only show for new products */}
            {productType !== "existing-variation" && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="brand">Brand (Optional)</Label>
                <Input
                  id="brand"
                  placeholder="e.g., Nike, Adidas, Local Brand"
                  value={formData.brand}
                  onChange={(e) => handleInputChange("brand", e.target.value)}
                  className="rounded-xl border-gray-200 focus:border-pink-300 focus:ring-pink-200"
                  disabled={isSubmitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="gender">{t("genderOptional" as any)}</Label>
                <Select value={formData.gender} onValueChange={(value) => handleInputChange("gender", value)} disabled={isSubmitting}>
                  <SelectTrigger className="rounded-xl border-gray-200 focus:border-pink-300 focus:ring-pink-200">
                    <SelectValue placeholder={t("selectGender" as any)} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unisex">{t("unisex" as any)}</SelectItem>
                    <SelectItem value="boys">{t("boys" as any)}</SelectItem>
                    <SelectItem value="girls">{t("girls" as any)}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="age">{t("ageRangeOptional" as any)}</Label>
                <Input
                  id="age"
                  placeholder={t("ageRangePlaceholder" as any)}
                  value={formData.age_range}
                  onChange={(e) => handleInputChange("age_range", e.target.value)}
                  className="rounded-xl border-gray-200 focus:border-pink-300 focus:ring-pink-200"
                  disabled={isSubmitting}
                />
              </div>
            </div>
            )}

            {/* Description - Only show for new products */}
            {productType !== "existing-variation" && (
            <div className="space-y-2">
              <Label htmlFor="description">{t("descriptionLabel" as any)}</Label>
              <Textarea
                id="description"
                placeholder={t("descriptionPlaceholder" as any)}
                value={formData.description}
                onChange={(e) => handleInputChange("description", e.target.value)}
                className="rounded-xl border-gray-200 focus:border-pink-300 focus:ring-pink-200 min-h-[100px]"
                rows={4}
                disabled={isSubmitting}
              />
            </div>
            )}

            {/* Product Type Specific Fields */}
            {productType === "uniform" ? (
              /* Uniform Product Fields */
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="color">{t("colorOptional" as any)}</Label>
                    <Select value={formData.color} onValueChange={(value) => handleColorSelect(value)} disabled={isSubmitting}>
                      <SelectTrigger className="rounded-xl border-gray-200 focus:border-pink-300 focus:ring-pink-200">
                        <SelectValue placeholder={t("selectColor" as any)}>
                          {formData.color && (
                            <div className="flex items-center space-x-2">
                              <div 
                                className={`w-5 h-5 rounded-full border border-gray-300 ${getColorClass(formData.color)}`}
                                style={getColorStyle(formData.color)}
                              />
                              <span className="capitalize text-sm">{formData.color.replace('-', ' ')}</span>
                            </div>
                          )}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className="w-72">
                        <div className="p-2">
                          <div className="text-sm font-medium text-gray-700 mb-2">Basic Colors</div>
                          <div className="grid grid-cols-6 gap-1.5 mb-3">
                            <SelectItem value="white" className="p-1 h-8 w-8 rounded-lg hover:bg-gray-100 transition-all duration-200">
                              <div className="w-6 h-6 rounded-full bg-white border border-gray-300 hover:scale-110 transition-transform duration-200" title="White" />
                            </SelectItem>
                            <SelectItem value="black" className="p-1 h-8 w-8 rounded-lg hover:bg-gray-100 transition-all duration-200">
                              <div className="w-6 h-6 rounded-full bg-black hover:scale-110 transition-transform duration-200" title="Black" />
                            </SelectItem>
                            <SelectItem value="gray" className="p-1 h-8 w-8 rounded-lg hover:bg-gray-100 transition-all duration-200">
                              <div className="w-6 h-6 rounded-full bg-gray-500 hover:scale-110 transition-transform duration-200" title="Gray" />
                            </SelectItem>
                            <SelectItem value="red" className="p-1 h-8 w-8 rounded-lg hover:bg-gray-100 transition-all duration-200">
                              <div className="w-6 h-6 rounded-full bg-red-500 hover:scale-110 transition-transform duration-200" title="Red" />
                            </SelectItem>
                            <SelectItem value="blue" className="p-1 h-8 w-8 rounded-lg hover:bg-gray-100 transition-all duration-200">
                              <div className="w-6 h-6 rounded-full bg-blue-500 hover:scale-110 transition-transform duration-200" title="Blue" />
                            </SelectItem>
                            <SelectItem value="green" className="p-1 h-8 w-8 rounded-lg hover:bg-gray-100 transition-all duration-200">
                              <div className="w-6 h-6 rounded-full bg-green-500 hover:scale-110 transition-transform duration-200" title="Green" />
                            </SelectItem>
                            <SelectItem value="yellow" className="p-1 h-8 w-8 rounded-lg hover:bg-gray-100 transition-all duration-200">
                              <div className="w-6 h-6 rounded-full bg-yellow-400 hover:scale-110 transition-transform duration-200" title="Yellow" />
                            </SelectItem>
                            <SelectItem value="orange" className="p-1 h-8 w-8 rounded-lg hover:bg-gray-100 transition-all duration-200">
                              <div className="w-6 h-6 rounded-full bg-orange-500 hover:scale-110 transition-transform duration-200" title="Orange" />
                            </SelectItem>
                            <SelectItem value="purple" className="p-1 h-8 w-8 rounded-lg hover:bg-gray-100 transition-all duration-200">
                              <div className="w-6 h-6 rounded-full bg-purple-500 hover:scale-110 transition-transform duration-200" title="Purple" />
                            </SelectItem>
                            <SelectItem value="brown" className="p-1 h-8 w-8 rounded-lg hover:bg-gray-100 transition-all duration-200">
                              <div className="w-6 h-6 rounded-full bg-amber-800 hover:scale-110 transition-transform duration-200" title="Brown" />
                            </SelectItem>
                          </div>
                          
                          <div className="text-sm font-medium text-gray-700 mb-2">Baby Colors</div>
                          <div className="grid grid-cols-6 gap-1.5">
                            <SelectItem value="baby-pink" className="p-1 h-8 w-8 rounded-lg hover:bg-gray-100 transition-all duration-200">
                              <div className="w-6 h-6 rounded-full bg-pink-200 hover:scale-110 transition-transform duration-200" title="Baby Pink" />
                            </SelectItem>
                            <SelectItem value="baby-blue" className="p-1 h-8 w-8 rounded-lg hover:bg-gray-100 transition-all duration-200">
                              <div className="w-6 h-6 rounded-full bg-blue-200 hover:scale-110 transition-transform duration-200" title="Baby Blue" />
                            </SelectItem>
                            <SelectItem value="baby-yellow" className="p-1 h-8 w-8 rounded-lg hover:bg-gray-100 transition-all duration-200">
                              <div className="w-6 h-6 rounded-full bg-yellow-200 hover:scale-110 transition-transform duration-200" title="Baby Yellow" />
                            </SelectItem>
                            <SelectItem value="baby-green" className="p-1 h-8 w-8 rounded-lg hover:bg-gray-100 transition-all duration-200">
                              <div className="w-6 h-6 rounded-full bg-green-200 hover:scale-110 transition-transform duration-200" title="Baby Green" />
                            </SelectItem>
                            <SelectItem value="baby-purple" className="p-1 h-8 w-8 rounded-lg hover:bg-gray-100 transition-all duration-200">
                              <div className="w-6 h-6 rounded-full bg-purple-200 hover:scale-110 transition-transform duration-200" title="Baby Purple" />
                            </SelectItem>
                            <SelectItem value="baby-peach" className="p-1 h-8 w-8 rounded-lg hover:bg-gray-100 transition-all duration-200">
                              <div className="w-6 h-6 rounded-full hover:scale-110 transition-transform duration-200" style={{ backgroundColor: '#FFCBA4' }} title="Baby Peach" />
                            </SelectItem>
                            <SelectItem value="baby-mint" className="p-1 h-8 w-8 rounded-lg hover:bg-gray-100 transition-all duration-200">
                              <div className="w-6 h-6 rounded-full hover:scale-110 transition-transform duration-200" style={{ backgroundColor: '#B8E6B8' }} title="Baby Mint" />
                            </SelectItem>
                            <SelectItem value="baby-lavender" className="p-1 h-8 w-8 rounded-lg hover:bg-gray-100 transition-all duration-200">
                              <div className="w-6 h-6 rounded-full hover:scale-110 transition-transform duration-200" style={{ backgroundColor: '#E6E6FA' }} title="Baby Lavender" />
                            </SelectItem>
                            <SelectItem value="cream" className="p-1 h-8 w-8 rounded-lg hover:bg-gray-100 transition-all duration-200">
                              <div className="w-6 h-6 rounded-full hover:scale-110 transition-transform duration-200" style={{ backgroundColor: '#FFFDD0' }} title="Cream" />
                            </SelectItem>
                            <SelectItem value="ivory" className="p-1 h-8 w-8 rounded-lg hover:bg-gray-100 transition-all duration-200">
                              <div className="w-6 h-6 rounded-full hover:scale-110 transition-transform duration-200" style={{ backgroundColor: '#FFFFF0' }} title="Ivory" />
                            </SelectItem>
                            <SelectItem value="beige" className="p-1 h-8 w-8 rounded-lg hover:bg-gray-100 transition-all duration-200">
                              <div className="w-6 h-6 rounded-full hover:scale-110 transition-transform duration-200" style={{ backgroundColor: '#F5F5DC' }} title="Beige" />
                            </SelectItem>
                            <SelectItem value="coral" className="p-1 h-8 w-8 rounded-lg hover:bg-gray-100 transition-all duration-200">
                              <div className="w-6 h-6 rounded-full hover:scale-110 transition-transform duration-200" style={{ backgroundColor: '#FF7F50' }} title="Coral" />
                            </SelectItem>
                            <SelectItem value="turquoise" className="p-1 h-8 w-8 rounded-lg hover:bg-gray-100 transition-all duration-200">
                              <div className="w-6 h-6 rounded-full hover:scale-110 transition-transform duration-200" style={{ backgroundColor: '#40E0D0' }} title="Turquoise" />
                            </SelectItem>
                            <SelectItem value="lilac" className="p-1 h-8 w-8 rounded-lg hover:bg-gray-100 transition-all duration-200">
                              <div className="w-6 h-6 rounded-full hover:scale-110 transition-transform duration-200" style={{ backgroundColor: '#C8A2C8' }} title="Lilac" />
                            </SelectItem>
                            <SelectItem value="sage" className="p-1 h-8 w-8 rounded-lg hover:bg-gray-100 transition-all duration-200">
                              <div className="w-6 h-6 rounded-full hover:scale-110 transition-transform duration-200" style={{ backgroundColor: '#9CAF88' }} title="Sage" />
                            </SelectItem>
                          </div>
                        </div>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="size">{t("sizeOptional" as any)}</Label>
                    <Select value={formData.size} onValueChange={(value) => handleInputChange("size", value)} disabled={isSubmitting}>
                      <SelectTrigger className="rounded-xl border-gray-200 focus:border-pink-300 focus:ring-pink-200">
                        <SelectValue placeholder={t("selectSize" as any)} />
                      </SelectTrigger>
                      <SelectContent>
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

                  <div className="space-y-2">
                    <Label htmlFor="quantity">{t("initialStockQuantity" as any)} *</Label>
                    <Input
                      id="quantity"
                      type="number"
                      min="0"
                      placeholder={t("enterInitialStockQuantity" as any)}
                      value={formData.initial_quantity}
                      onChange={(e) => handleInputChange("initial_quantity", e.target.value)}
                      className="rounded-xl border-gray-200 focus:border-pink-300 focus:ring-pink-200"
                      required
                      disabled={isSubmitting}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="price">{t("sellingPriceOptional" as any)} (ብር)</Label>
                    <Input
                      id="price"
                      type="number"
                      step="0.01"
                      placeholder="29.99"
                      value={formData.price}
                      onChange={(e) => handleInputChange("price", e.target.value)}
                      className="rounded-xl border-gray-200 focus:border-pink-300 focus:ring-pink-200"
                      disabled={isSubmitting}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="purchase_price">{t("purchasePriceOptional" as any)} (ብር)</Label>
                    <Input
                      id="purchase_price"
                      type="number"
                      step="0.01"
                      placeholder="15.99"
                      value={formData.purchase_price}
                      onChange={(e) => handleInputChange("purchase_price", e.target.value)}
                      className="rounded-xl border-gray-200 focus:border-pink-300 focus:ring-pink-200"
                      disabled={isSubmitting}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="min_stock_level">{t("minimumStockLevelOptional" as any)}</Label>
                    <Input
                      id="min_stock_level"
                      type="number"
                      min="0"
                      placeholder={t("enterMinimumStockLevel" as any)}
                      value={formData.min_stock_level}
                      onChange={(e) => handleInputChange("min_stock_level", e.target.value)}
                      className="rounded-xl border-gray-200 focus:border-pink-300 focus:ring-pink-200"
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="max_stock_level">{t("maximumStockLevelOptional" as any)}</Label>
                    <Input
                      id="max_stock_level"
                      type="number"
                      min="0"
                      placeholder={t("enterMaximumStockLevel" as any)}
                      value={formData.max_stock_level}
                      onChange={(e) => handleInputChange("max_stock_level", e.target.value)}
                      className="rounded-xl border-gray-200 focus:border-pink-300 focus:ring-pink-200"
                      disabled={isSubmitting}
                    />
                  </div>
                </div>
              </div>
            ) : (
              /* Variation Product Fields */
              <div className="space-y-6">
                <VariationBuilder 
                  variations={variations}
                  onVariationsChange={setVariations}
                />
              </div>
            )}

            {/* Image Upload */}
            <div className="space-y-2">
              <Label htmlFor="image">{t("productImageOptional" as any)}</Label>
              <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-pink-300 transition-all duration-200 hover:bg-pink-50 group">
                <input id="image" type="file" accept="image/*" onChange={handleImageChange} className="hidden" disabled={isSubmitting} />
                <label htmlFor="image" className="cursor-pointer block">
                  <div className="w-16 h-16 bg-gradient-to-r from-pink-100 to-purple-100 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:from-pink-200 group-hover:to-purple-200 transition-colors">
                    <Upload className="h-8 w-8 text-pink-500" />
                  </div>
                  <p className="text-sm font-medium text-gray-700 mb-1">
                    {formData.image ? formData.image.name : t("clickToUpload" as any)}
                  </p>
                  <p className="text-xs text-gray-500">{t("fileHint" as any)}</p>
                </label>
              </div>
            </div>

            {/* Submit Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t border-gray-100">
              <Button
                type="submit"
                className="flex-1 bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white rounded-xl py-3 font-medium transition-all duration-200 shadow-lg hover:shadow-xl"
                disabled={
                  isSubmitting || 
                  (productType === "existing-variation" && !selectedExistingProduct)
                }
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {productType === "existing-variation" ? t("addingVariations" as any) : t("addingToInventory" as any)}
                  </>
                ) : (
                  <>
                    <Package className="h-4 w-4 mr-2" />
                    {productType === "existing-variation" 
                      ? (selectedExistingProduct ? t("addVariationsToProduct" as any) : t("selectProductFirst" as any))
                      : t("addToInventory" as any)
                    }
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="flex-1 rounded-xl border-gray-200 hover:bg-gray-50 bg-transparent py-3"
                onClick={() => {
                  setFormData({
                    name: "",
                    category_id: "",
                    customCategory: "",
                    description: "",
                    brand: "",
                    age_range: "",
                    gender: "",
                    image: null,
                    color: "",
                    size: "",
                    price: "",
                    purchase_price: "",
                    initial_quantity: "",
                    min_stock_level: "",
                    max_stock_level: "",
                  })
                  setVariations([])
                  setProductType("uniform")
                  setSelectedExistingProduct(null)
                  setExistingProductSearch("")
                  setExistingProducts([])
                  setExistingVariations([])
                }}
                disabled={isSubmitting}
              >
                {t("clearForm" as any)}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Add Category Dialog */}
      <Dialog open={showAddCategory} onOpenChange={setShowAddCategory}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Category</DialogTitle>
            <DialogDescription>Enter a new category name. It will be available for future products.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Category name"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              className="rounded-xl border-gray-200 focus:border-pink-300 focus:ring-pink-200"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddCategory(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddCategory} disabled={!newCategory.trim()}>
              Add Category
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <AlertDialogTitle className="text-xl text-red-800">
                  Delete Product
                </AlertDialogTitle>
                <p className="text-sm text-red-600 font-medium">
                  {lastAddedProduct?.name}
                </p>
              </div>
            </div>
            <AlertDialogDescription className="text-left space-y-3">
              <p className="text-gray-700">
                Are you sure you want to <strong>permanently delete</strong> this product?
              </p>
              
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-2">
                <p className="text-sm font-medium text-red-800">This will permanently remove:</p>
                <ul className="text-sm text-red-700 space-y-1 ml-4">
                  <li>• All product data from database</li>
                  <li>• {lastAddedProduct?.product_type === 'variation' ? `${lastAddedProduct?.variations?.length || 0} variations` : 'Product details'} and inventory records</li>
                  <li>• Sales and transfer history</li>
                  <li>• Stock movements and tracking</li>
                </ul>
                <p className="text-xs text-red-600 font-medium mt-2">
                  ⚠️ This action CANNOT be undone!
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel 
              onClick={() => setIsDeleteConfirmOpen(false)}
              className="w-full sm:w-auto order-2 sm:order-1"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                try {
                  const response = await apiClient.deleteProduct(lastAddedProduct.id, true)
                  
                  if (response.success) {
                    toast({
                      title: "Product Permanently Deleted",
                      description: `${lastAddedProduct.name} has been completely removed from the database.`,
                    })
                    setLastAddedProduct(null)
                  } else {
                    toast({
                      title: "Error",
                      description: response.error || "Failed to delete product",
                      variant: "destructive",
                    })
                  }
                } catch (error: any) {
                  console.error("Delete product error:", error)
                  toast({
                    title: "Error",
                    description: error.message || "Failed to delete product",
                    variant: "destructive",
                  })
                } finally {
                  setIsDeleteConfirmOpen(false)
                }
              }}
              className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white order-1 sm:order-2"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
