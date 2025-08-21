import { NextResponse, type NextRequest } from "next/server"
import { cookies } from "next/headers"
import { getUserFromRequest, isOwner } from "@/lib/auth"
import { isAdminToolsEnabled, signAdminToken } from "@/lib/admin-auth"

export async function POST(request: NextRequest) {
  try {
    if (!isAdminToolsEnabled()) {
      return NextResponse.json({ success: false, error: "Admin tools disabled" }, { status: 403 })
    }

    const user = await getUserFromRequest(request)
    if (!user || !isOwner(user)) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json().catch(() => null)
    const passcode = body?.passcode as string | undefined
    const expected = process.env.ADMIN_TOOLS_PASSCODE

    if (!passcode || !expected || passcode !== expected) {
      return NextResponse.json({ success: false, error: "Invalid passcode" }, { status: 401 })
    }

    const token = signAdminToken({ scope: "admin_tools", userId: user.id })
    const cookieStore = cookies()
    const isProd = process.env.NODE_ENV === "production"
    cookieStore.set("admin_tools_token", token, {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 2, // 2 hours
    })

    return NextResponse.json({ success: true, message: "Admin tools enabled" })
  } catch (error) {
    console.error("Enable admin tools error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}


