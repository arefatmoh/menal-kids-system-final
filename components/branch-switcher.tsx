"use client"

import { useEffect } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Building2 } from "lucide-react"
import { useBranch } from "@/lib/branch-context"
import { useLanguage } from "@/lib/language-context"

export function BranchSwitcher() {
  const { currentBranch, setBranch, canAccessBranch } = useBranch()
  const { t } = useLanguage()
  const userRole = typeof window !== "undefined" ? localStorage.getItem("userRole") : null
  const userEmail = typeof window !== "undefined" ? localStorage.getItem("userEmail") : null

  // Auto-detect branch for employees
  useEffect(() => {
    if (userRole === "employee" && userEmail) {
      if (userEmail === "sarah@menalkids.com") {
        setBranch("branch1")
      } else if (userEmail === "michael@menalkids.com") {
        setBranch("branch2")
      }
    }
  }, [userRole, userEmail, setBranch])

  if (userRole === "employee") {
    // Employees see their branch name but can't switch
    const branchName = currentBranch === "branch1" ? "Franko (Main)" : "Mebrathayl"
    return (
      <div className="flex items-center space-x-2 px-3 py-2 bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 rounded-xl">
        <Building2 className="h-4 w-4 text-blue-600" />
        <span className="text-sm font-medium text-blue-800">
          {branchName}
        </span>
      </div>
    )
  }

  return (
    <Select value={currentBranch} onValueChange={(value: "branch1" | "branch2" | "all") => setBranch(value)}>
      <SelectTrigger className="w-40 rounded-xl border-gray-200 focus:border-pink-300 focus:ring-pink-200">
        <Building2 className="h-4 w-4 mr-2" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {canAccessBranch("all") && <SelectItem value="all">{t("allBranches")}</SelectItem>}
        {canAccessBranch("branch1") && <SelectItem value="branch1">{t("branch1")}</SelectItem>}
        {canAccessBranch("branch2") && <SelectItem value="branch2">{t("branch2")}</SelectItem>}
      </SelectContent>
    </Select>
  )
}
