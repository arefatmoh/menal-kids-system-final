"use client"

import type React from "react"
import { createContext, useContext, useState, useEffect } from "react"
import { getFrontendBranchName } from "./utils"

export type Branch = "franko" | "mebrat-hayl" | "all"

interface BranchContextType {
  currentBranch: Branch
  setBranch: (branch: Branch) => void
  userBranch: Branch | null
  canAccessBranch: (branch: Branch) => boolean
}

const BranchContext = createContext<BranchContextType | undefined>(undefined)

export function BranchProvider({ children }: { children: React.ReactNode }) {
  const [currentBranch, setCurrentBranch] = useState<Branch>("franko")
  const [userBranch, setUserBranch] = useState<Branch | null>(null)

  useEffect(() => {
    const userRole = localStorage.getItem("userRole")
    const userEmail = localStorage.getItem("userEmail")
    const userBranchId = localStorage.getItem("userBranchId")

    if (userEmail) {
      // Determine user's branch based on stored branch ID or email
      if (userBranchId) {
        // Map database branch IDs to frontend branch names
        const mappedBranch = getFrontendBranchName(userBranchId) as Branch
        setUserBranch(mappedBranch)
        setCurrentBranch(mappedBranch)
      } else if (userRole === "owner") {
        setUserBranch("all")
        setCurrentBranch("all")
      } else if (userEmail === "sarah@menalkids.com") {
        // Sarah - Franko (Main) branch
        setUserBranch("franko")
        setCurrentBranch("franko")
      } else if (userEmail === "michael@menalkids.com") {
        // Michael - Mebrat Hayl branch
        setUserBranch("mebrat-hayl")
        setCurrentBranch("mebrat-hayl")
      } else if (userEmail.includes("franko") || userEmail.includes("f1")) {
        setUserBranch("franko")
        setCurrentBranch("franko")
      } else if (userEmail.includes("mebrat") || userEmail.includes("m2")) {
        setUserBranch("mebrat-hayl")
        setCurrentBranch("mebrat-hayl")
      } else {
        // Default to franko for other employees
        setUserBranch("franko")
        setCurrentBranch("franko")
      }
    }
  }, [])

  const setBranch = (branch: Branch) => {
    const userRole = localStorage.getItem("userRole")

    // Only owners can switch to 'all' branches
    if (branch === "all" && userRole !== "owner") {
      return
    }

    // Employees can only access their assigned branch
    if (userRole === "employee" && userBranch && branch !== userBranch && branch !== "all") {
      return
    }

    setCurrentBranch(branch)
    localStorage.setItem("currentBranch", branch)
  }

  const canAccessBranch = (branch: Branch): boolean => {
    const userRole = localStorage.getItem("userRole")

    if (userRole === "owner") return true
    if (userBranch === "all") return true
    if (userBranch === branch) return true

    return false
  }

  return (
    <BranchContext.Provider value={{ currentBranch, setBranch, userBranch, canAccessBranch }}>
      {children}
    </BranchContext.Provider>
  )
}

export function useBranch() {
  const context = useContext(BranchContext)
  if (context === undefined) {
    throw new Error("useBranch must be used within a BranchProvider")
  }
  return context
}
