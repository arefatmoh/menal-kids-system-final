import { NextResponse } from "next/server"
import { query } from "@/lib/db"

export async function GET() {
  try {
    await query("SELECT 1")
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "db" }, { status: 500 })
  }
}


