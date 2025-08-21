"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useBranch } from "@/lib/branch-context";
import apiClient from "@/lib/api-client";

const CATEGORIES = [
  "Rent",
  "Salaries",
  "Utilities",
  "Marketing",
  "Supplies",
  "Other",
];

const BRANCHES = [
  { id: "branch1", name: "Franko (Main)" },
  { id: "branch2", name: "Mebrathayl" },
];

interface Expense {
  id: string;
  branch_id?: string;
  category: string;
  amount: number;
  description?: string;
  expense_date: string;
  created_at: string;
  updated_at: string;
}

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterBranch, setFilterBranch] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [editExpense, setEditExpense] = useState<any | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [deleteExpenseId, setDeleteExpenseId] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const { currentBranch } = useBranch();
  const router = useRouter();
  const isOwner = typeof window !== 'undefined' && (localStorage.getItem("userRole") === 'owner');

  useEffect(() => {
    // Default employee view to their branch
    if (currentBranch && currentBranch !== 'all') {
      setFilterBranch(currentBranch)
    }
    fetchExpenses();
  }, [currentBranch]);

  // Refetch expenses when filters change
  useEffect(() => {
    fetchExpenses();
  }, [filterBranch, filterCategory]);

  const fetchExpenses = async () => {
    setIsLoading(true);
    try {
      const params: any = {};
      // Respect branch context for employees; owners can view All or specific
      const effectiveBranch = filterBranch !== 'all' ? filterBranch : (currentBranch !== 'all' ? currentBranch : undefined)
      if (effectiveBranch) params.branch_id = effectiveBranch;
      if (filterCategory && filterCategory !== "all") params.category = filterCategory;
      
      const res = await apiClient.getExpenses(params);
      if (res.success && res.data) {
        setExpenses(res.data as Expense[]);
      } else {
        setExpenses([]);
      }
    } catch (error) {
      console.error("Error fetching expenses:", error);
      setExpenses([]);
    }
    setIsLoading(false);
  };

  const handleEdit = (expense: any) => {
    setEditExpense({ ...expense });
    setIsEditDialogOpen(true);
  };

  const handleEditSave = async () => {
    if (!editExpense) return;
    try {
      const res = await apiClient.updateExpense(editExpense.id, {
        branch_id: editExpense.branch_id,
        category: editExpense.category,
        amount: parseFloat(editExpense.amount),
        expense_date: editExpense.expense_date,
        description: editExpense.description,
      });
      if (res.success) {
        setIsEditDialogOpen(false);
        fetchExpenses();
      } else {
        alert("Failed to update expense");
      }
    } catch (error) {
      console.error("Error updating expense:", error);
      alert("Failed to update expense");
    }
  };

  const handleDelete = async () => {
    if (!deleteExpenseId) return;
    try {
      const res = await apiClient.deleteExpense(deleteExpenseId);
      if (res.success) {
        setIsDeleteDialogOpen(false);
        fetchExpenses();
      } else {
        alert("Failed to delete expense");
      }
    } catch (error) {
      console.error("Error deleting expense:", error);
      alert("Failed to delete expense");
    }
  };

  return (
    <div className="max-w-5xl mx-auto mt-10 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Expenses</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            {isOwner ? (
              <div className="flex-1">
                <Label>Branch</Label>
                <Select value={filterBranch} onValueChange={value => { setFilterBranch(value); setTimeout(fetchExpenses, 0); }}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Branches" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Branches</SelectItem>
                    {BRANCHES.map(b => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="flex-1">
                <Label>Branch</Label>
                <Input value={BRANCHES.find(b => b.id === currentBranch)?.name || ''} disabled readOnly />
              </div>
            )}
            <div className="flex-1">
              <Label>Category</Label>
              <Select value={filterCategory} onValueChange={value => { setFilterCategory(value); setTimeout(fetchExpenses, 0); }}>
                <SelectTrigger>
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {CATEGORIES.map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-2">
              <Button onClick={() => router.push("/dashboard/expenses/add")}>Add Expense</Button>
              <Button variant="outline" onClick={fetchExpenses}>Refresh</Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Branch</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={6}>Loading...</TableCell></TableRow>
                ) : expenses.length === 0 ? (
                  <TableRow><TableCell colSpan={6}>No expenses found.</TableCell></TableRow>
                ) : expenses.map(expense => (
                  <TableRow key={expense.id}>
                    <TableCell>{BRANCHES.find(b => b.id === expense.branch_id)?.name || "All Branches"}</TableCell>
                    <TableCell><Badge>{expense.category}</Badge></TableCell>
                    <TableCell>{Number(expense.amount).toLocaleString()} Birr</TableCell>
                    <TableCell>{expense.expense_date}</TableCell>
                    <TableCell>{expense.description}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" onClick={() => handleEdit(expense)}>Edit</Button>
                      <Button size="sm" variant="destructive" className="ml-2" onClick={() => { setDeleteExpenseId(expense.id); setIsDeleteDialogOpen(true); }}>Delete</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Expense</DialogTitle>
          </DialogHeader>
          {editExpense && (
            <form className="space-y-4" onSubmit={e => { e.preventDefault(); handleEditSave(); }}>
              <div>
                <Label>Branch</Label>
                <Select value={editExpense.branch_id || ""} onValueChange={v => setEditExpense((prev: any) => ({ ...prev, branch_id: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Branch" />
                  </SelectTrigger>
                  <SelectContent>
                    {BRANCHES.map(b => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Category</Label>
                <Select value={editExpense.category} onValueChange={v => setEditExpense((prev: any) => ({ ...prev, category: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Amount</Label>
                <Input type="number" min="0" step="0.01" value={editExpense.amount} onChange={e => setEditExpense((prev: any) => ({ ...prev, amount: e.target.value }))} required />
              </div>
              <div>
                <Label>Date</Label>
                <Input type="date" value={editExpense.expense_date} onChange={e => setEditExpense((prev: any) => ({ ...prev, expense_date: e.target.value }))} required />
              </div>
              <div>
                <Label>Description</Label>
                <Input value={editExpense.description || ""} onChange={e => setEditExpense((prev: any) => ({ ...prev, description: e.target.value }))} />
              </div>
              <DialogFooter>
                <Button type="submit">Save</Button>
                <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Expense</DialogTitle>
          </DialogHeader>
          <p>Are you sure you want to delete this expense?</p>
          <DialogFooter>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}