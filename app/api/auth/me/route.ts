export const dynamic = 'force-dynamic'
import { type NextRequest, NextResponse } from "next/server"
import { getUserFromRequest } from "@/lib/auth"

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    return NextResponse.json({ success: true, data: { user } })
  } catch (error) {
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}


