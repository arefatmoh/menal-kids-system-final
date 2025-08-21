import { type NextRequest, NextResponse } from "next/server"
import { query, transaction } from "@/lib/db"
import { requireAdminTools } from "@/lib/admin-auth"
import { writeAdminAuditLog } from "@/lib/admin-audit"

function isSafeIdentifier(name: string): boolean {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminTools(request)
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.reason || "Forbidden" }, { status: 403 })
  }

  try {
    const body = await request.json()
    const table = body?.table as string
    const soft = Boolean(body?.soft)
    const confirm = (body?.confirm as string | undefined) || ""

    if (!table || !isSafeIdentifier(table)) {
      return NextResponse.json({ success: false, error: "Invalid table" }, { status: 400 })
    }

    // simple safety: require confirm to equal table name
    if (confirm !== table) {
      return NextResponse.json({ success: false, error: "Confirmation string does not match table name" }, { status: 400 })
    }

    // prevent bulk delete on critical tables unless soft
    const critical = new Set(["users", "branches"])
    if (!soft && critical.has(table)) {
      return NextResponse.json({ success: false, error: `Hard delete disabled for critical table ${table}` }, { status: 400 })
    }

    await transaction(async (client) => {
      if (soft) {
        // ensure is_active exists
        const col = await client.query(
          `SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 AND column_name='is_active'`,
          [table],
        )
        if (col.rows.length === 0) {
          throw new Error(`Table ${table} does not support soft delete`)
        }
        const before = await client.query(`SELECT COUNT(*)::int as count FROM ${table} WHERE is_active=true`)
        await client.query(`UPDATE ${table} SET is_active=false WHERE is_active=true`)
        await writeAdminAuditLog({
          request,
          user: auth.user || null,
          operation: "soft_delete",
          tableName: table,
          beforeRow: { count: before.rows[0]?.count ?? 0 },
          afterRow: { count: 0 },
        })
      } else {
        const before = await client.query(`SELECT COUNT(*)::int as count FROM ${table}`)
        await client.query(`TRUNCATE TABLE ${table} RESTART IDENTITY CASCADE`)
        await writeAdminAuditLog({
          request,
          user: auth.user || null,
          operation: "delete",
          tableName: table,
          beforeRow: { count: before.rows[0]?.count ?? 0 },
          afterRow: { count: 0 },
        })
      }
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || "Bulk delete failed" }, { status: 400 })
  }
}


