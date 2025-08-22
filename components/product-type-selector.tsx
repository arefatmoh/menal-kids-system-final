"use client"

import { useState } from "react"
import { useLanguage } from "@/lib/language-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Package, Layers, Search, Info } from "lucide-react"

interface ProductTypeSelectorProps {
  selectedType: "uniform" | "variation" | "existing-variation"
  onTypeChange: (type: "uniform" | "variation" | "existing-variation") => void
}

export function ProductTypeSelector({ selectedType, onTypeChange }: ProductTypeSelectorProps) {
  const { t } = useLanguage()
  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-2">
        <Info className="h-4 w-4 text-blue-500" />
        <span className="text-sm font-medium text-gray-700">{t("selectProductType" as any) || "Select Product Type"}</span>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Uniform Product Option */}
        <Card 
          className={`cursor-pointer transition-all duration-200 hover:shadow-lg ${
            selectedType === "uniform" 
              ? "ring-2 ring-pink-500 bg-gradient-to-br from-pink-50 to-purple-50 border-pink-200" 
              : "border-gray-200 hover:border-pink-300"
          }`}
          onClick={() => onTypeChange("uniform")}
        >
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  selectedType === "uniform" 
                    ? "bg-gradient-to-r from-pink-500 to-purple-500 text-white" 
                    : "bg-gray-100 text-gray-600"
                }`}>
                  <Package className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-lg">{t("uniformProduct" as any) || "Uniform Product"}</CardTitle>
                  <Badge variant={selectedType === "uniform" ? "default" : "secondary"}>
                    {t("singleVariation" as any) || "Single Variation"}
                  </Badge>
                </div>
              </div>
              {selectedType === "uniform" && (
                <div className="w-6 h-6 bg-pink-500 rounded-full flex items-center justify-center">
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <CardDescription className="text-sm">
              {t("uniformProductDesc" as any) || "Perfect for products with single attributes - one color, one size, one price."}
              <br />
            </CardDescription>
          </CardContent>
        </Card>

        {/* Variation Product Option */}
        <Card 
          className={`cursor-pointer transition-all duration-200 hover:shadow-lg ${
            selectedType === "variation" 
              ? "ring-2 ring-pink-500 bg-gradient-to-br from-pink-50 to-purple-50 border-pink-200" 
              : "border-gray-200 hover:border-pink-300"
          }`}
          onClick={() => onTypeChange("variation")}
        >
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  selectedType === "variation" 
                    ? "bg-gradient-to-r from-pink-500 to-purple-500 text-white" 
                    : "bg-gray-100 text-gray-600"
                }`}>
                  <Layers className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-lg">{t("variationProduct" as any) || "Variation Product"}</CardTitle>
                  <Badge variant={selectedType === "variation" ? "default" : "secondary"}>
                    {t("multipleVariations" as any) || "Multiple Variations"}
                  </Badge>
                </div>
              </div>
              {selectedType === "variation" && (
                <div className="w-6 h-6 bg-pink-500 rounded-full flex items-center justify-center">
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <CardDescription className="text-sm">
              {t("variationProductDesc" as any) || "Ideal for products with multiple combinations - different colors, sizes, prices."}
              <br />
            </CardDescription>
          </CardContent>
        </Card>

        {/* Add Variation to Existing Product Option */}
        <Card 
          className={`cursor-pointer transition-all duration-200 hover:shadow-lg ${
            selectedType === "existing-variation" 
              ? "ring-2 ring-pink-500 bg-gradient-to-br from-pink-50 to-purple-50 border-pink-200" 
              : "border-gray-200 hover:border-pink-300"
          }`}
          onClick={() => onTypeChange("existing-variation")}
        >
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  selectedType === "existing-variation" 
                    ? "bg-gradient-to-r from-pink-500 to-purple-500 text-white" 
                    : "bg-gray-100 text-gray-600"
                }`}>
                  <Search className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-lg">{t("addToExisting" as any) || "Add to Existing"}</CardTitle>
                  <Badge variant={selectedType === "existing-variation" ? "default" : "secondary"}>
                    {t("newVariation" as any) || "New Variation"}
                  </Badge>
                </div>
              </div>
              {selectedType === "existing-variation" && (
                <div className="w-6 h-6 bg-pink-500 rounded-full flex items-center justify-center">
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <CardDescription className="text-sm">
              {t("addToExistingDesc" as any) || "Add new variations to an existing product - expand your product line."}
              <br />
            </CardDescription>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
