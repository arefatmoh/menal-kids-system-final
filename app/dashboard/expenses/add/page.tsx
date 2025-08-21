"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
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

export default function AddExpensePage() {
  const { currentBranch } = useBranch();
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const [description, setDescription] = useState("");
  const [branchId, setBranchId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  // Set branchId on mount if currentBranch is not 'all'
  useEffect(() => {
    if (currentBranch && currentBranch !== "all") {
      setBranchId(currentBranch);
    } else {
      setBranchId("");
    }
  }, [currentBranch]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");
    try {
      const res = await apiClient.createExpense({
        branch_id: currentBranch !== "all" ? currentBranch : branchId,
        category,
        amount: parseFloat(amount),
        expense_date: expenseDate,
        description,
      });
      setIsSubmitting(false);
      if (res.success) {
        router.push("/dashboard/expenses");
      } else {
        setError(res.error || "Failed to add expense");
      }
    } catch (err: any) {
      setIsSubmitting(false);
      setError(err.message || "Failed to add expense");
    }
  };

  const isBranchFixed = currentBranch && currentBranch !== "all";
  const branchName = BRANCHES.find(b => b.id === (isBranchFixed ? currentBranch : branchId))?.name;

  return (
    <div className="max-w-xl mx-auto mt-10">
      <Card>
        <CardHeader>
          <CardTitle>Add Expense</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Branch</Label>
              {isBranchFixed ? (
                <Input value={branchName || currentBranch} disabled readOnly />
              ) : (
                <Select value={branchId} onValueChange={setBranchId} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Branch" />
                  </SelectTrigger>
                  <SelectContent>
                    {BRANCHES.map(b => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div>
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory} required>
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
              <Input placeholder="Amount" type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} required />
            </div>
            <div>
              <Label>Date</Label>
              <Input placeholder="Date" type="date" value={expenseDate} onChange={e => setExpenseDate(e.target.value)} required />
            </div>
            <div>
              <Label>Description</Label>
              <Input placeholder="Description" value={description} onChange={e => setDescription(e.target.value)} />
            </div>
            {error && <div className="text-red-600 text-sm font-medium">{error}</div>}
            <Button type="submit" disabled={isSubmitting || !category || (!branchId && !isBranchFixed)} className="w-full">
              {isSubmitting ? "Adding..." : "Add Expense"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}