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
import { useLanguage } from "@/lib/language-context";
import { getBranchIdForDatabase, getFrontendBranchName } from "@/lib/utils";

const CATEGORIES = [
  "rent",
  "salaries",
  "utilities",
  "marketing",
  "supplies",
  "other",
];

const BRANCHES = [
  { id: "franko", name: "Franko (Main)" },
  { id: "mebrat-hayl", name: "Mebrathayl" },
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
  const { t } = useLanguage();
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
      if (effectiveBranch) params.branch_id = getBranchIdForDatabase(effectiveBranch);
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
    const mappedBranchId = expense.branch_id ? getFrontendBranchName(expense.branch_id) : "";
    setEditExpense({ ...expense, branch_id: mappedBranchId });
    setIsEditDialogOpen(true);
  };

  const handleEditSave = async () => {
    if (!editExpense) return;
    try {
      const res = await apiClient.updateExpense(editExpense.id, {
        branch_id: editExpense.branch_id ? getBranchIdForDatabase(editExpense.branch_id) : undefined,
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
    <div className="max-w-5xl mx-auto mt-6 sm:mt-10 px-4 sm:px-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl sm:text-2xl">{t("expenses" as any) || "Expenses"}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col space-y-4 sm:space-y-0 sm:flex-row sm:gap-4 mb-6">
            {isOwner ? (
              <div className="w-full sm:flex-1">
                <Label className="text-sm font-medium text-gray-700 mb-2 block">{t("branch") || "Branch"}</Label>
                <Select value={filterBranch} onValueChange={value => { setFilterBranch(value); setTimeout(fetchExpenses, 0); }}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t("allBranches") || "All Branches"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("allBranches") || "All Branches"}</SelectItem>
                    {BRANCHES.map(b => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="w-full sm:flex-1">
                <Label className="text-sm font-medium text-gray-700 mb-2 block">{t("branch") || "Branch"}</Label>
                <Input value={BRANCHES.find(b => b.id === currentBranch)?.name || ''} disabled readOnly className="w-full" />
              </div>
            )}
            <div className="w-full sm:flex-1">
              <Label className="text-sm font-medium text-gray-700 mb-2 block">{t("category")}</Label>
              <Select value={filterCategory} onValueChange={value => { setFilterCategory(value); setTimeout(fetchExpenses, 0); }}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("allCategories") || "All Categories"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("allCategories") || "All Categories"}</SelectItem>
                  {CATEGORIES.map(cat => (
                    <SelectItem key={cat} value={cat}>{t(cat as any)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-2 w-full sm:w-auto">
              <Button onClick={() => router.push("/dashboard/expenses/add")} className="w-full sm:w-auto">{t("addExpense" as any) || "Add Expense"}</Button>
              <Button variant="outline" onClick={fetchExpenses} className="w-full sm:w-auto">{t("refresh")}</Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs sm:text-sm font-semibold">{t("branch") || "Branch"}</TableHead>
                  <TableHead className="text-xs sm:text-sm font-semibold">{t("category")}</TableHead>
                  <TableHead className="text-xs sm:text-sm font-semibold">{t("amount" as any) || "Amount"}</TableHead>
                  <TableHead className="text-xs sm:text-sm font-semibold">{t("date" as any) || "Date"}</TableHead>
                  <TableHead className="text-xs sm:text-sm font-semibold">{t("descriptionLabel" as any) || "Description"}</TableHead>
                  <TableHead className="text-xs sm:text-sm font-semibold">{t("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-xs sm:text-sm">{t("loading" as any) || "Loading..."}</TableCell></TableRow>
                ) : expenses.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-xs sm:text-sm">{t("noExpensesFound" as any) || "No expenses found."}</TableCell></TableRow>
                ) : expenses.map(expense => (
                  <TableRow key={expense.id}>
                    <TableCell className="text-xs sm:text-sm">{
                      (() => {
                        const frontendId = expense.branch_id ? getFrontendBranchName(expense.branch_id) : "all";
                        const name = BRANCHES.find(b => b.id === frontendId)?.name;
                        return name || (t("allBranches") || "All Branches");
                      })()
                    }</TableCell>
                    <TableCell className="text-xs sm:text-sm"><Badge className="text-xs">{t(expense.category as any)}</Badge></TableCell>
                    <TableCell className="text-xs sm:text-sm font-medium">{Number(expense.amount).toLocaleString()} ብር</TableCell>
                    <TableCell className="text-xs sm:text-sm">{expense.expense_date}</TableCell>
                    <TableCell className="text-xs sm:text-sm max-w-[150px] truncate">{expense.description}</TableCell>
                    <TableCell>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <Button size="sm" variant="outline" onClick={() => handleEdit(expense)} className="text-xs h-8 px-2">{t("edit")}</Button>
                        <Button size="sm" variant="destructive" onClick={() => { setDeleteExpenseId(expense.id); setIsDeleteDialogOpen(true); }} className="text-xs h-8 px-2">{t("delete")}</Button>
                      </div>
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
        <DialogContent className="w-[95vw] max-w-md sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl">{t("editExpense" as any) || "Edit Expense"}</DialogTitle>
          </DialogHeader>
          {editExpense && (
            <form className="space-y-4" onSubmit={e => { e.preventDefault(); handleEditSave(); }}>
              <div>
                <Label className="text-sm font-medium text-gray-700 mb-2 block">{t("branch") || "Branch"}</Label>
                <Select value={editExpense.branch_id || ""} onValueChange={v => setEditExpense((prev: any) => ({ ...prev, branch_id: v }))}>
                  <SelectTrigger className="w-full">
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
                <Label className="text-sm font-medium text-gray-700 mb-2 block">{t("category")}</Label>
                <Select value={editExpense.category} onValueChange={v => setEditExpense((prev: any) => ({ ...prev, category: v }))}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select Category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(cat => (
                      <SelectItem key={cat} value={cat}>{t(cat as any)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-700 mb-2 block">{t("amount" as any) || "Amount"}</Label>
                <Input type="number" min="0" step="0.01" value={editExpense.amount} onChange={e => setEditExpense((prev: any) => ({ ...prev, amount: e.target.value }))} required className="w-full" />
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-700 mb-2 block">{t("date" as any) || "Date"}</Label>
                <Input type="date" value={editExpense.expense_date} onChange={e => setEditExpense((prev: any) => ({ ...prev, expense_date: e.target.value }))} required className="w-full" />
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-700 mb-2 block">{t("descriptionLabel" as any) || "Description"}</Label>
                <Input value={editExpense.description || ""} onChange={e => setEditExpense((prev: any) => ({ ...prev, description: e.target.value }))} className="w-full" />
              </div>
              <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:gap-0">
                <Button type="submit" className="w-full sm:w-auto">{t("save")}</Button>
                <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)} className="w-full sm:w-auto">{t("cancel")}</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="w-[95vw] max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl">{t("deleteExpenseTitle" as any) || "Delete Expense"}</DialogTitle>
          </DialogHeader>
          <p className="text-sm sm:text-base text-gray-600">{t("deleteExpenseConfirm" as any) || "Are you sure you want to delete this expense?"}</p>
          <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:gap-0">
            <Button variant="destructive" onClick={handleDelete} className="w-full sm:w-auto">{t("delete")}</Button>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)} className="w-full sm:w-auto">{t("cancel")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}