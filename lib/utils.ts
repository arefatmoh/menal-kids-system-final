import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Format currency
export function formatCurrency(amount: number, currency = "ብር"): string {
  if (amount === 0) return `0 ${currency}`
  
  // Format for Ethiopian Birr - no decimal places
  const formattedAmount = Math.round(amount).toLocaleString()
  
  return `${formattedAmount} ${currency}`
}

// Format date
export function formatDate(date: Date | string, format: "short" | "long" | "time" = "short"): string {
  const dateObj = typeof date === "string" ? new Date(date) : date

  switch (format) {
    case "long":
      return dateObj.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    case "time":
      return dateObj.toLocaleString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    default:
      return dateObj.toLocaleDateString("en-US")
  }
}

// Format number
export function formatNumber(num: number): string {
  return new Intl.NumberFormat("en-US").format(num)
}

// Calculate percentage
export function calculatePercentage(value: number, total: number): number {
  if (total === 0) return 0
  return Math.round((value / total) * 100)
}

// Generate random ID
export function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36)
}

// Debounce function
export function debounce<T extends (...args: any[]) => any>(func: T, wait: number): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout
  return (...args: Parameters<T>) => {
    clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

// Validate email
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

// Validate phone number
export function isValidPhone(phone: string): boolean {
  const phoneRegex = /^[+]?[1-9][\d]{0,15}$/
  return phoneRegex.test(phone.replace(/\s/g, ""))
}

// Get stock status color
export function getStockStatusColor(status: string): string {
  switch (status) {
    case "out_of_stock":
      return "bg-red-100 text-red-800"
    case "low_stock":
      return "bg-orange-100 text-orange-800"
    case "overstock":
      return "bg-blue-100 text-blue-800"
    default:
      return "bg-green-100 text-green-800"
  }
}

// Get alert severity color
export function getAlertSeverityColor(severity: string): string {
  switch (severity) {
    case "critical":
      return "bg-red-100 text-red-800 border-red-200"
    case "high":
      return "bg-orange-100 text-orange-800 border-orange-200"
    case "medium":
      return "bg-yellow-100 text-yellow-800 border-yellow-200"
    case "low":
      return "bg-blue-100 text-blue-800 border-blue-200"
    default:
      return "bg-gray-100 text-gray-800 border-gray-200"
  }
}

// Truncate text
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength) + "..."
}

// Convert to slug
export function toSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w ]+/g, "")
    .replace(/ +/g, "-")
}

// Parse JSON safely
export function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json)
  } catch {
    return fallback
  }
}

// Get initials from name
export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase())
    .join("")
    .substring(0, 2)
}

// Calculate days between dates
export function daysBetween(date1: Date, date2: Date): number {
  const oneDay = 24 * 60 * 60 * 1000
  return Math.round(Math.abs((date1.getTime() - date2.getTime()) / oneDay))
}

// Check if date is today
export function isToday(date: Date): boolean {
  const today = new Date()
  return date.toDateString() === today.toDateString()
}

// Check if date is this week
export function isThisWeek(date: Date): boolean {
  const today = new Date()
  const weekStart = new Date(today.setDate(today.getDate() - today.getDay()))
  const weekEnd = new Date(today.setDate(today.getDate() - today.getDay() + 6))
  return date >= weekStart && date <= weekEnd
}

// Branch mapping utilities
export function getBranchIdForDatabase(branch: string): string {
  if (branch === "franko") return "branch1"
  if (branch === "mebrat-hayl") return "branch2"
  return branch
}

export function getFrontendBranchName(branchId: string): string {
  if (branchId === "branch1") return "franko"
  if (branchId === "branch2") return "mebrat-hayl"
  return branchId
}
