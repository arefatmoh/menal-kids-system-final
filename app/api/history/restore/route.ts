export const dynamic = 'force-dynamic'
import { type NextRequest, NextResponse } from "next/server"
import { getUserFromRequest, hasPermissionForBranch } from "@/lib/auth"
import { query } from "@/lib/db"

// POST /api/history/restore - body: { activity_id: string, reason?: string, dry_run?: boolean }
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const activityId = body.activity_id as string | undefined
    const reason = (body.reason as string | undefined) || 'Restore via API'
    const dryRun = Boolean(body.dry_run)
    if (!activityId) {
      return NextResponse.json({ success: false, error: "activity_id is required" }, { status: 400 })
    }

    // Fetch the activity to apply branch-based permission for employees
    const actRes = await query("SELECT id, branch_id FROM activities WHERE id = $1", [activityId])
    if (actRes.rowCount === 0) {
      return NextResponse.json({ success: false, error: "Activity not found" }, { status: 404 })
    }
    const act = actRes.rows[0]
    if (user.role === 'employee' && act.branch_id && !hasPermissionForBranch(user, String(act.branch_id))) {
      return NextResponse.json({ success: false, error: "Access denied to this branch" }, { status: 403 })
    }

    if (dryRun) {
      // Preview the activity details so the UI can show what will be affected
      const previewRes = await query("SELECT * FROM get_activity_detail($1)", [activityId])
      const preview = previewRes.rows?.[0] || null
      return NextResponse.json({ success: true, dry_run: true, message: "Dry run only. No changes applied.", data: preview })
    }

    // Execute restore
    const result = await query("SELECT * FROM restore_activity($1, $2, $3)", [activityId, user.id, reason])
    const row = result.rows?.[0]
    return NextResponse.json({ success: true, data: row })
  } catch (error) {
    console.error("Restore error:", (error as any)?.message || error)
    return NextResponse.json({ success: false, error: (error as any)?.message || "Internal server error" }, { status: 500 })
  }
}


