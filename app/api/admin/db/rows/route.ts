import { NextResponse, type NextRequest } from "next/server"
import { query } from "@/lib/db"
import { requireAdminTools } from "@/lib/admin-auth"
import { writeAdminAuditLog } from "@/lib/admin-audit"
import { getFriendlyPgError } from "@/lib/pg-error"

const REDACT_COLUMNS = new Set<string>(["password_hash", "token", "secret"]) // extend as needed

function isSafeIdentifier(name: string): boolean {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)
}

export async function GET(request: NextRequest) {
  const auth = await requireAdminTools(request)
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.reason || "Forbidden" }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const table = searchParams.get("table")
    const page = Number(searchParams.get("page") || "1")
    const limit = Math.min(Number(searchParams.get("limit") || "25"), 200)
    const offset = (page - 1) * limit

    if (!table || !isSafeIdentifier(table)) {
      return NextResponse.json({ success: false, error: "Invalid table" }, { status: 400 })
    }

    const countResult = await query(`SELECT COUNT(*)::int as count FROM ${table}`)
    const rowsResult = await query(`SELECT * FROM ${table} ORDER BY 1 LIMIT $1 OFFSET $2`, [limit, offset])

    // Redact sensitive columns
    const redacted = rowsResult.rows.map((row: Record<string, unknown>) => {
      const copy: Record<string, unknown> = { ...row }
      for (const key of Object.keys(copy)) {
        if (REDACT_COLUMNS.has(key)) {
          copy[key] = "***"
        }
      }
      return copy
    })

    return NextResponse.json({
      success: true,
      data: {
        rows: redacted,
        total: countResult.rows[0]?.count ?? 0,
        page,
        limit,
      },
    })
  } catch (error) {
    const friendly = getFriendlyPgError(error)
    return NextResponse.json({ success: false, error: friendly.message, code: friendly.code }, { status: friendly.status })
  }
}

export async function PUT(request: NextRequest) {
  const auth = await requireAdminTools(request)
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.reason || "Forbidden" }, { status: 403 })
  }

  try {
    const body = await request.json()
    const table = body?.table as string
    const primaryKey = body?.primaryKey as string
    const primaryKeyValue = body?.primaryKeyValue
    const updates = body?.updates as Record<string, unknown>

    if (!table || !isSafeIdentifier(table)) {
      return NextResponse.json({ success: false, error: "Invalid table" }, { status: 400 })
    }
    if (!primaryKey || !isSafeIdentifier(primaryKey)) {
      return NextResponse.json({ success: false, error: "Invalid primary key" }, { status: 400 })
    }
    if (!updates || typeof updates !== "object") {
      return NextResponse.json({ success: false, error: "Invalid updates" }, { status: 400 })
    }

    // Remove redacted fields and disallow editing of obvious sensitive columns
    for (const key of Object.keys(updates)) {
      if (REDACT_COLUMNS.has(key)) {
        delete updates[key]
      }
    }

    const setFragments: string[] = []
    const values: unknown[] = []
    let paramIndex = 1
    for (const [key, value] of Object.entries(updates)) {
      if (!isSafeIdentifier(key)) continue
      setFragments.push(`${key} = $${paramIndex++}`)
      values.push(value)
    }

    if (setFragments.length === 0) {
      return NextResponse.json({ success: false, error: "No valid fields to update" }, { status: 400 })
    }

    values.push(primaryKeyValue)
    const sql = `UPDATE ${table} SET ${setFragments.join(", ")} WHERE ${primaryKey} = $${paramIndex} RETURNING *`
    const result = await query(sql, values)

    // Audit
    try {
      const before = await query(`SELECT * FROM ${table} WHERE ${primaryKey} = $1`, [primaryKeyValue])
      await writeAdminAuditLog({
        request,
        user: auth.user || null,
        operation: "update",
        tableName: table,
        primaryKey,
        primaryKeyValue,
        beforeRow: before.rows[0] ?? null,
        afterRow: result.rows[0] ?? null,
      })
    } catch {}

    return NextResponse.json({ success: true, data: result.rows[0] })
  } catch (error) {
    const friendly = getFriendlyPgError(error)
    return NextResponse.json({ success: false, error: friendly.message, code: friendly.code }, { status: friendly.status })
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminTools(request)
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.reason || "Forbidden" }, { status: 403 })
  }

  try {
    const body = await request.json()
    const table = body?.table as string
    const values = (body?.values || {}) as Record<string, unknown>

    if (!table || !isSafeIdentifier(table)) {
      return NextResponse.json({ success: false, error: "Invalid table" }, { status: 400 })
    }

    // Fetch valid columns to constrain insert
    const colsRes = await query(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position`,
      [table],
    )
    const validColumns = new Set<string>(colsRes.rows.map((r: { column_name: string }) => r.column_name))

    const columns: string[] = []
    const params: unknown[] = []
    // parameter index inferred via position in params array
    for (const [key, val] of Object.entries(values)) {
      if (!isSafeIdentifier(key)) continue
      if (!validColumns.has(key)) continue
      if (REDACT_COLUMNS.has(key)) continue
      columns.push(key)
      params.push(val)
    }

    if (columns.length === 0) {
      return NextResponse.json({ success: false, error: "No valid fields to insert" }, { status: 400 })
    }

    const placeholders = columns.map((_, idx) => `$${idx + 1}`).join(", ")
    const sql = `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders}) RETURNING *`
    const result = await query(sql, params)

    // Audit
    try {
      await writeAdminAuditLog({
        request,
        user: auth.user || null,
        operation: "insert",
        tableName: table,
        primaryKey: undefined,
        primaryKeyValue: undefined,
        beforeRow: null,
        afterRow: result.rows[0] ?? null,
      })
    } catch {}

    return NextResponse.json({ success: true, data: result.rows[0] })
  } catch (error) {
    const friendly = getFriendlyPgError(error)
    return NextResponse.json({ success: false, error: friendly.message, code: friendly.code }, { status: friendly.status })
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAdminTools(request)
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.reason || "Forbidden" }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const table = searchParams.get("table")
    const primaryKey = searchParams.get("primaryKey")
    const primaryKeyValue = searchParams.get("primaryKeyValue")
    const soft = (searchParams.get("soft") || "false").toLowerCase() === "true"

    if (!table || !isSafeIdentifier(table)) {
      return NextResponse.json({ success: false, error: "Invalid table" }, { status: 400 })
    }
    if (!primaryKey || !isSafeIdentifier(primaryKey)) {
      return NextResponse.json({ success: false, error: "Invalid primary key" }, { status: 400 })
    }
    if (primaryKeyValue === null) {
      return NextResponse.json({ success: false, error: "Missing primary key value" }, { status: 400 })
    }

    if (soft) {
      // Verify table has is_active column
      const colCheck = await query(
        `SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 AND column_name='is_active' LIMIT 1`,
        [table],
      )
      if (colCheck.rows.length === 0) {
        return NextResponse.json({ success: false, error: `Table ${table} does not support soft delete (missing is_active)` }, { status: 400 })
      }
      const before = await query(`SELECT * FROM ${table} WHERE ${primaryKey} = $1`, [primaryKeyValue])
      const upd = await query(`UPDATE ${table} SET is_active=false WHERE ${primaryKey} = $1 RETURNING *`, [primaryKeyValue])

      // Audit
      try {
        await writeAdminAuditLog({
          request,
          user: auth.user || null,
          operation: "soft_delete",
          tableName: table,
          primaryKey,
          primaryKeyValue,
          beforeRow: before.rows[0] ?? null,
          afterRow: upd.rows[0] ?? null,
        })
      } catch {}

      return NextResponse.json({ success: true, data: upd.rows[0] || null, message: "Archived (is_active=false)" })
    }

    try {
      const sql = `DELETE FROM ${table} WHERE ${primaryKey} = $1 RETURNING *`
      const before = await query(`SELECT * FROM ${table} WHERE ${primaryKey} = $1`, [primaryKeyValue])
      const result = await query(sql, [primaryKeyValue])

      // Audit
      try {
        await writeAdminAuditLog({
          request,
          user: auth.user || null,
          operation: "delete",
          tableName: table,
          primaryKey,
          primaryKeyValue,
          beforeRow: before.rows[0] ?? null,
          afterRow: result.rows[0] ?? null,
        })
      } catch {}

      return NextResponse.json({ success: true, data: result.rows[0] || null })
    } catch (err: unknown) {
      // FK violation handling
      const anyErr = err as { code?: string; detail?: string; constraint?: string; table?: string }
      const code = anyErr?.code
      if (code === '23503') {
        return NextResponse.json(
          {
            success: false,
            error: "Foreign key constraint prevents deletion",
            code: '23503',
            detail: anyErr?.detail,
            constraint: anyErr?.constraint,
            referenced_table: anyErr?.table,
          },
          { status: 409 },
        )
      }
      throw anyErr
    }
  } catch (error) {
    const friendly = getFriendlyPgError(error)
    return NextResponse.json({ success: false, error: friendly.message, code: friendly.code }, { status: friendly.status })
  }
}


