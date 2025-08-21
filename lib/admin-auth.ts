import jwt from "jsonwebtoken"
import { cookies } from "next/headers"
import { getUserFromRequest, isOwner } from "./auth"
import type { NextRequest } from "next/server"

const JWT_SECRET = process.env.NEXTAUTH_SECRET || "your-secret-key"

export interface AdminAuthResult {
  ok: boolean
  reason?: string
  // When ok is true, user fields may be useful downstream
  user?: {
    id: string
    email: string
    role: string
  } | null
}

export function isAdminToolsEnabled(): boolean {
  return String(process.env.ADMIN_TOOLS_ENABLED).toLowerCase() === "true"
}

export function signAdminToken(payload: Record<string, unknown>): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "2h" })
}

export function verifyAdminToken(token: string): any {
  try {
    return jwt.verify(token, JWT_SECRET)
  } catch {
    return null
  }
}

export async function requireAdminTools(request: NextRequest): Promise<AdminAuthResult> {
  if (!isAdminToolsEnabled()) {
    return { ok: false, reason: "Admin tools disabled" }
  }

  const user = await getUserFromRequest(request)
  if (!user) {
    return { ok: false, reason: "Unauthorized" }
  }
  if (!isOwner(user)) {
    return { ok: false, reason: "Forbidden" }
  }

  // Require admin tools cookie
  const cookieStore = cookies()
  const token = cookieStore.get("admin_tools_token")?.value
  if (!token) {
    return { ok: false, reason: "Passcode required" }
  }

  const decoded = verifyAdminToken(token)
  if (!decoded || decoded.scope !== "admin_tools" || decoded.userId !== user.id) {
    return { ok: false, reason: "Invalid passcode session" }
  }

  return {
    ok: true,
    user: { id: user.id, email: user.email, role: user.role },
  }
}


