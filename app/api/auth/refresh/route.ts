import { type NextRequest, NextResponse } from "next/server"
import { getUserFromRequest, generateToken } from "@/lib/auth"

export async function POST(request: NextRequest) {
  try {
    // Get user from the current token
    const user = await getUserFromRequest(request)
    
    if (!user) {
      return NextResponse.json({ success: false, error: "Invalid or expired token" }, { status: 401 })
    }

    // Generate a new token
    const newToken = generateToken(user)

    return NextResponse.json({
      success: true,
      data: {
        user,
        token: newToken,
      },
      message: "Token refreshed successfully",
    })
  } catch (error) {
    console.error("Token refresh error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
