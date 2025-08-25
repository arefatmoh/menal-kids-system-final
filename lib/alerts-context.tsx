"use client"

import type React from "react"
import { createContext, useContext, useState, useEffect } from "react"
import apiClient from "@/lib/api-client"
import { useToast } from "@/hooks/use-toast"

export interface Alert {
  id: string
  type: "performance" | "budget" | "inventory" | "sales"
  severity: "low" | "medium" | "high" | "critical"
  title: string
  message: string
  branch?: "franko" | "mebrat-hayl" | "all"
  timestamp: Date
  isRead: boolean
  actionRequired: boolean
  threshold?: number
  currentValue?: number
  category?: string
}

interface AlertsContextType {
  alerts: Alert[]
  unreadCount: number
  addAlert: (alert: Omit<Alert, "id" | "timestamp" | "isRead">) => void
  markAsRead: (alertId: string) => void
  markAllAsRead: () => void
  dismissAlert: (alertId: string) => void
  getAlertsByType: (type: Alert["type"]) => Alert[]
  getAlertsBySeverity: (severity: Alert["severity"]) => Alert[]
  refreshAlerts: () => void
}

const AlertsContext = createContext<AlertsContextType | undefined>(undefined)

export function AlertsProvider({ children }: { children: React.ReactNode }) {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const { toast } = useToast()

  const fetchAlerts = async () => {
    try {
      const response = await apiClient.getAlerts()
      if (response.success && response.data) {
        // Transform API data to match our Alert interface
        const transformedAlerts: Alert[] = (response.data as any[]).map((alert: any) => ({
          id: alert.id,
          type: alert.type,
          severity: alert.severity,
          title: alert.title,
          message: alert.message,
          branch: alert.branch_id ? (alert.branch_id === "franko" ? "franko" : alert.branch_id === "mebrat-hayl" ? "mebrat-hayl" : "all") : "all",
          timestamp: new Date(alert.created_at),
          isRead: alert.status === "acknowledged" || alert.status === "resolved",
          actionRequired: alert.action_required,
          threshold: alert.threshold_value,
          currentValue: alert.current_value,
          category: alert.category,
        }))
        setAlerts(transformedAlerts)
      }
    } catch (error) {
      console.error("Failed to fetch alerts:", error)
      // Fallback to sample alerts if API fails
      const fallbackAlerts: Alert[] = [
        {
          id: "1",
          type: "performance",
          severity: "high",
          title: "Branch 2 Sales Below Target",
          message: "Branch 2 sales are 15% below monthly target. Current: 44,000 Birr, Target: 52,000 Birr",
          branch: "mebrat-hayl",
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
          isRead: false,
          actionRequired: true,
          threshold: 52000,
          currentValue: 44000,
          category: "Monthly Sales Target",
        },
        {
          id: "2",
          type: "budget",
          severity: "critical",
          title: "Marketing Budget Exceeded",
          message: "Marketing expenses have exceeded monthly budget by 20%. Spent: 6,000 Birr, Budget: 5,000 Birr",
          branch: "all",
          timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hours ago
          isRead: false,
          actionRequired: true,
          threshold: 5000,
          currentValue: 6000,
          category: "Marketing Expenses",
        },
        {
          id: "3",
          type: "inventory",
          severity: "medium",
          title: "Low Stock Alert",
          message: "5 products are running low on stock across both branches",
          branch: "all",
          timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6 hours ago
          isRead: false,
          actionRequired: true,
          currentValue: 5,
          category: "Stock Management",
        },
        {
          id: "4",
          type: "performance",
          severity: "medium",
          title: "Daily Transaction Target Not Met",
          message: "Branch 1 completed only 18 transactions today. Target: 25 transactions",
          branch: "franko",
          timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000), // 8 hours ago
          isRead: true,
          actionRequired: false,
          threshold: 25,
          currentValue: 18,
          category: "Daily Transactions",
        },
        {
          id: "5",
          type: "budget",
          severity: "high",
          title: "Utilities Budget Warning",
          message: "Utilities expenses at 85% of monthly budget with 10 days remaining",
          branch: "all",
          timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000), // 12 hours ago
          isRead: false,
          actionRequired: false,
          threshold: 3500,
          currentValue: 2975,
          category: "Utilities",
        },
      ]
      setAlerts(fallbackAlerts)
    }
  }

  // Initialize with API data
  useEffect(() => {
    fetchAlerts()
  }, [])

  const unreadCount = alerts.filter((alert) => !alert.isRead).length

  const addAlert = (alertData: Omit<Alert, "id" | "timestamp" | "isRead">) => {
    const newAlert: Alert = {
      ...alertData,
      id: Date.now().toString(),
      timestamp: new Date(),
      isRead: false,
    }
    setAlerts((prev) => [newAlert, ...prev])
  }

  const markAsRead = async (alertId: string) => {
    try {
      // Try to update alert status via API
      await apiClient.updateAlert(alertId, { status: "acknowledged" })
      
      // Update local state
      setAlerts((prev) => prev.map((alert) => (alert.id === alertId ? { ...alert, isRead: true } : alert)))
    } catch (error) {
      console.error("Failed to update alert status:", error)
      // Fallback to local state update only
      setAlerts((prev) => prev.map((alert) => (alert.id === alertId ? { ...alert, isRead: true } : alert)))
    }
  }

  const markAllAsRead = async () => {
    try {
      // Try to update all alerts via API
      const updatePromises = alerts.map(alert => apiClient.updateAlert(alert.id, { status: "acknowledged" }))
      await Promise.all(updatePromises)
      
      // Update local state
      setAlerts((prev) => prev.map((alert) => ({ ...alert, isRead: true })))
    } catch (error) {
      console.error("Failed to update all alert statuses:", error)
      // Fallback to local state update only
      setAlerts((prev) => prev.map((alert) => ({ ...alert, isRead: true })))
    }
  }

  const dismissAlert = async (alertId: string) => {
    try {
      // Try to update alert status via API
      await apiClient.updateAlert(alertId, { status: "dismissed" })
      
      // Update local state
      setAlerts((prev) => prev.filter((alert) => alert.id !== alertId))
    } catch (error) {
      console.error("Failed to dismiss alert:", error)
      // Fallback to local state update only
      setAlerts((prev) => prev.filter((alert) => alert.id !== alertId))
    }
  }

  const getAlertsByType = (type: Alert["type"]) => {
    return alerts.filter((alert) => alert.type === type)
  }

  const getAlertsBySeverity = (severity: Alert["severity"]) => {
    return alerts.filter((alert) => alert.severity === severity)
  }

  const refreshAlerts = () => {
    fetchAlerts()
  }

  // Simulate real-time alert generation (only if no API alerts are available)
  useEffect(() => {
    if (alerts.length === 0) {
      const interval = setInterval(() => {
        // Randomly generate alerts for demonstration
        const shouldGenerateAlert = Math.random() < 0.1 // 10% chance every 30 seconds

        if (shouldGenerateAlert) {
          const alertTypes = [
            {
              type: "performance" as const,
              severity: "medium" as const,
              title: "Sales Performance Alert",
              message: "Hourly sales target missed in Branch 1",
              branch: "franko" as const,
              actionRequired: false,
            },
            {
              type: "budget" as const,
              severity: "high" as const,
              title: "Budget Threshold Warning",
              message: "Office supplies budget at 90% capacity",
              branch: "all" as const,
              actionRequired: true,
            },
            {
              type: "inventory" as const,
              severity: "low" as const,
              title: "Stock Replenishment Reminder",
              message: "Weekly stock review due tomorrow",
              branch: "all" as const,
              actionRequired: false,
            },
          ]

          const randomAlert = alertTypes[Math.floor(Math.random() * alertTypes.length)]
          addAlert(randomAlert)
        }
      }, 30000) // Check every 30 seconds

      return () => clearInterval(interval)
    }
  }, [alerts.length])

  return (
    <AlertsContext.Provider
      value={{
        alerts,
        unreadCount,
        addAlert,
        markAsRead,
        markAllAsRead,
        dismissAlert,
        getAlertsByType,
        getAlertsBySeverity,
        refreshAlerts,
      }}
    >
      {children}
    </AlertsContext.Provider>
  )
}

export function useAlerts() {
  const context = useContext(AlertsContext)
  if (context === undefined) {
    throw new Error("useAlerts must be used within an AlertsProvider")
  }
  return context
}
