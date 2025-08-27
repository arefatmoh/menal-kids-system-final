"use client"

import React, { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Heart, ShoppingBag, Loader2, Eye, EyeOff } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useLanguage } from "@/lib/language-context"
import apiClient from "@/lib/api-client"
import Lottie from "lottie-react"
import welcomeAnim from "@/public/welcome.json"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false)
  const router = useRouter()
  const { t } = useLanguage()
  const { toast } = useToast()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!email || !password) {
      toast({
        title: `🚨 ${t("error")}`,
        description: t("fillAllFields"),
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)
    try {
      const response = await apiClient.login(email, password)
      if (response.success) {
        const data = response.data as { token: string; user: any }
        apiClient.setToken(data.token)
        localStorage.setItem("userRole", data.user.role)
        localStorage.setItem("userEmail", data.user.email)
        localStorage.setItem("userBranchId", data.user.branch_id || "all")
        localStorage.setItem("userName", data.user.full_name)

        toast({
          title: `🎉 ${t("loginSuccessfulTitle")}`,
          description: t("loginSuccessfulDesc"),
        })

        // Use full reload to ensure context/providers pick up new branch assignment immediately
        if (typeof window !== "undefined") {
          window.location.replace("/dashboard")
        } else {
          router.push("/dashboard")
        }
      } else {
        toast({
          title: `❌ ${t("loginFailedTitle")}`,
          description: response.error || t("invalidCredentials"),
          variant: "destructive",
        })
      }
    } catch (error: any) {
      toast({
        title: `😵 ${t("error")}`,
        description: error.message || t("loginErrorDesc"),
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const togglePasswordVisibility = () => setShowPassword((prev) => !prev)

  // Detect mobile virtual keyboard and input focus to prevent footer overlap
  useEffect(() => {
    const handleFocusIn = (event: Event) => {
      const target = event.target as HTMLElement | null
      if (!target) return
      const isFormField = ["INPUT", "TEXTAREA"].includes(target.tagName)
      if (isFormField) setIsKeyboardOpen(true)
    }

    const handleFocusOut = () => {
      // Delay slightly, then only close if no input remains focused
      setTimeout(() => {
        const active = document.activeElement as HTMLElement | null
        const stillOnField = !!active && ["INPUT", "TEXTAREA"].includes(active.tagName)
        if (!stillOnField) {
          setIsKeyboardOpen(false)
        }
      }, 100)
    }

    document.addEventListener("focusin", handleFocusIn)
    document.addEventListener("focusout", handleFocusOut)

    let baseline = 0
    const vv = (typeof window !== "undefined" ? (window as any).visualViewport : null) as VisualViewport | null
    if (vv) {
      baseline = vv.height
      const onResize = () => {
        const heightDrop = baseline - vv.height
        // Heuristic: if viewport shrinks significantly, keyboard is likely open
        setIsKeyboardOpen(heightDrop > 120)
      }
      vv.addEventListener("resize", onResize)
      return () => {
        document.removeEventListener("focusin", handleFocusIn)
        document.removeEventListener("focusout", handleFocusOut)
        vv.removeEventListener("resize", onResize)
      }
    }

    return () => {
      document.removeEventListener("focusin", handleFocusIn)
      document.removeEventListener("focusout", handleFocusOut)
    }
  }, [])

  return (
    <div className={`relative min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-indigo-50 flex flex-col justify-center items-center p-4 overflow-hidden ${isKeyboardOpen ? 'pb-24' : ''}`}>
      {/* Floating Blobs */}
      <motion.div animate={{ y: [0, 20, 0] }} transition={{ duration: 6, repeat: Infinity }}
        className="absolute top-20 left-20 w-32 h-32 bg-pink-300 opacity-20 rounded-full z-0" />
      <motion.div animate={{ y: [0, 15, 0] }} transition={{ duration: 5, repeat: Infinity }}
        className="absolute bottom-10 right-10 w-24 h-24 bg-purple-400 opacity-20 rounded-full z-0" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.7 }}
        className="z-10 w-full max-w-md mb-6"
      >
        <Card className="border-0 bg-white/90 backdrop-blur-sm shadow-2xl rounded-3xl">
          <CardHeader className="text-center space-y-4">
            <Lottie
              animationData={welcomeAnim}
              className="w-52 sm:w-60 md:w-70 lg:w-78 mx-auto"
            />
            <div className="flex items-center justify-center space-x-2">
              <div className="bg-gradient-to-r from-pink-400 to-purple-500 p-3 rounded-full shadow-md">
                <ShoppingBag className="h-8 w-8 text-white" />
              </div>
              <Heart className="h-6 w-6 text-pink-400 animate-pulse" />
            </div>
            <div>
              <CardTitle className="text-3xl font-extrabold bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent tracking-wide">
                Menal Kids Shop
              </CardTitle>
              <CardDescription className="text-gray-600 mt-2 text-sm">{t("welcomeBack")}</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email">{t("email")}</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder={t("email")}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="rounded-2xl border-gray-200 focus:border-pink-300 focus:ring-pink-200 transition-all duration-150"
                  required
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">{t("password")}</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder={t("password")}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="rounded-2xl border-gray-200 focus:border-pink-300 focus:ring-pink-200 pr-10"
                    required
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={togglePasswordVisibility}
                    className="absolute inset-y-0 right-0 flex items-center px-3 z-10 text-pink-500 hover:text-purple-600 transition-colors"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5 hover:scale-110 transition-transform duration-150" />
                    ) : (
                      <Eye className="h-5 w-5 hover:scale-110 transition-transform duration-150" />
                    )}
                  </button>
                </div>
              </div>
              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white rounded-2xl py-3 font-semibold transition-all duration-200 transform hover:scale-[1.03] shadow-lg"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t("signingIn")}
                  </>
                ) : (
                  t("signIn")
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </motion.div>
              <div className={`absolute bottom-12 text-center w-full text-xs text-gray-500 z-10 space-y-1 ${isKeyboardOpen ? "hidden" : "block"}`}>
          <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-white/60 backdrop-blur-sm shadow-md">
            <img src="/sarfus.png" alt="Sarfus Logo" className="h-4 w-4" />
            <span className="text-gray-600 font-medium">
              Developed by <span className="text-pink-500 font-semibold">Sarfus Innovation</span>
            </span>
          </div>
          <div className="text-[11px] text-gray-500">
            📞 +251-937-10-6996 · ✉️ arefatmohammed161@gmail.com
          </div>
        </div>
    </div>
  )
}
