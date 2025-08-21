import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"
import { query } from "./db"
import type { User } from "./types"

// Resolve JWT secret securely. In production, require NEXTAUTH_SECRET.
const RAW_JWT_SECRET = process.env.NEXTAUTH_SECRET
if (!RAW_JWT_SECRET) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("NEXTAUTH_SECRET is required in production")
  } else {
    // eslint-disable-next-line no-console
    console.warn("NEXTAUTH_SECRET is not set; using insecure development fallback")
  }
}
const JWT_SECRET: string = RAW_JWT_SECRET || "development-only-insecure-secret"
const JWT_EXPIRES_IN = "7d"

// Hash password
export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 12
  return await bcrypt.hash(password, saltRounds)
}

// Verify password
export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return await bcrypt.compare(password, hashedPassword)
}

// Generate JWT token
export function generateToken(user: User): string {
  const payload = {
    id: user.id,
    email: user.email,
    role: user.role,
    branch_id: user.branch_id,
  }

  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })
}

// Verify JWT token
export function verifyToken(token: string): { id: string; email: string; role: string; branch_id: string } {
  try {
    return jwt.verify(token, JWT_SECRET) as { id: string; email: string; role: string; branch_id: string }
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error("Token expired")
    } else if (error instanceof jwt.JsonWebTokenError) {
      throw new Error("Invalid token")
    } else {
      throw new Error("Token verification failed")
    }
  }
}

// Authenticate user
export async function authenticateUser(email: string, password: string): Promise<User | null> {
  try {
    const result = await query("SELECT * FROM users WHERE email = $1 AND is_active = true", [email])

    if (result.rows.length === 0) {
      return null
    }

    const user = result.rows[0]
    const isValidPassword = await verifyPassword(password, user.password_hash)

    if (!isValidPassword) {
      return null
    }

    // Update last login
    await query("UPDATE users SET last_login = NOW() WHERE id = $1", [user.id])

    // Remove password hash from returned user
    const { password_hash, ...userWithoutPassword } = user
    return userWithoutPassword
  } catch (error) {
    console.error("Authentication error:", error)
    return null
  }
}

// Get user by ID
export async function getUserById(id: string): Promise<User | null> {
  try {
    const result = await query(
      "SELECT id, email, full_name, role, branch_id, phone, is_active, last_login, created_at, updated_at FROM users WHERE id = $1",
      [id],
    )

    return result.rows.length > 0 ? result.rows[0] : null
  } catch (error) {
    console.error("Get user error:", error)
    return null
  }
}

// Check if user has permission for branch
export function hasPermissionForBranch(user: User, branchId: string): boolean {
  // Owner has access to all branches
  if (user.role === "owner") {
    return true
  }

  // Employee can only access their assigned branch
  return user.branch_id === branchId
}

// Check if user is owner
export function isOwner(user: User): boolean {
  return user.role === "owner"
}

// Middleware to extract user from request
export async function getUserFromRequest(request: Request): Promise<User | null> {
  try {
    const authHeader = request.headers.get("authorization") || request.headers.get("Authorization")
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.log('getUserFromRequest: No valid Authorization header found')
      return null
    }

    const token = authHeader.substring(7)
    
    try {
      const decoded = verifyToken(token)
      const user = await getUserById(decoded.id)
      
      if (user) {
        console.log(`getUserFromRequest: Successfully authenticated user ${user.email} (${user.role})`)
      } else {
        console.log('getUserFromRequest: User not found in database')
      }
      
      return user
    } catch (tokenError) {
      if (tokenError instanceof Error) {
        if (tokenError.message === "Token expired") {
          console.log('getUserFromRequest: Token expired')
        } else if (tokenError.message === "Invalid token") {
          console.log('getUserFromRequest: Invalid token format')
        } else {
          console.log('getUserFromRequest: Token verification failed:', tokenError.message)
        }
      }
      return null
    }
  } catch (error) {
    console.log('getUserFromRequest: Authentication failed:', error)
    return null
  }
}
