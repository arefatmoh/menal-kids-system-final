"use client"

import type React from "react"
import { AlertsNotificationBell } from "@/components/alerts-notification-bell"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import api from "@/lib/api-client"
import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  LayoutDashboard,
  Package,
  Plus,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  Heart,
  ShoppingBag,
  ArrowRightLeft,
  DollarSign,
} from "lucide-react"
import { LanguageSwitcher } from "@/components/language-switcher"
import { BranchSwitcher } from "@/components/branch-switcher"
import { useLanguage } from "@/lib/language-context"
import { useBranch } from "@/lib/branch-context"

const navigation = [
  { name: "dashboard", href: "/dashboard", icon: LayoutDashboard, roles: ["owner", "employee"] },
  { name: "inventory", href: "/dashboard/inventory", icon: Package, roles: ["owner", "employee"] },
  { name: "addProduct", href: "/dashboard/add-product", icon: Plus, roles: ["owner", "employee"] },
  { name: "sellProducts", href: "/dashboard/sell", icon: ShoppingBag, roles: ["owner", "employee"] },
  { name: "stockManagement", href: "/dashboard/stock", icon: Settings, roles: ["owner", "employee"] },
  { name: "transfer", href: "/dashboard/transfer", icon: ArrowRightLeft, roles: ["owner", "employee"] },
  { name: "expenses", href: "/dashboard/expenses", icon: DollarSign, roles: ["owner", "employee"] },
  { name: "reports", href: "/dashboard/reports", icon: BarChart3, roles: ["owner"] }, // Only owner
]

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [userRole, setUserRole] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showAdminDialog, setShowAdminDialog] = useState(false)
  const [adminPasscode, setAdminPasscode] = useState("")
  const router = useRouter()
  const pathname = usePathname()

  const { t } = useLanguage()
  const { currentBranch } = useBranch()

  useEffect(() => {
    const role = localStorage.getItem("userRole")
    const email = localStorage.getItem("userEmail")
    if (!role) {
      router.push("/")
      return
    }
    setUserRole(role)
    setUserEmail(email)
  }, [router])

  const handleLogout = () => {
    // Clear all auth/branch related storage to avoid cross-user leakage
    localStorage.removeItem("userRole")
    localStorage.removeItem("userEmail")
    localStorage.removeItem("userBranchId")
    localStorage.removeItem("currentBranch")
    localStorage.removeItem("auth_token")
    localStorage.removeItem("userName")
    // Force full reload to reinitialize providers cleanly
    if (typeof window !== "undefined") {
      window.location.replace("/")
    } else {
      router.push("/")
    }
  }

  const filteredNavigation = navigation.filter((item) => item.roles.includes(userRole || ""))

  if (!userRole) {
    return <div>Loading...</div>
  }

  return (
    <div className="min-h-screen bg-gray-50 lg:flex">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-white shadow-xl transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:relative lg:flex lg:flex-shrink-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex flex-col w-full">
          <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200">
            <div
              className="flex items-center space-x-2 cursor-pointer select-none"
              title="Open developer tools"
              onClick={() => setShowAdminDialog(true)}
            >
              <div className="bg-gradient-to-r from-pink-400 to-purple-500 p-2 rounded-lg">
                <ShoppingBag className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">
                  Menal Kids
                </h1>
                <p className="text-xs text-gray-500 capitalize">{t(userRole as any) || userRole} {t("dashboard")}</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" className="lg:hidden" onClick={() => setSidebarOpen(false)}>
              <X className="h-5 w-5" />
            </Button>
          </div>

          <nav className="mt-6 px-4 flex-1">
            <div className="space-y-2">
              {filteredNavigation.map((item) => {
                const isActive = pathname === item.href
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`group flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 ${
                      isActive
                        ? "bg-gradient-to-r from-pink-500 to-purple-500 text-white shadow-lg"
                        : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                    }`}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <item.icon
                      className={`mr-4 h-5 w-5 flex-shrink-0 ${isActive ? "text-white" : "text-gray-400 group-hover:text-gray-500"}`}
                    />
                    <span className="truncate">{t(item.name as any)}</span>
                  </Link>
                )
              })}
            </div>
          </nav>

          <div className="p-4 border-t border-gray-200">
            <div className="flex items-center space-x-3 mb-4">
              <div className="bg-gradient-to-r from-pink-400 to-purple-500 p-2 rounded-full">
                <Heart className="h-4 w-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{userEmail}</p>
                <p className="text-xs text-gray-500 capitalize">{t(userRole as any) || userRole}</p>
              </div>
            </div>
            <Button
              onClick={handleLogout}
              variant="outline"
              className="w-full justify-start text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300 bg-transparent"
            >
              <LogOut className="mr-2 h-4 w-4" />
              {t("signOut")}
            </Button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <div className="sticky top-0 z-40 bg-white shadow-sm border-b border-gray-200">
          <div className="flex items-center justify-between h-16 px-3 sm:px-6">
            <Button variant="ghost" size="sm" className="lg:hidden" onClick={() => setSidebarOpen(true)}>
              <Menu className="h-5 w-5" />
            </Button>
            <div className="flex-1" />
            <div className="flex items-center space-x-2 sm:space-x-4">
              <AlertsNotificationBell />
              <BranchSwitcher />
              <LanguageSwitcher />
              <div className="text-sm text-gray-500 hidden sm:block">
                {new Date().toLocaleDateString("en-US", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Page content */}
        {/* Mobile date below top bar */}
        <div className="sm:hidden px-4 pt-2 text-sm text-gray-500">
          {new Date().toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </div>

        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>

      <Dialog open={showAdminDialog} onOpenChange={setShowAdminDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("edit")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              type="password"
              value={adminPasscode}
              onChange={(e) => setAdminPasscode(e.target.value)}
              placeholder={t("password")}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowAdminDialog(false)}>
                {t("cancel")}
              </Button>
              <Button
                onClick={async () => {
                  try {
                    const res: any = await api.adminEnableTools(adminPasscode)
                    if (res?.success) {
                      setShowAdminDialog(false)
                      setAdminPasscode("")
                      router.push("/dashboard/dev")
                    }
                  } catch (e) {
                    // ignore; errors are surfaced in target page interactions
                  }
                }}
              >
                {t("save")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
