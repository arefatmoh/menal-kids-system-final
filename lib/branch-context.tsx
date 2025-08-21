"use client"

import type React from "react"
import { createContext, useContext, useState, useEffect } from "react"

export type Branch = "branch1" | "branch2" | "all"

interface BranchContextType {
  currentBranch: Branch
  setBranch: (branch: Branch) => void
  userBranch: Branch | null
  canAccessBranch: (branch: Branch) => boolean
}

const BranchContext = createContext<BranchContextType | undefined>(undefined)

export function BranchProvider({ children }: { children: React.ReactNode }) {
  const [currentBranch, setCurrentBranch] = useState<Branch>("branch1")
  const [userBranch, setUserBranch] = useState<Branch | null>(null)

  useEffect(() => {
    const userRole = localStorage.getItem("userRole")
    const userEmail = localStorage.getItem("userEmail")
    const userBranchId = localStorage.getItem("userBranchId")

    if (userEmail) {
      // Determine user's branch based on stored branch ID or email
      if (userBranchId) {
        // Use the stored branch ID from login
        setUserBranch(userBranchId as Branch)
        setCurrentBranch(userBranchId as Branch)
      } else if (userRole === "owner") {
        setUserBranch("all")
        setCurrentBranch("all")
      } else if (userEmail === "sarah@menalkids.com") {
        // Sarah - Franko (Main) branch
        setUserBranch("branch1")
        setCurrentBranch("branch1")
      } else if (userEmail === "michael@menalkids.com") {
        // Michael - Mebrathayl branch
        setUserBranch("branch2")
        setCurrentBranch("branch2")
      } else if (userEmail.includes("branch1") || userEmail.includes("b1") || userEmail.includes("franko")) {
        setUserBranch("branch1")
        setCurrentBranch("branch1")
      } else if (userEmail.includes("branch2") || userEmail.includes("b2") || userEmail.includes("mebrathayl")) {
        setUserBranch("branch2")
        setCurrentBranch("branch2")
      } else {
        // Default to branch1 for other employees
        setUserBranch("branch1")
        setCurrentBranch("branch1")
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
