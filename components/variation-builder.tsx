"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Trash2, Layers } from "lucide-react"


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

interface VariationBuilderProps {
  variations: Variation[]
  onVariationsChange: (variations: Variation[]) => void
}

const COLORS = [
  'white', 'black', 'gray', 'red', 'blue', 'green', 'yellow', 'orange', 'purple', 'brown',
  'baby-pink', 'baby-blue', 'baby-yellow', 'baby-green', 'baby-purple', 'baby-peach',
  'baby-mint', 'baby-lavender', 'cream', 'ivory', 'beige', 'coral', 'turquoise', 'lilac', 'sage'
]

const SIZES = [
  '0-3m', '3-6m', '6-12m', '12-18m', '18-24m', 'xs', 's', 'm', 'l', 'xl'
]

export function VariationBuilder({ variations, onVariationsChange }: VariationBuilderProps) {
  const addVariation = () => {
    const newVariation: Variation = {
      color: '',
      size: '',
      price: 0,
      cost_price: 0,
      purchase_price: 0,
      initial_quantity: 0,
      min_stock_level: 5,
      max_stock_level: 100
    }
    onVariationsChange([...variations, newVariation])
  }

  const updateVariation = (index: number, field: keyof Variation, value: any) => {
    const updatedVariations = [...variations]
    updatedVariations[index] = { ...updatedVariations[index], [field]: value }
    onVariationsChange(updatedVariations)
  }

  const removeVariation = (index: number) => {
    const updatedVariations = variations.filter((_, i) => i !== index)
    onVariationsChange(updatedVariations)
  }

  const getColorClass = (color: string) => {
    const colorMap: { [key: string]: string } = {
      'white': 'bg-white border-2 border-gray-300',
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
    <Card className="border-0 shadow-lg">
      <CardHeader className="bg-gradient-to-r from-pink-50 to-purple-50 border-b border-pink-100">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-r from-pink-500 to-purple-500 rounded-lg flex items-center justify-center">
                <Plus className="h-4 w-4 text-white" />
              </div>
              <span>Product Variations</span>
            </CardTitle>
            <CardDescription>
              Add different combinations of colors, sizes, and prices for your product
            </CardDescription>
          </div>
          <Button type="button" onClick={addVariation} className="bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600">
            <Plus className="h-4 w-4 mr-2" />
            Add Variation
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {variations.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Layers className="h-8 w-8 text-gray-400" />
            </div>
            <p className="text-lg font-medium mb-2">No variations added yet</p>
            <p className="text-sm">Click "Add Variation" to create your first product variation</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Color</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Selling Price (ብር)</TableHead>
                <TableHead>Purchase Price (ብር)</TableHead>
                <TableHead>Initial Stock</TableHead>
                <TableHead>Min Stock</TableHead>
                <TableHead>Max Stock</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {variations.map((variation, index) => (
                <TableRow key={index} className="bg-pink-50 border-l-4 border-l-pink-500">
                  <TableCell>
                    <Select value={variation.color || ''} onValueChange={(value) => updateVariation(index, 'color', value)}>
                      <SelectTrigger className="w-32">
                        <SelectValue placeholder="Color">
                          {variation.color && (
                            <div className="flex items-center space-x-2">
                              <div 
                                className={`w-4 h-4 rounded-full border border-gray-300 ${getColorClass(variation.color)}`}
                                style={getColorStyle(variation.color)}
                              />
                              <span className="text-sm capitalize">{variation.color.replace('-', ' ')}</span>
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
                  </TableCell>
                  <TableCell>
                    <Select value={variation.size || ''} onValueChange={(value) => updateVariation(index, 'size', value)}>
                      <SelectTrigger className="w-24">
                        <SelectValue placeholder="Size" />
                      </SelectTrigger>
                      <SelectContent>
                        {SIZES.map((size) => (
                          <SelectItem key={size} value={size}>
                            {size.toUpperCase()}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      value={variation.price || ''}
                      onChange={(e) => updateVariation(index, 'price', parseFloat(e.target.value) || 0)}
                      className="w-20"
                      placeholder="0"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      value={variation.purchase_price || ''}
                      onChange={(e) => updateVariation(index, 'purchase_price', parseFloat(e.target.value) || 0)}
                      className="w-20"
                      placeholder="0"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      value={variation.initial_quantity || ''}
                      onChange={(e) => updateVariation(index, 'initial_quantity', parseInt(e.target.value) || 0)}
                      className="w-20"
                      placeholder="0"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      value={variation.min_stock_level || ''}
                      onChange={(e) => updateVariation(index, 'min_stock_level', parseInt(e.target.value) || 0)}
                      className="w-16"
                      placeholder="5"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      value={variation.max_stock_level || ''}
                      onChange={(e) => updateVariation(index, 'max_stock_level', parseInt(e.target.value) || 0)}
                      className="w-16"
                      placeholder="100"
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => removeVariation(index)}
                        className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
