"use client"

import { Check, Plus, X } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

export function CartNotification({ 
  productName, 
  quantity,
  onClose 
}: { 
  productName: string
  quantity: number
  onClose: () => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 100 }}
      transition={{ type: "spring", damping: 25 }}
      className="fixed bottom-4 right-4 z-50"
    >
      <div className="bg-white border border-green-200 rounded-lg shadow-xl p-4 w-64 flex items-start gap-3">
        <div className="bg-green-100 p-2 rounded-full">
          <Check className="h-5 w-5 text-green-600" />
        </div>
        <div className="flex-1">
          <p className="font-medium text-gray-900">Added to Cart</p>
          <p className="text-sm text-gray-600 truncate">{productName}</p>
          <div className="flex items-center mt-1">
            <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full flex items-center">
              <Plus className="h-3 w-3 mr-1" />{quantity}
            </span>
          </div>
        </div>
        <button 
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </motion.div>
  )
}