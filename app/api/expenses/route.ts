import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest, hasPermissionForBranch } from "@/lib/auth";
import { query } from "@/lib/db";
import { z } from "zod";

const CATEGORIES = [
  "rent",
  "salaries",
  "utilities",
  "marketing",
  "supplies",
  "other",
];

const expenseSchema = z.object({
  branch_id: z.string().optional(),
  category: z.enum(["rent", "salaries", "utilities", "marketing", "supplies", "other"]),
  amount: z.number().positive(),
  description: z.string().optional(),
  expense_date: z.string(), // ISO date
});

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get("branch_id");
    const category = searchParams.get("category");
    let sql = `SELECT * FROM expenses WHERE 1=1`;
    const params: any[] = [];
    if (branchId) {
      sql += ` AND branch_id = $${params.length + 1}`;
      params.push(branchId);
    }
    if (category) {
      sql += ` AND category = $${params.length + 1}`;
      params.push(category);
    }
    sql += ` ORDER BY expense_date DESC, created_at DESC`;
    const result = await query(sql, params);
    return NextResponse.json({ success: true, data: result.rows });
  } catch (error) {
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

async function tableHasColumn(table: string, column: string): Promise<boolean> {
  const res = await query(
    `SELECT 1 FROM information_schema.columns WHERE table_name = $1 AND column_name = $2 LIMIT 1`,
    [table, column],
  );
  return res.rowCount > 0;
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const body = await request.json();
    const data = expenseSchema.parse(body);

    // Default employee expenses to their own branch when branch_id is omitted
    const effectiveBranchId = data.branch_id ?? (user.role === 'employee' ? user.branch_id : null);

    if (effectiveBranchId && !hasPermissionForBranch(user, effectiveBranchId)) {
      return NextResponse.json({ success: false, error: "Access denied to this branch" }, { status: 403 });
    }
    const hasCreatedBy = await tableHasColumn('expenses', 'created_by');
    const hasUserId = await tableHasColumn('expenses', 'user_id');

    let result;
    if (hasCreatedBy) {
      result = await query(
        `INSERT INTO expenses (branch_id, category, amount, description, expense_date, created_by)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [
          effectiveBranchId || null,
          data.category,
          data.amount,
          data.description || null,
          data.expense_date,
          user.id,
        ]
      );
    } else if (hasUserId) {
      result = await query(
        `INSERT INTO expenses (branch_id, category, amount, description, expense_date, user_id)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [
          effectiveBranchId || null,
          data.category,
          data.amount,
          data.description || null,
          data.expense_date,
          user.id,
        ]
      );
    } else {
      result = await query(
        `INSERT INTO expenses (branch_id, category, amount, description, expense_date)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [
          effectiveBranchId || null,
          data.category,
          data.amount,
          data.description || null,
          data.expense_date,
        ]
      );
    }
    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Create expense error:', error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const body = await request.json();
    const { id, ...rest } = body;
    const data = expenseSchema.parse(rest);

    const effectiveBranchId = data.branch_id ?? (user.role === 'employee' ? user.branch_id : null);

    if (effectiveBranchId && !hasPermissionForBranch(user, effectiveBranchId)) {
      return NextResponse.json({ success: false, error: "Access denied to this branch" }, { status: 403 });
    }
    const hasCreatedBy = await tableHasColumn('expenses', 'created_by');

    const result = await query(
      `UPDATE expenses SET branch_id = $1, category = $2, amount = $3, description = $4, expense_date = $5${hasCreatedBy ? '' : ''}, updated_at = NOW()
       WHERE id = $6 RETURNING *`,
      [
        effectiveBranchId || null,
        data.category,
        data.amount,
        data.description || null,
        data.expense_date,
        id,
      ]
    );
    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Update expense error:', error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ success: false, error: "Expense ID required" }, { status: 400 });
    }
    await query(`DELETE FROM expenses WHERE id = $1`, [id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}