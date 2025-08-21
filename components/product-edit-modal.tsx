"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Package } from "lucide-react"
import apiClient from "@/lib/api-client"
import { useToast } from "@/hooks/use-toast"

interface Product {
  id: string
  name: string
  sku: string
  category_id: string
  category_name: string
  color?: string
  size?: string
  price: number
  cost_price?: number
  purchase_price?: number
  description?: string
  image_url?: string
  barcode?: string
  brand?: string
  age_range?: string
  gender?: string
  total_stock: number
  branch_count: number
}

interface ProductEditModalProps {
  product: Product | null
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  scope?: 'product' | 'variation'
  variation?: { variation_id: string; color?: string; size?: string; price?: number; purchase_price?: number } | null
}

export function ProductEditModal({ product, isOpen, onClose, onSuccess, scope = 'product', variation = null }: ProductEditModalProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([])
  const [variationId, setVariationId] = useState<string | null>(null)
  const [prefillBranchId, setPrefillBranchId] = useState<string | null>(null)
  const [prefillQuantity, setPrefillQuantity] = useState<number | null>(null)
  
  // Form state
  const [formData, setFormData] = useState({
    name: "",
    category_id: "",
    color: "",
    size: "",
    price: "",
    purchase_price: "",
    min_stock_level: "",
    max_stock_level: "",
    quantity: "",
    description: "",
    image_url: "",
    barcode: "",
    brand: "",
    age_range: "",
    gender: "",
  })

  const { toast } = useToast()

  useEffect(() => {
    if (product && isOpen) {
      setFormData({
        name: product.name,
        category_id: product.category_id,
        color: scope === 'variation' ? (variation?.color || '') : (product.color || ''),
        size: scope === 'variation' ? (variation?.size || '') : (product.size || ''),
        price: scope === 'variation' ? String(variation?.price ?? '') : product.price.toString(),
        purchase_price: scope === 'variation' ? String(variation?.purchase_price ?? '') : (product.purchase_price?.toString() || ""),
        min_stock_level: "",
        max_stock_level: "",
        quantity: "",
        description: product.description || "",
        image_url: product.image_url || "",
        barcode: product.barcode || "",
        brand: product.brand || "",
        age_range: product.age_range || "",
        gender: product.gender || "",
      })

      // Prefill fields and capture variation id
      ;(async () => {
        try {
          if (scope === 'variation' && variation?.variation_id) {
            // Use the exact variation that was clicked
            setVariationId(variation.variation_id)
            const res = await apiClient.getInventory({ product_id: product.id, variation_id: variation.variation_id, limit: 1 })
            if (res.success && Array.isArray(res.data) && res.data.length > 0) {
              const row = res.data[0] as {
                branch_id: string
                quantity: number
                color?: string
                size?: string
                price?: number
                purchase_price?: number
                min_stock_level?: number
                max_stock_level?: number
              }
              setPrefillBranchId(row.branch_id || null)
              setPrefillQuantity(typeof row.quantity === 'number' ? row.quantity : null)
              setFormData(prev => ({
                ...prev,
                color: prev.color || row.color || '',
                size: prev.size || row.size || '',
                price: prev.price || (row.price != null ? String(row.price) : ''),
                purchase_price: prev.purchase_price || (row.purchase_price != null ? String(row.purchase_price) : ''),
                min_stock_level: row.min_stock_level != null ? String(row.min_stock_level) : prev.min_stock_level,
                max_stock_level: row.max_stock_level != null ? String(row.max_stock_level) : prev.max_stock_level,
                quantity: row.quantity != null ? String(row.quantity) : prev.quantity,
              }))
              try { await apiClient.getVariation(product.id, variation.variation_id) } catch {}
            }
          } else {
            // Product scope: prefill inventory-related info (not editable in UI here)
            const res = await apiClient.getInventory({ product_id: product.id, limit: 1 })
            if (res.success && Array.isArray(res.data) && res.data.length > 0) {
              const first = res.data[0] as {
                variation_id?: string
                branch_id: string
                quantity: number
                min_stock_level?: number
                max_stock_level?: number
              }
              const resolvedVariationId = first.variation_id || null
              setVariationId(resolvedVariationId)
              setPrefillBranchId(first.branch_id || null)
              setPrefillQuantity(typeof first.quantity === 'number' ? first.quantity : null)
              setFormData(prev => ({
                ...prev,
                min_stock_level: first.min_stock_level != null ? String(first.min_stock_level) : prev.min_stock_level,
                max_stock_level: first.max_stock_level != null ? String(first.max_stock_level) : prev.max_stock_level,
                quantity: first.quantity != null ? String(first.quantity) : prev.quantity,
              }))
            }
          }
        } catch (e) {
          console.error('Failed to prefill variation data', e)
        }
      })()
    }
  }, [product, isOpen, scope, variation])

  useEffect(() => {
    if (isOpen) {
      fetchCategories()
    }
  }, [isOpen])

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

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  // Helper functions for color display (match add product UI)
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!product) return

    setIsLoading(true)

    try {
      if (scope === 'product') {
        // Update product-level fields only
        const productUpdate = {
          name: formData.name,
          category_id: formData.category_id || undefined,
          description: formData.description || undefined,
          image_url: formData.image_url || undefined,
          barcode: formData.barcode || undefined,
          brand: formData.brand || undefined,
          age_range: formData.age_range || undefined,
          gender: formData.gender || undefined,
        }

        const response = await apiClient.updateProduct(product.id, productUpdate)
        if (response.success) {
          toast({ title: 'Success', description: 'Product updated successfully!' })
          onSuccess(); onClose()
        } else {
          toast({
            title: "Error",
            description: response.error || "Failed to update product",
            variant: "destructive",
          })
        }
      } else if (scope === 'variation' && variationId) {
        // Update variation-level fields only
        const variationPayload: Record<string, string | number> = {}
        if (formData.color) variationPayload.color = formData.color
        if (formData.size) variationPayload.size = formData.size
        if (formData.price !== "") variationPayload.price = parseFloat(formData.price)
        if (formData.purchase_price !== "") variationPayload.purchase_price = parseFloat(formData.purchase_price)
        if (formData.min_stock_level !== "") variationPayload.min_stock_level = parseInt(formData.min_stock_level)
        if (formData.max_stock_level !== "") variationPayload.max_stock_level = parseInt(formData.max_stock_level)

        // Update inventory quantity if provided
        if (formData.quantity !== "" && prefillBranchId) {
          await apiClient.updateInventory({
            product_id: product.id,
            variation_id: variationId,
            branch_id: prefillBranchId,
            quantity: parseInt(formData.quantity),
            min_stock_level: variationPayload.min_stock_level,
            max_stock_level: variationPayload.max_stock_level,
          })
        }

        if (Object.keys(variationPayload).length > 0) {
          try {
            await apiClient.updateVariation(product.id, variationId, variationPayload)
            toast({ title: 'Success', description: 'Variation updated successfully!' })
            onSuccess(); onClose()
          } catch (err) {
            // Fallback: if variation update failed (e.g., 404), update inventory min/max directly
            if (prefillBranchId && prefillQuantity !== null && (variationPayload.min_stock_level !== undefined || variationPayload.max_stock_level !== undefined)) {
              await apiClient.updateInventory({
                product_id: product.id,
                variation_id: variationId,
                branch_id: prefillBranchId,
                quantity: prefillQuantity,
                min_stock_level: variationPayload.min_stock_level,
                max_stock_level: variationPayload.max_stock_level,
              })
              toast({ title: 'Success', description: 'Variation updated successfully!' })
              onSuccess(); onClose()
            } else {
              throw err
            }
          }
        } else {
          toast({ title: 'Success', description: 'Variation updated successfully!' })
          onSuccess(); onClose()
        }
      }
    } catch (error) {
      console.error("Update error:", error)
      toast({
        title: "Error",
        description: (error as Error)?.message || "Failed to update",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  if (!product) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Package className="h-5 w-5 text-pink-500" />
            <span>{scope === 'product' ? 'Edit Product' : 'Edit Variation'}: {product.name}</span>
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Product Information Section */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Package className="h-4 w-4 text-pink-500" />
              <h3 className="text-lg font-semibold">Product Information</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Product Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleInputChange("name", e.target.value)}
                  className="rounded-xl border-gray-200 focus:border-pink-300 focus:ring-pink-200"
                  required
                  disabled={scope === 'variation'}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Category *</Label>
                <Select value={formData.category_id} onValueChange={(value) => handleInputChange("category_id", value)} disabled={scope === 'variation'}>
                  <SelectTrigger className="rounded-xl border-gray-200 focus:border-pink-300 focus:ring-pink-200">
                    <SelectValue placeholder="Select category">
                      {formData.category_id && categories.length > 0 && categories.find(cat => cat.id === formData.category_id)?.name}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="size">Size *</Label>
                <Select value={formData.size} onValueChange={(value) => handleInputChange("size", value)} disabled={scope === 'product'}>
                  <SelectTrigger className="rounded-xl border-gray-200 focus:border-pink-300 focus:ring-pink-200">
                    <SelectValue placeholder="Select size" />
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
                <Label htmlFor="color">Color *</Label>
                <Select value={formData.color} onValueChange={(value) => handleInputChange("color", value)} disabled={scope === 'product'}>
                  <SelectTrigger className="rounded-xl border-gray-200 focus:border-pink-300 focus:ring-pink-200">
                    <SelectValue placeholder="Select color">
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
                          <div className="w-6 h-6 rounded-full" style={{ backgroundColor: '#FFCBA4' }} title="Baby Peach" />
                        </SelectItem>
                        <SelectItem value="baby-mint" className="p-1 h-8 w-8 rounded-lg hover:bg-gray-100 transition-all duration-200">
                          <div className="w-6 h-6 rounded-full" style={{ backgroundColor: '#B8E6B8' }} title="Baby Mint" />
                        </SelectItem>
                        <SelectItem value="baby-lavender" className="p-1 h-8 w-8 rounded-lg hover:bg-gray-100 transition-all duration-200">
                          <div className="w-6 h-6 rounded-full" style={{ backgroundColor: '#E6E6FA' }} title="Baby Lavender" />
                        </SelectItem>
                        <SelectItem value="cream" className="p-1 h-8 w-8 rounded-lg hover:bg-gray-100 transition-all duration-200">
                          <div className="w-6 h-6 rounded-full" style={{ backgroundColor: '#FFFDD0' }} title="Cream" />
                        </SelectItem>
                        <SelectItem value="ivory" className="p-1 h-8 w-8 rounded-lg hover:bg-gray-100 transition-all duration-200">
                          <div className="w-6 h-6 rounded-full" style={{ backgroundColor: '#FFFFF0' }} title="Ivory" />
                        </SelectItem>
                        <SelectItem value="beige" className="p-1 h-8 w-8 rounded-lg hover:bg-gray-100 transition-all duration-200">
                          <div className="w-6 h-6 rounded-full" style={{ backgroundColor: '#F5F5DC' }} title="Beige" />
                        </SelectItem>
                        <SelectItem value="coral" className="p-1 h-8 w-8 rounded-lg hover:bg-gray-100 transition-all duration-200">
                          <div className="w-6 h-6 rounded-full" style={{ backgroundColor: '#FF7F50' }} title="Coral" />
                        </SelectItem>
                        <SelectItem value="turquoise" className="p-1 h-8 w-8 rounded-lg hover:bg-gray-100 transition-all duration-200">
                          <div className="w-6 h-6 rounded-full" style={{ backgroundColor: '#40E0D0' }} title="Turquoise" />
                        </SelectItem>
                        <SelectItem value="lilac" className="p-1 h-8 w-8 rounded-lg hover:bg-gray-100 transition-all duration-200">
                          <div className="w-6 h-6 rounded-full" style={{ backgroundColor: '#C8A2C8' }} title="Lilac" />
                        </SelectItem>
                        <SelectItem value="sage" className="p-1 h-8 w-8 rounded-lg hover:bg-gray-100 transition-all duration-200">
                          <div className="w-6 h-6 rounded-full" style={{ backgroundColor: '#9CAF88' }} title="Sage" />
                        </SelectItem>
                      </div>
                    </div>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="price">Selling Price (ብር) *</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => handleInputChange("price", e.target.value)}
                  className="rounded-xl border-gray-200 focus:border-pink-300 focus:ring-pink-200"
                  required={scope === 'variation'}
                  disabled={scope === 'product'}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="purchase_price">Purchase Price (ብር)</Label>
                <Input
                  id="purchase_price"
                  type="number"
                  step="0.01"
                  value={formData.purchase_price}
                  onChange={(e) => handleInputChange("purchase_price", e.target.value)}
                  className="rounded-xl border-gray-200 focus:border-pink-300 focus:ring-pink-200"
                  disabled={scope === 'product'}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="age_range">Age Range</Label>
                <Input
                  id="age_range"
                  value={formData.age_range}
                  onChange={(e) => handleInputChange("age_range", e.target.value)}
                  className="rounded-xl border-gray-200 focus:border-pink-300 focus:ring-pink-200"
                  placeholder="e.g., 2-4 years, 6+ months"
                  disabled={scope === 'variation'}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="quantity">Initial Stock Quantity</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="0"
                  value={formData.quantity}
                  onChange={(e) => handleInputChange("quantity", e.target.value)}
                  className="rounded-xl border-gray-200 focus:border-pink-300 focus:ring-pink-200"
                  disabled={scope === 'product'}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="min_stock_level">Min Stock Level</Label>
                <Input
                  id="min_stock_level"
                  type="number"
                  min="0"
                  value={formData.min_stock_level}
                  onChange={(e) => handleInputChange("min_stock_level", e.target.value)}
                  className="rounded-xl border-gray-200 focus:border-pink-300 focus:ring-pink-200"
                  disabled={scope === 'product'}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="max_stock_level">Max Stock Level</Label>
                <Input
                  id="max_stock_level"
                  type="number"
                  min="0"
                  value={formData.max_stock_level}
                  onChange={(e) => handleInputChange("max_stock_level", e.target.value)}
                  className="rounded-xl border-gray-200 focus:border-pink-300 focus:ring-pink-200"
                  disabled={scope === 'product'}
                />
              </div>
            </div>

            {/* Row: Gender, SKU, Brand (3 fields) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="gender">Gender</Label>
                <Select value={formData.gender} onValueChange={(value) => handleInputChange("gender", value)} disabled={scope === 'variation'}>
                  <SelectTrigger className="rounded-xl border-gray-200 focus:border-pink-300 focus:ring-pink-200">
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unisex">Unisex</SelectItem>
                    <SelectItem value="boys">Boys</SelectItem>
                    <SelectItem value="girls">Girls</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sku">SKU</Label>
                <Input
                  id="sku"
                  value={product.sku}
                  className="rounded-xl border-gray-200 bg-gray-50"
                  disabled
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="brand">Brand</Label>
                <Input
                  id="brand"
                  value={formData.brand}
                  onChange={(e) => handleInputChange("brand", e.target.value)}
                  className="rounded-xl border-gray-200 focus:border-pink-300 focus:ring-pink-200"
                  placeholder="e.g., Nike, Adidas, Local Brand"
                  disabled={scope === 'variation'}
                />
              </div>
            </div>

            {/* Removed old Brand/SKU row; now included above */}

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleInputChange("description", e.target.value)}
                className="rounded-xl border-gray-200 focus:border-pink-300 focus:ring-pink-200"
                rows={2}
                placeholder="Describe the product features, materials, care instructions..."
                disabled={scope === 'variation'}
              />
            </div>
          </div>

          {/* Inventory Management removed in edit modal */}
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit}
            className="bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Updating...
              </>
            ) : (
                (scope === 'product' ? 'Update Product' : 'Update Variation')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
} 