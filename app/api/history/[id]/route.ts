export const dynamic = 'force-dynamic'
import { type NextRequest, NextResponse } from "next/server"
import { getUserFromRequest, hasPermissionForBranch, isOwner } from "@/lib/auth"
import { query } from "@/lib/db"

// GET /api/history/[id] - get activity detail
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getUserFromRequest(_request)
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const id = params.id
    const result = await query("SELECT * FROM get_activity_detail($1)", [id])
    if (result.rowCount === 0) {
      return NextResponse.json({ success: false, error: "Activity not found" }, { status: 404 })
    }

    const activity: any = result.rows[0]
    // Employees can only access activities in their branch
    if (user.role === 'employee' && activity.branch_id && !hasPermissionForBranch(user, activity.branch_id)) {
      return NextResponse.json({ success: false, error: "Access denied to this branch" }, { status: 403 })
    }

    // Enrich with human-friendly fields (branch name, user email/name)
    try {
      if (activity.branch_id) {
        const b = await query('SELECT name FROM branches WHERE id = $1', [activity.branch_id])
        activity.branch_name = b.rows?.[0]?.name || null
      }
      if (activity.user_id) {
        const u = await query('SELECT email, full_name FROM users WHERE id = $1', [activity.user_id])
        activity.user_email = u.rows?.[0]?.email || null
        activity.user_full_name = u.rows?.[0]?.full_name || null
      }

      // Normalize items (from detail or delta)
      const rawItems: any[] = Array.isArray(activity.items)
        ? activity.items
        : (activity.delta && Array.isArray(activity.delta.items) ? activity.delta.items : [])

      if (rawItems.length > 0) {
        const productIds = Array.from(new Set(rawItems.map(it => String(it.product_id)).filter(Boolean)))
        const variationIds = Array.from(new Set(rawItems.map(it => it.variation_id ? String(it.variation_id) : null).filter(Boolean)))

        let productMap: Record<string, { name: string; sku: string | null }> = {}
        let variationMap: Record<string, { name: string }> = {}

        if (productIds.length > 0) {
          const pRes = await query(
            'SELECT id::text as id, name, sku FROM products WHERE id::text = ANY($1::text[])',
            [productIds]
          )
          productMap = Object.fromEntries(pRes.rows.map((r: any) => [r.id, { name: r.name, sku: r.sku }]))
        }
        if (variationIds.length > 0) {
          const vRes = await query(
            'SELECT id::text as id, color, size FROM product_variations WHERE id::text = ANY($1::text[])',
            [variationIds]
          )
          variationMap = Object.fromEntries(
            vRes.rows.map((r: any) => [r.id, { name: [r.color, r.size].filter(Boolean).join(' - ') }])
          )
        }

        activity.items = rawItems.map((it: any) => {
          const p = it.product_id ? productMap[String(it.product_id)] : undefined
          const v = it.variation_id ? variationMap[String(it.variation_id)] : undefined
          return {
            product_id: it.product_id,
            product_name: p?.name || it.product_name || String(it.product_id),
            sku: p?.sku || it.sku || null,
            variation_id: it.variation_id || null,
            variation_name: v?.name || it.variation_name || null,
            quantity: it.quantity ?? it.qty ?? null,
            unit_price: it.unit_price ?? it.price ?? null,
            subtotal: it.subtotal ?? null,
          }
        })
      }
    } catch {
      // Enrichment is best-effort; ignore errors
    }

    return NextResponse.json({ success: true, data: activity })
  } catch (error) {
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}

// PATCH /api/history/[id] - update basic fields like title/description
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }
    if (!isOwner(user)) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 })
    }

    const id = params.id
    const body = await request.json().catch(() => ({} as any))
    const title = typeof body.title === 'string' ? body.title : undefined
    const description = typeof body.description === 'string' ? body.description : undefined
    if (title === undefined && description === undefined) {
      return NextResponse.json({ success: false, error: "Nothing to update" }, { status: 400 })
    }

    // Load to enforce branch permissions
    const actRes = await query("SELECT id, branch_id FROM activities WHERE id = $1", [id])
    if (actRes.rowCount === 0) {
      return NextResponse.json({ success: false, error: "Activity not found" }, { status: 404 })
    }
    const act = actRes.rows[0]
    if (user.role === 'employee' && act.branch_id && !hasPermissionForBranch(user, String(act.branch_id))) {
      return NextResponse.json({ success: false, error: "Access denied to this branch" }, { status: 403 })
    }

    // Build dynamic update
    const sets: string[] = []
    const values: any[] = []
    let idx = 1
    if (title !== undefined) { sets.push(`title = $${idx++}`); values.push(title) }
    if (description !== undefined) { sets.push(`description = $${idx++}`); values.push(description) }
    values.push(id)
    const sql = `UPDATE activities SET ${sets.join(", ")}, updated_at = NOW() WHERE id = $${idx} RETURNING id`
    await query(sql, values)

    const result = await query("SELECT * FROM get_activity_detail($1)", [id])
    return NextResponse.json({ success: true, data: result.rows?.[0] })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || "Internal server error" }, { status: 500 })
  }
}


