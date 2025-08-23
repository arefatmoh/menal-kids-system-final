"use client"

import { useState } from "react"
import apiClient from "@/lib/api-client"
import { useToast } from "@/hooks/use-toast"
import { TableCell, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { 
  ChevronDown, 
  ChevronRight, 
  Tag, 
  Star, 
  Package,
  Edit,
  ShoppingBag,
  Trash2
} from "lucide-react"

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
  variations: Variation[]
}

interface ExpandableProductRowProps {
  product: ProductWithVariations
  isSelected: boolean
  onSelect: (productId: string, checked: boolean) => void
  onEditProduct: (product: ProductWithVariations) => void
  onEditVariation: (productId: string, variation: Variation) => void
  onDeleteProduct: (product: ProductWithVariations) => void
  onSellProduct: (productId: string) => void
  getStatusBadge: (status: string) => React.ReactNode
  getColorClass: (color: string) => string
  getColorStyle: (color: string) => React.CSSProperties
  showBranchColumn?: boolean
  disableActions?: boolean
  onRefresh?: () => void
}

export function ExpandableProductRow({
  product,
  isSelected,
  onSelect,
  onEditProduct,
  onEditVariation,
  onDeleteProduct,
  onSellProduct,
  getStatusBadge,
  getColorClass,
  getColorStyle,
  showBranchColumn = false,
  disableActions = false,
  onRefresh
}: ExpandableProductRowProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const { toast } = useToast()
  const isEvenRow = product.product_id.length % 2 === 0; // Simple zebra striping
  const [confirmProductOpen, setConfirmProductOpen] = useState(false)
  const [confirmVariation, setConfirmVariation] = useState<Variation | null>(null)

  const totalStock = product.variations.reduce((sum, v) => sum + v.quantity, 0)

  const toggleExpansion = () => {
    setIsExpanded(!isExpanded)
  }

  const handleRowClick = (e: React.MouseEvent) => {
    // Don't expand if clicking on interactive elements
    const target = e.target as HTMLElement
    if (
      target.closest('button') || 
      target.closest('input') || 
      target.closest('[role="button"]') ||
      target.closest('.no-expand')
    ) {
      return
    }
    
    // Only allow expansion for variation products
    if (product.product_type === 'variation') {
      toggleExpansion()
    }
  }

  const handleVariationEdit = (variation: Variation) => {
    onEditVariation(product.product_id, variation)
  }

  const executeVariationDelete = async (variation: Variation) => {
    try {
      const res = await apiClient.deleteVariation(product.product_id, variation.variation_id)
      if ((res as { success?: boolean; error?: string }).success) {
        toast({ title: "Variation Deleted", description: "The variation was removed successfully." })
        // Soft refresh by collapsing row; actual data refresh handled by parent via props pattern
        setIsExpanded(false)
        if (onRefresh) onRefresh()
      } else {
        const message = (res as { error?: string }).error || "Failed to delete variation"
        toast({ title: "Error", description: message, variant: "destructive" })
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to delete variation"
      toast({ title: "Error", description: message, variant: "destructive" })
    }
  }

  const handleVariationSell = () => {
    // For now, sell the whole product. In the future, we could add variation-specific selling
    onSellProduct(product.product_id)
  }

  const isVariationProduct = product.product_type === 'variation'
  const isUniformProduct = product.product_type === 'uniform'

  return (
    <>
      {/* Main Product Row */}
      <TableRow 
        className={`group transition-all duration-200 hover:bg-gradient-to-r hover:from-pink-50 hover:to-purple-50 border-b border-gray-200 ${isEvenRow ? 'bg-white' : 'bg-gray-50/30'} ${isVariationProduct ? 'cursor-pointer' : ''}`}
        onClick={handleRowClick}
      >
        <TableCell className="pl-6 no-expand">
          <Checkbox
            checked={isSelected}
            onCheckedChange={(checked) => onSelect(product.product_id, checked as boolean)}
            aria-label={`Select ${product.product_name}`}
            className="h-[18px] w-[18px] rounded-md transition-all duration-200 border-gray-300 shadow-sm hover:border-pink-400 focus:ring-pink-500 data-[state=checked]:bg-pink-500 data-[state=checked]:border-pink-500"
          />
        </TableCell>
        
        <TableCell className="py-3">
          <div className="space-y-2">
            {/* Product Name with Expand/Collapse Icon */}
            <div className="flex items-center space-x-2">
              {isVariationProduct && (
                <button
                  onClick={toggleExpansion}
                  className="p-1 hover:bg-gray-100 rounded-md transition-colors duration-200 no-expand"
                  title={isExpanded ? "Collapse variations" : "Expand variations"}
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-gray-600" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-gray-600" />
                  )}
                </button>
              )}
              <h3 className="font-semibold text-gray-900 text-sm leading-tight">
                {product.product_name}
              </h3>
              {isVariationProduct && (
                <Badge variant="outline" className="text-xs bg-purple-50 text-purple-600 border-purple-200">
                  <Package className="h-3 w-3 mr-1" />
                  {product.variations.length} variations
                </Badge>
              )}
            </div>
            
            {/* Product SKU */}
            <div className="flex items-center space-x-1">
              <span className="text-xs font-medium text-gray-400">SKU:</span>
              <span className="text-xs font-mono text-gray-600 bg-gray-50 px-1.5 py-0.5 rounded">
                {product.product_sku}
              </span>
            </div>
            
            {/* Category */}
            <div className="flex items-center space-x-1">
              <Tag className="h-3 w-3 text-blue-500" />
              <span className="text-xs text-gray-600">{product.category_name}</span>
            </div>
          </div>
        </TableCell>

        <TableCell className="py-3">
          <div className="space-y-2">
            {/* Product Type Indicator - Only for variation products */}
            {isVariationProduct && (
              <div className="flex items-center space-x-1">
                <Package className="h-3 w-3 text-purple-500" />
                <span className="text-xs text-gray-600 capitalize">
                  Variation Product
                </span>
              </div>
            )}
            
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

            {/* For uniform products, show color and size from the single variation */}
            {isUniformProduct && product.variations[0] && (
              <div className="flex items-center space-x-2">
                {product.variations[0].color && (
                  <div className="flex items-center space-x-1">
                    <div 
                      className={`w-4 h-4 rounded-full border border-gray-300 ${getColorClass(product.variations[0].color)}`}
                      style={getColorStyle(product.variations[0].color)}
                      title={product.variations[0].color.replace('-', ' ')}
                    />
                    <span className="text-xs text-gray-600 capitalize">{product.variations[0].color.replace('-', ' ')}</span>
                  </div>
                )}
                {product.variations[0].size && (
                  <>
                    <span className="text-gray-300">•</span>
                    <span className="text-xs text-gray-600 font-medium">{product.variations[0].size}</span>
                  </>
                )}
              </div>
            )}
          </div>
        </TableCell>

        <TableCell className="py-3">
          <div className="text-center space-y-1">
            {isUniformProduct ? (
              <>
                <div className="flex items-center justify-center space-x-1">
                  <span className="text-lg font-bold text-blue-700">{product.variations[0].quantity}</span>
                  <span className="text-xs font-medium text-blue-600">pieces</span>
                </div>
                <div className="flex items-center justify-center space-x-2 text-xs text-gray-500">
                  <span>Min: {product.variations[0].min_stock_level}</span>
                  <span className="text-gray-300">•</span>
                  <span>Max: {product.variations[0].max_stock_level}</span>
                </div>
              </>
            ) : (
              <div className="text-center">
                <div className="flex items-center justify-center space-x-1">
                  <span className="text-lg font-bold text-blue-700">{totalStock}</span>
                  <span className="text-xs font-medium text-blue-600">pieces</span>
                </div>
                <div className="text-xs text-gray-500">
                  {product.variations.length} variation{product.variations.length !== 1 ? 's' : ''}
                </div>
              </div>
            )}
          </div>
        </TableCell>

        <TableCell className="py-3">
          <div className="flex justify-center">
            {isUniformProduct ? (
              getStatusBadge(product.variations[0].stock_status)
            ) : (
              <span className="text-xs text-gray-500">Expand to view</span>
            )}
          </div>
        </TableCell>

        {showBranchColumn && (
          <TableCell className="py-3">
            <div className="text-center">
              <span className="text-xs text-gray-600">{product.variations[0]?.branch_name || 'N/A'}</span>
            </div>
          </TableCell>
        )}

        <TableCell className="py-3">
          <div className="text-center space-y-1">
            {isUniformProduct ? (
              <>
                <p className="text-lg font-bold text-green-700">{Number(product.variations[0].price).toFixed(0)} ብር</p>
                {product.variations[0].purchase_price && (
                  <p className="text-[10px] text-gray-400 leading-tight">
                    Purchase: {Number(product.variations[0].purchase_price).toFixed(0)} ብር
                  </p>
                )}
                {product.variations[0].cost_price && (
                  <p className="text-xs text-green-500 font-medium">
                    Margin: {Number(product.variations[0].price) > 0 ? (((Number(product.variations[0].price) - Number(product.variations[0].cost_price)) / Number(product.variations[0].price)) * 100).toFixed(1) : '0.0'}%
                  </p>
                )}
              </>
            ) : (
              <span className="text-xs text-gray-500">Individual prices below</span>
            )}
          </div>
        </TableCell>

        <TableCell className="py-3 no-expand">
          <div className="flex items-center justify-center space-x-1">
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => onEditProduct(product)}
              title="Edit Product"
              className="h-6 w-6 p-0 border-blue-200 text-blue-600 hover:bg-blue-50 hover:border-blue-300 transition-all duration-200"
              disabled={disableActions}
            >
              <Edit className="h-3 w-3" />
            </Button>
            {isUniformProduct && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => onSellProduct(product.product_id)}
                title="Sell Product"
                className="h-6 w-6 p-0 bg-green-100 text-green-600 hover:bg-green-200 border-green-200 transition-all duration-200"
                disabled={disableActions}
              >
                <ShoppingBag className="h-3 w-3" />
              </Button>
            )}
              <Button
              size="sm"
              variant="destructive"
                onClick={() => setConfirmProductOpen(true)}
              title="Delete Product"
              className="h-6 w-6 p-0 bg-red-100 text-red-600 hover:bg-red-200 border-red-200 transition-all duration-200"
              disabled={disableActions}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </TableCell>
      </TableRow>

      {/* Expanded Variations - Only show for variation products when expanded */}
      {isVariationProduct && isExpanded && product.variations.map((variation, index) => (
        <TableRow 
          key={variation.variation_id} 
          className={`border-b border-gray-200 ${(index % 2 === 0) ? 'bg-gray-50/50' : 'bg-white'}`}
        >
          {/* Empty first column - no checkbox needed for variations */}
          <TableCell className="pl-6">
            {/* Empty - variations share the same product name */}
          </TableCell>
          
          {/* Empty second column - no details needed for variations */}
          <TableCell className="py-2">
            {/* Empty - variations share the same product details */}
          </TableCell>
          
          <TableCell className="py-2 pl-4">
            <div className="space-y-1">
              {/* Variation SKU */}
              <div className="flex items-center space-x-1">
                <span className="text-xs font-medium text-gray-400">SKU:</span>
                <span className="text-xs font-mono text-gray-600 bg-gray-50 px-1.5 py-0.5 rounded">
                  {variation.variation_sku}
                </span>
              </div>
              
              {/* Color and Size */}
              <div className="flex items-center space-x-2">
                {variation.color && (
                  <div className="flex items-center space-x-1">
                    <div 
                      className={`w-3 h-3 rounded-full border border-gray-300 ${getColorClass(variation.color)}`}
                      style={getColorStyle(variation.color)}
                      title={variation.color.replace('-', ' ')}
                    />
                    <span className="text-xs text-gray-600 capitalize">{variation.color.replace('-', ' ')}</span>
                  </div>
                )}
                {variation.size && (
                  <>
                    <span className="text-gray-300">•</span>
                    <span className="text-xs text-gray-600 font-medium">{variation.size}</span>
                  </>
                )}
              </div>
            </div>
          </TableCell>

          <TableCell className="py-2">
            <div className="text-center space-y-1">
              <div className="flex items-center justify-center space-x-1">
                <span className="text-lg font-bold text-blue-700">{variation.quantity}</span>
                <span className="text-xs font-medium text-blue-600">pieces</span>
              </div>
              <div className="flex items-center justify-center space-x-2 text-xs text-gray-500">
                <span>Min: {variation.min_stock_level}</span>
                <span className="text-gray-300">•</span>
                <span>Max: {variation.max_stock_level}</span>
              </div>
            </div>
          </TableCell>

          <TableCell className="py-2">
            <div className="flex justify-center">
              {getStatusBadge(variation.stock_status)}
            </div>
          </TableCell>

          <TableCell className="py-2">
            <div className="text-center space-y-1">
              <p className="text-lg font-bold text-green-700">{Number(variation.price).toFixed(0)} ብር</p>
              {variation.purchase_price && (
                <p className="text-[10px] text-gray-400 leading-tight">
                  Purchase: {Number(variation.purchase_price).toFixed(0)} ብር
                </p>
              )}
              {variation.cost_price && (
                <p className="text-xs text-green-500 font-medium">
                  Margin: {Number(variation.price) > 0 ? (((Number(variation.price) - Number(variation.cost_price)) / Number(variation.price)) * 100).toFixed(1) : '0.0'}%
                </p>
              )}
            </div>
          </TableCell>

          <TableCell className="py-2">
            <div className="flex items-center justify-center space-x-1">
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => handleVariationEdit(variation)}
                title="Edit Variation"
                className="h-6 w-6 p-0 border-blue-200 text-blue-600 hover:bg-blue-50 hover:border-blue-300 transition-all duration-200"
                disabled={disableActions}
              >
                <Edit className="h-3 w-3" />
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => handleVariationSell()}
                title="Sell Variation"
                className="h-6 w-6 p-0 bg-green-100 text-green-600 hover:bg-green-200 border-green-200 transition-all duration-200"
                disabled={disableActions}
              >
                <ShoppingBag className="h-3 w-3" />
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => setConfirmVariation(variation)}
                title="Delete Variation"
                className="h-6 w-6 p-0 bg-red-100 text-red-600 hover:bg-red-200 border-red-200 transition-all duration-200"
                disabled={disableActions}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </TableCell>
        </TableRow>
      ))}

      {/* Confirm Delete Product Dialog */}
      <AlertDialog open={confirmProductOpen} onOpenChange={setConfirmProductOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-700">Delete Product</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete
              <span className="font-semibold"> {product.product_name}</span>? This will remove the
              product{product.product_type === 'variation' ? ' and all its variations' : ''}, inventory records, and related history. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => {
                setConfirmProductOpen(false)
                onDeleteProduct(product)
              }}
            >
              Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm Delete Variation Dialog */}
      <AlertDialog open={!!confirmVariation} onOpenChange={(open) => !open && setConfirmVariation(null)}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-700">Delete Variation</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmVariation ? (
                <span>
                  Remove the variation
                  <span className="font-semibold"> {confirmVariation.color || '—'}</span>
                  {confirmVariation.size ? <span className="font-semibold"> / {confirmVariation.size}</span> : null}
                  {confirmVariation.variation_sku ? <span> (SKU: {confirmVariation.variation_sku})</span> : null}
                  ? This will delete only this variation and its inventory records. Other variations remain.
                </span>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmVariation(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={async () => {
                if (confirmVariation) {
                  const v = confirmVariation
                  setConfirmVariation(null)
                  await executeVariationDelete(v)
                }
              }}
            >
              Delete Variation
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
