import { type NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"
import { requireAdminTools } from "@/lib/admin-auth"

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
    const primaryKey = searchParams.get("primaryKey")
    const primaryKeyValue = searchParams.get("primaryKeyValue")

    if (!table || !isSafeIdentifier(table)) {
      return NextResponse.json({ success: false, error: "Invalid table" }, { status: 400 })
    }
    if (!primaryKey || !isSafeIdentifier(primaryKey)) {
      return NextResponse.json({ success: false, error: "Invalid primary key" }, { status: 400 })
    }
    if (primaryKeyValue == null) {
      return NextResponse.json({ success: false, error: "Missing primary key value" }, { status: 400 })
    }

    // Find referencing tables/columns
    const refs = await query(
      `
      SELECT
        tc.table_name AS referencing_table,
        kcu.column_name AS referencing_column
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND ccu.table_schema = 'public'
        AND ccu.table_name = $1
        AND ccu.column_name = $2
      `,
      [table, primaryKey],
    )

    const dependents: Array<{ table: string; column: string; count: number; samples: unknown[] }> = []

    for (const row of refs.rows as Array<{ referencing_table: string; referencing_column: string }>) {
      const refTable = row.referencing_table
      const refCol = row.referencing_column
      if (!isSafeIdentifier(refTable) || !isSafeIdentifier(refCol)) continue
      const countRes = await query(`SELECT COUNT(*)::int AS count FROM ${refTable} WHERE ${refCol} = $1`, [primaryKeyValue])
      const count = countRes.rows[0]?.count ?? 0
      if (count > 0) {
        const sampleRes = await query(`SELECT to_jsonb(t.*) as row FROM ${refTable} t WHERE ${refCol} = $1 LIMIT 5`, [primaryKeyValue])
        const samples = sampleRes.rows.map((r: { row: unknown }) => r.row)
        dependents.push({ table: refTable, column: refCol, count, samples })
      }
    }

    return NextResponse.json({ success: true, data: { dependents } })
  } catch (error) {
    return NextResponse.json({ success: false, error: "Failed to fetch dependents" }, { status: 500 })
  }
}


