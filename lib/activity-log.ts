import { query } from "./db"

export type ActivityType =
  | 'sell'
  | 'stock_add'
  | 'stock_reduce'
  | 'product_create'
  | 'product_update'
  | 'expense_add'
  | 'transfer'
  | 'refund'
  | 'restore'
  | 'edit_correction'

export interface LogActivityParams {
  type: ActivityType
  title?: string
  description?: string
  status?: 'completed' | 'reversed'
  branch_id?: string | null
  user_id?: string | null
  related_entity_type?: string | null
  related_entity_id?: string | null
  delta?: Record<string, unknown> | null
  metadata?: Record<string, unknown> | null
  parent_activity_id?: string | null
}

export async function logActivity(params: LogActivityParams): Promise<void> {
  try {
    await query(
      `INSERT INTO activities (
        type, title, description, status,
        branch_id, user_id,
        related_entity_type, related_entity_id,
        delta, metadata, parent_activity_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11)`,
      [
        params.type,
        params.title || null,
        params.description || null,
        params.status || 'completed',
        params.branch_id || null,
        params.user_id || null,
        params.related_entity_type || null,
        params.related_entity_id || null,
        params.delta ? JSON.stringify(params.delta) : null,
        params.metadata ? JSON.stringify(params.metadata) : null,
        params.parent_activity_id || null,
      ]
    )
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      // Surface insert issues during development
      // eslint-disable-next-line no-console
      console.warn('logActivity insert failed:', (err as any)?.message || err)
    }
    // Never throw from logging in production paths
  }
}


