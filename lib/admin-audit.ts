import { query } from "./db"
import type { NextRequest } from "next/server"

export type AdminOperation = "insert" | "update" | "delete" | "soft_delete"

export interface AdminAuditParams {
  request: NextRequest
  user: { id: string; email: string } | null
  operation: AdminOperation
  tableName: string
  primaryKey?: string
  primaryKeyValue?: unknown
  beforeRow?: Record<string, unknown> | null
  afterRow?: Record<string, unknown> | null
}

async function ensureAuditTable(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS admin_audit_log (
      id BIGSERIAL PRIMARY KEY,
      user_id TEXT,
      user_email TEXT,
      operation TEXT NOT NULL,
      table_name TEXT NOT NULL,
      primary_key TEXT,
      primary_key_value TEXT,
      before_row JSONB,
      after_row JSONB,
      ip TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)
}

export async function writeAdminAuditLog(params: AdminAuditParams): Promise<void> {
  try {
    await ensureAuditTable()
    const ip = params.request.headers.get("x-forwarded-for") || params.request.headers.get("x-real-ip") || ""
    await query(
      `INSERT INTO admin_audit_log
       (user_id, user_email, operation, table_name, primary_key, primary_key_value, before_row, after_row, ip)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9)`,
      [
        params.user?.id ?? null,
        params.user?.email ?? null,
        params.operation,
        params.tableName,
        params.primaryKey ?? null,
        params.primaryKeyValue != null ? String(params.primaryKeyValue) : null,
        params.beforeRow ? JSON.stringify(params.beforeRow) : null,
        params.afterRow ? JSON.stringify(params.afterRow) : null,
        ip,
      ],
    )
  } catch (err) {
    // Logging must never crash the main operation
    console.warn("Admin audit log failed:", err)
  }
}


