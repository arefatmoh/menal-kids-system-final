import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { LanguageProvider } from "@/lib/language-context"
import { BranchProvider } from "@/lib/branch-context"
import { AlertsProvider } from "@/lib/alerts-context"
import { Toaster } from "@/components/ui/toaster"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Menal Kids Shop - Dashboard",
  description: "Internal dashboard for managing kids clothing inventory",
    generator: 'v0.dev'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="am">
      <body className={inter.className}>
        <LanguageProvider>
          <BranchProvider>
            <AlertsProvider>
              {children}
              <Toaster />
            </AlertsProvider>
          </BranchProvider>
        </LanguageProvider>
      </body>
    </html>
  )
}
