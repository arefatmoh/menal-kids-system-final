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
    const primaryKey = body?.primaryKey as string
    const primaryKeyValue = body?.primaryKeyValue
    const dependents = (body?.dependents || []) as Array<{ table: string; column: string }>

    if (!table || !isSafeIdentifier(table)) {
      return NextResponse.json({ success: false, error: "Invalid table" }, { status: 400 })
    }
    if (!primaryKey || !isSafeIdentifier(primaryKey)) {
      return NextResponse.json({ success: false, error: "Invalid primary key" }, { status: 400 })
    }

    await transaction(async (client) => {
      // Delete dependents first
      for (const d of dependents) {
        if (!isSafeIdentifier(d.table) || !isSafeIdentifier(d.column)) continue
        await client.query(`DELETE FROM ${d.table} WHERE ${d.column} = $1`, [primaryKeyValue])
      }

      // Audit before/after for parent delete
      const before = await client.query(`SELECT * FROM ${table} WHERE ${primaryKey} = $1`, [primaryKeyValue])
      const del = await client.query(`DELETE FROM ${table} WHERE ${primaryKey} = $1 RETURNING *`, [primaryKeyValue])

      try {
        await writeAdminAuditLog({
          request,
          user: auth.user || null,
          operation: "delete",
          tableName: table,
          primaryKey,
          primaryKeyValue,
          beforeRow: before.rows[0] ?? null,
          afterRow: del.rows[0] ?? null,
        })
      } catch {}
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ success: false, error: "Cascade delete failed" }, { status: 500 })
  }
}


