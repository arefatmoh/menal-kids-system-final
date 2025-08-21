import { NextResponse, type NextRequest } from "next/server"
import { query } from "@/lib/db"
import { requireAdminTools } from "@/lib/admin-auth"

const SENSITIVE_TABLES = new Set<string>(["auth_tokens", "sessions", "secrets"]) // extend as needed

export async function GET(request: NextRequest) {
  const auth = await requireAdminTools(request)
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.reason || "Forbidden" }, { status: 403 })
  }

  try {
    // Fetch tables and columns
    const tablesResult = await query(
      `
      SELECT table_schema, table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name
      `,
    )

    const tables = tablesResult.rows
      .map((r: any) => r.table_name as string)
      .filter((t: string) => !SENSITIVE_TABLES.has(t))

    const columnsResult = await query(
      `
      SELECT table_name, column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
      ORDER BY table_name, ordinal_position
      `,
    )

    const columnsByTable: Record<string, any[]> = {}
    for (const row of columnsResult.rows) {
      if (!columnsByTable[row.table_name]) columnsByTable[row.table_name] = []
      columnsByTable[row.table_name].push({
        name: row.column_name,
        type: row.data_type,
        nullable: row.is_nullable === "YES",
      })
    }

    return NextResponse.json({ success: true, data: { tables, columnsByTable } })
  } catch (error) {
    console.error("Admin tables error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}


