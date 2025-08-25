"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Bell,
  AlertTriangle,
  TrendingDown,
  DollarSign,
  Package,
  Building2,
  Clock,
  X,
  CheckCircle,
  Filter,
} from "lucide-react"
import { useAlerts, type Alert } from "@/lib/alerts-context"
import { useLanguage } from "@/lib/language-context"

export function AlertsPanel() {
  const { alerts, unreadCount, markAsRead, markAllAsRead, dismissAlert } = useAlerts()
  const { t } = useLanguage()
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null)
  const [filterType, setFilterType] = useState<"all" | Alert["type"]>("all")
  const [filterSeverity, setFilterSeverity] = useState<"all" | Alert["severity"]>("all")

  const getSeverityColor = (severity: Alert["severity"]) => {
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

  const getTypeIcon = (type: Alert["type"]) => {
    switch (type) {
      case "performance":
        return <TrendingDown className="h-4 w-4" />
      case "budget":
        return <DollarSign className="h-4 w-4" />
      case "inventory":
        return <Package className="h-4 w-4" />
      case "sales":
        return <Building2 className="h-4 w-4" />
      default:
        return <AlertTriangle className="h-4 w-4" />
    }
  }

  const filteredAlerts = alerts.filter((alert) => {
    const typeMatch = filterType === "all" || alert.type === filterType
    const severityMatch = filterSeverity === "all" || alert.severity === filterSeverity
    return typeMatch && severityMatch
  })

  const formatTimeAgo = (timestamp: Date) => {
    const now = new Date()
    const diffInMinutes = Math.floor((now.getTime() - timestamp.getTime()) / (1000 * 60))

    if (diffInMinutes < 1) return "Just now"
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`
    return `${Math.floor(diffInMinutes / 1440)}d ago`
  }

  const handleAlertClick = (alert: Alert) => {
    if (!alert.isRead) {
      markAsRead(alert.id)
    }
    setSelectedAlert(alert)
  }

  const criticalAlerts = alerts.filter((alert) => alert.severity === "critical" && !alert.isRead)
  const highAlerts = alerts.filter((alert) => alert.severity === "high" && !alert.isRead)

  return (
    <>
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Bell className="h-5 w-5 text-orange-500" />
              <CardTitle>{t("alerts")}</CardTitle>
              {unreadCount > 0 && (
                <Badge className="bg-red-500 text-white rounded-full px-2 py-1 text-xs">{unreadCount}</Badge>
              )}
            </div>
            <div className="flex items-center space-x-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="rounded-xl bg-transparent">
                    <Filter className="h-4 w-4 mr-2" />
                    Filter
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel>{t("filter")}</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => setFilterType("all")}>All Types</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setFilterType("performance")}>Performance</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setFilterType("budget")}>Budget</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setFilterType("inventory")}>Inventory</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setFilterType("sales")}>Sales</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>{t("status")}</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => setFilterSeverity("all")}>All Levels</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setFilterSeverity("critical")}>Critical</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setFilterSeverity("high")}>High</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setFilterSeverity("medium")}>Medium</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setFilterSeverity("low")}>Low</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              {unreadCount > 0 && (
                <Button variant="outline" size="sm" onClick={markAllAsRead} className="rounded-xl bg-transparent">
                  <CheckCircle className="h-4 w-4 mr-2" />
                  {t("save")}
                </Button>
              )}
            </div>
          </div>
          <CardDescription>{t("inventoryAnalytics" as any)}</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Critical Alerts Banner */}
          {criticalAlerts.length > 0 && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
              <div className="flex items-center space-x-2 mb-2">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                <h4 className="font-semibold text-red-800">{t("lowStockAlerts")}</h4>
              </div>
              <div className="space-y-2">
                {criticalAlerts.map((alert) => (
                  <div key={alert.id} className="text-sm text-red-700">
                    • {alert.title}
                  </div>
                ))}
              </div>
            </div>
          )}

          <Tabs defaultValue="all" className="space-y-4">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="all">{t("allBranches")} ({filteredAlerts.length})</TabsTrigger>
              <TabsTrigger value="critical">
                Critical ({alerts.filter((a) => a.severity === "critical").length})
              </TabsTrigger>
              <TabsTrigger value="performance">
                Performance ({alerts.filter((a) => a.type === "performance").length})
              </TabsTrigger>
              <TabsTrigger value="budget">{t("reports")} ({alerts.filter((a) => a.type === "budget").length})</TabsTrigger>
              <TabsTrigger value="unread">Unread ({unreadCount})</TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="space-y-3">
              {filteredAlerts.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Bell className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                  <p>{t("filter")}</p>
                </div>
              ) : (
                filteredAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`p-4 rounded-xl border cursor-pointer transition-all hover:shadow-md ${
                      alert.isRead ? "bg-gray-50 border-gray-200" : "bg-white border-orange-200 shadow-sm"
                    }`}
                    onClick={() => handleAlertClick(alert)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3 flex-1">
                        <div className={`p-2 rounded-lg ${getSeverityColor(alert.severity)}`}>
                          {getTypeIcon(alert.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2 mb-1">
                            <h4 className={`font-medium ${alert.isRead ? "text-gray-700" : "text-gray-900"}`}>
                              {alert.title}
                            </h4>
                            {!alert.isRead && <div className="w-2 h-2 bg-orange-500 rounded-full" />}
                            {alert.actionRequired && (
                              <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-200">
                                Action Required
                              </Badge>
                            )}
                          </div>
                          <p className={`text-sm ${alert.isRead ? "text-gray-500" : "text-gray-600"} mb-2`}>
                            {alert.message}
                          </p>
                          <div className="flex items-center space-x-4 text-xs text-gray-400">
                            <span className="flex items-center space-x-1">
                              <Clock className="h-3 w-3" />
                              <span>{formatTimeAgo(alert.timestamp)}</span>
                            </span>
                            {alert.branch && alert.branch !== "all" && (
                              <span className="flex items-center space-x-1">
                                <Building2 className="h-3 w-3" />
                                <span>{alert.branch === "franko" ? t("frankoBranch") : t("mebrathaylBranch")}</span>
                              </span>
                            )}
                            <Badge className={`text-xs ${getSeverityColor(alert.severity)}`}>
                              {alert.severity.toUpperCase()}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-gray-400 hover:text-gray-600 p-1"
                        onClick={(e) => {
                          e.stopPropagation()
                          dismissAlert(alert.id)
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </TabsContent>

            <TabsContent value="critical" className="space-y-3">
              {alerts
                .filter((a) => a.severity === "critical")
                .map((alert) => (
                  <div
                    key={alert.id}
                    className="p-4 rounded-xl border border-red-200 bg-red-50 cursor-pointer transition-all hover:shadow-md"
                    onClick={() => handleAlertClick(alert)}
                  >
                    <div className="flex items-start space-x-3">
                      <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
                      <div className="flex-1">
                        <h4 className="font-medium text-red-900 mb-1">{alert.title}</h4>
                        <p className="text-sm text-red-700 mb-2">{alert.message}</p>
                        <div className="text-xs text-red-600">
                          {formatTimeAgo(alert.timestamp)} • Requires immediate action
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
            </TabsContent>

            <TabsContent value="performance" className="space-y-3">
              {alerts
                .filter((a) => a.type === "performance")
                .map((alert) => (
                  <div
                    key={alert.id}
                    className={`p-4 rounded-xl border cursor-pointer transition-all hover:shadow-md ${
                      alert.isRead ? "bg-gray-50 border-gray-200" : "bg-blue-50 border-blue-200"
                    }`}
                    onClick={() => handleAlertClick(alert)}
                  >
                    <div className="flex items-start space-x-3">
                      <TrendingDown className="h-5 w-5 text-blue-600 mt-0.5" />
                      <div className="flex-1">
                        <h4 className="font-medium text-blue-900 mb-1">{alert.title}</h4>
                        <p className="text-sm text-blue-700 mb-2">{alert.message}</p>
                        <div className="text-xs text-blue-600">{formatTimeAgo(alert.timestamp)}</div>
                      </div>
                    </div>
                  </div>
                ))}
            </TabsContent>

            <TabsContent value="budget" className="space-y-3">
              {alerts
                .filter((a) => a.type === "budget")
                .map((alert) => (
                  <div
                    key={alert.id}
                    className={`p-4 rounded-xl border cursor-pointer transition-all hover:shadow-md ${
                      alert.isRead ? "bg-gray-50 border-gray-200" : "bg-green-50 border-green-200"
                    }`}
                    onClick={() => handleAlertClick(alert)}
                  >
                    <div className="flex items-start space-x-3">
                      <DollarSign className="h-5 w-5 text-green-600 mt-0.5" />
                      <div className="flex-1">
                        <h4 className="font-medium text-green-900 mb-1">{alert.title}</h4>
                        <p className="text-sm text-green-700 mb-2">{alert.message}</p>
                        <div className="text-xs text-green-600">{formatTimeAgo(alert.timestamp)}</div>
                      </div>
                    </div>
                  </div>
                ))}
            </TabsContent>

            <TabsContent value="unread" className="space-y-3">
              {alerts
                .filter((a) => !a.isRead)
                .map((alert) => (
                  <div
                    key={alert.id}
                    className="p-4 rounded-xl border border-orange-200 bg-white cursor-pointer transition-all hover:shadow-md"
                    onClick={() => handleAlertClick(alert)}
                  >
                    <div className="flex items-start space-x-3">
                      <div className={`p-2 rounded-lg ${getSeverityColor(alert.severity)}`}>
                        {getTypeIcon(alert.type)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <h4 className="font-medium text-gray-900">{alert.title}</h4>
                          <div className="w-2 h-2 bg-orange-500 rounded-full" />
                        </div>
                        <p className="text-sm text-gray-600 mb-2">{alert.message}</p>
                        <div className="text-xs text-gray-400">{formatTimeAgo(alert.timestamp)}</div>
                      </div>
                    </div>
                  </div>
                ))}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Alert Detail Dialog */}
      <Dialog open={!!selectedAlert} onOpenChange={() => setSelectedAlert(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              {selectedAlert && getTypeIcon(selectedAlert.type)}
              <span>{selectedAlert?.title}</span>
              {selectedAlert && (
                <Badge className={`text-xs ${getSeverityColor(selectedAlert.severity)}`}>
                  {selectedAlert.severity.toUpperCase()}
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription>{t("inventoryAnalytics" as any)}</DialogDescription>
          </DialogHeader>

          {selectedAlert && (
            <div className="space-y-4">
              <div>
                <h4 className="font-medium text-gray-900 mb-2">{t("descriptionLabel" as any)}</h4>
                <p className="text-sm text-gray-600">{selectedAlert.message}</p>
              </div>

              {selectedAlert.threshold && selectedAlert.currentValue && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">{t("inventoryAnalytics" as any)}</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-500 mb-1">{t("status")}</p>
                      <p className="font-semibold text-gray-900">
                        {selectedAlert.currentValue.toLocaleString()}
                        {selectedAlert.type === "budget" || selectedAlert.type === "performance" ? " Birr" : ""}
                      </p>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-500 mb-1">{t("price")}</p>
                      <p className="font-semibold text-gray-900">
                        {selectedAlert.threshold.toLocaleString()}
                        {selectedAlert.type === "budget" || selectedAlert.type === "performance" ? " Birr" : ""}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <h4 className="font-medium text-gray-900 mb-2">{t("alerts")}</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Type:</span>
                    <span className="capitalize">{selectedAlert.type}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Severity:</span>
                    <span className="capitalize">{selectedAlert.severity}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">{t("switchBranch")}</span>
                    <span>
                      {selectedAlert.branch === "all"
                        ? "All Branches"
                        : selectedAlert.branch === "franko"
                          ? "Branch 1"
                          : "Branch 2"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">{t("today")}</span>
                    <span>{selectedAlert.timestamp.toLocaleString()}</span>
                  </div>
                  {selectedAlert.category && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">{t("category")}</span>
                      <span>{selectedAlert.category}</span>
                    </div>
                  )}
                </div>
              </div>

              {selectedAlert.actionRequired && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <h4 className="font-medium text-yellow-800 mb-1">{t("actions")}</h4>
                  <p className="text-sm text-yellow-700">
                    This alert requires immediate attention and action to resolve the issue.
                  </p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedAlert(null)}>
              {t("cancel")}
            </Button>
            {selectedAlert?.actionRequired && (
              <Button
                className="bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white"
                onClick={() => {
                  // In a real app, this would navigate to the relevant page or open an action dialog
                  alert("...")
                  setSelectedAlert(null)
                }}
              >
                {t("save")}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
