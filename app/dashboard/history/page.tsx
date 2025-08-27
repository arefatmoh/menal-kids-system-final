"use client"
import { useEffect, useMemo, useState } from "react"
import { useLanguage } from "@/lib/language-context"
import { type Activity } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Separator } from "@/components/ui/separator"
import { RefreshCcw, History, Filter, Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { useToast } from "@/hooks/use-toast"

const TYPE_FILTERS = [
  { key: "all", value: null as string | null },
  { key: "sell", value: "sell" },
  { key: "stock", value: "stock" },
  { key: "expense", value: "expense_add" },
  { key: "transfer", value: "transfer" },
]

export default function HistoryPage() {
  const { t } = useLanguage()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activities, setActivities] = useState<Activity[]>([])
  const [activeType, setActiveType] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState<Activity | null>(null)
  const [restoringId, setRestoringId] = useState<string | null>(null)
  const [confirmActivity, setConfirmActivity] = useState<Activity | null>(null)
  const [dryRun, setDryRun] = useState<boolean>(true)
  const { toast } = useToast()
  const [detailData, setDetailData] = useState<any | null>(null)
  const [detailLoading, setDetailLoading] = useState<boolean>(false)
  const [editActivity, setEditActivity] = useState<Activity | null>(null)
  const [editTitle, setEditTitle] = useState<string>("")
  const [editDescription, setEditDescription] = useState<string>("")

  const fetchData = async (opts?: { type?: string | null }) => {
    setLoading(true)
    setError(null)
    try {
      const appliedType = opts?.type ?? activeType
      const params = new URLSearchParams()
      params.set("limit", "100")
      // Default employee branch filter to improve signal
      const storedBranch = typeof window !== 'undefined' ? window.localStorage.getItem('current_branch_id') : null
      if (!searchParamsHasType(appliedType) && storedBranch) {
        params.set('branch_id', storedBranch)
      }
      if (appliedType && appliedType !== "all") {
        // Map grouped stock filter to concrete types
        if (appliedType === "stock") {
          // No server grouping yet; just fetch all and filter client-side for now
        } else {
          params.set("type", appliedType)
        }
      }
      const res = await fetch(`/api/history?${params.toString()}`, { cache: "no-store" })
      const json = await res.json()
      if (!json.success) throw new Error(json.error || "Failed to load")
      const rows: Activity[] = json.data ?? []
      setActivities(rows)
    } catch (e: any) {
      setError(e.message || "Error")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    let rows = activities
    if (activeType === "stock") {
      rows = rows.filter(a => a.type === "stock_add" || a.type === "stock_reduce")
    }
    if (q.length > 0) {
      rows = rows.filter(a =>
        (a.title || "").toLowerCase().includes(q) ||
        (a.description || "").toLowerCase().includes(q) ||
        (a.type || "").toLowerCase().includes(q)
      )
    }
    return rows
  }, [activities, search, activeType])

  function searchParamsHasType(t?: string | null) {
    return !!t && t !== 'all'
  }

  function translateText(input?: string | null): string {
    if (!input) return ""
    let text = input
    // Items: N, Total: amount
    text = text.replace(/\bItems:\s*(\d+)\b/i, (_m, n) => `${t("items" as any) || "Items"}: ${n}`)
    text = text.replace(/\bTotal:\s*([\d.,]+)\b/i, (_m, amt) => `${t("total" as any) || "Total"}: ${amt}`)
    // Refund for sale <id>
    text = text.replace(/\bRefund for sale\s+([\w-]+)/i, (_m, id) => `${t("refundForSale" as any) || "Refund for sale"} ${id}`)
    // Restore: Sale completed
    text = text.replace(/^Restore:\s*Sale completed$/i, `${t("restore" as any) || "Restore"}: ${t("saleCompleted" as any) || "Sale completed"}`)
    // User restore from History
    text = text.replace(/^User restore from History$/i, t("userRestoreFromHistory" as any) || "User restore from History")
    return text
  }

  const typeBadge = (type: Activity["type"]) => {
    const color =
      type === "sell" ? "bg-green-100 text-green-700" :
      type === "expense_add" ? "bg-rose-100 text-rose-700" :
      type === "transfer" ? "bg-amber-100 text-amber-700" :
      type === "stock_add" ? "bg-blue-100 text-blue-700" :
      type === "stock_reduce" ? "bg-purple-100 text-purple-700" :
      type === "restore" ? "bg-gray-100 text-gray-700" :
      "bg-slate-100 text-slate-700"
    const typeKey = (`type_${type}`) as any
    return <Badge className={`text-xs ${color}`}>{t(typeKey) || type}</Badge>
  }

  async function performRestore(a: Activity) {
    try {
      setRestoringId(a.id)
      const res = await fetch("/api/history/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activity_id: a.id, reason: "User restore from History", dry_run: false })
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error || (t("restoreFailed" as any) || "Restore failed"))
      await fetchData({ type: activeType })
      toast({ title: t("restoredSuccessfully" as any) || "Restored successfully" })
    } catch (e: any) {
      toast({ title: t("restoreFailed" as any) || "Restore failed", description: e.message || String(e), variant: "destructive" })
    } finally {
      setRestoringId(null)
    }
  }

  async function previewRestore(a: Activity) {
    try {
      const res = await fetch("/api/history/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activity_id: a.id, reason: "Preview restore", dry_run: true })
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error || "Preview failed")
      return json.data
    } catch (e) {
      return null
    }
  }

  async function openDetail(a: Activity) {
    setSelected(a)
    setDetailLoading(true)
    setDetailData(null)
    try {
      const res = await fetch(`/api/history/${a.id}`)
      const json = await res.json()
      setDetailData(json?.data || json)
    } catch (e: any) {
      toast({ title: t("failedToLoad" as any) || "Failed to load", description: e.message || String(e), variant: "destructive" })
    } finally {
      setDetailLoading(false)
    }
  }

  function openEdit(a: Activity) {
    setEditActivity(a)
    setEditTitle(a.title || "")
    setEditDescription((a as any).description || "")
  }

  async function submitEdit(e: React.FormEvent) {
    e.preventDefault()
    try {
      if (!editActivity) return
      const res = await fetch(`/api/history/${editActivity.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editTitle, description: editDescription })
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error || "Update failed")
      setEditActivity(null)
      await fetchData({ type: activeType })
      toast({ title: t("updated" as any) || "Updated" })
    } catch (err: any) {
      toast({ title: t("updateFailed" as any) || "Update failed", description: err.message || String(err), variant: "destructive" })
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6 px-4 sm:px-6">
      <div className="flex items-center gap-2">
        <History className="h-5 w-5 text-pink-600" />
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{t("history" as any) || "History"}</h1>
      </div>

      <Card className="border-gray-200">
        <CardHeader className="pb-2 sticky top-0 z-10 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60">
          <CardTitle className="text-sm sm:text-base text-gray-700">{t("recentActivities" as any) || "Recent Activities"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <div className="flex gap-2">
              {TYPE_FILTERS.map(tf => (
                <Button
                  key={tf.key}
                  variant={activeType === tf.value || (tf.value === null && activeType === null) ? "default" : "outline"}
                  className="h-8 px-3 text-xs"
                  onClick={() => { setActiveType(tf.value); fetchData({ type: tf.value }) }}
                >
                  {t((tf.key + "History") as any) || tf.key}
                </Button>
              ))}
            </div>
            <div className="flex-1" />
            <div className="flex items-center gap-2">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t("search" as any) || "Search..."}
                  className="pl-8 h-8 text-sm"
                />
              </div>
              <Button variant="outline" size="sm" className="h-8" onClick={() => fetchData()}>
                <RefreshCcw className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" className="h-8">
                <Filter className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <Separator />

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">{t("type" as any) || "Type"}</TableHead>
                  <TableHead className="text-xs">{t("title" as any) || "Title"}</TableHead>
                  <TableHead className="text-xs hidden sm:table-cell">{t("description" as any) || "Description"}</TableHead>
                  <TableHead className="text-xs hidden sm:table-cell">{t("status" as any) || "Status"}</TableHead>
                  <TableHead className="text-xs">{t("date" as any) || "Date"}</TableHead>
                  <TableHead className="text-xs text-right">{t("actions" as any) || "Actions"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  Array.from({ length: 6 }).map((_, i) => (
                    <TableRow key={`sk-${i}`}>
                      <TableCell className="py-3"><div className="h-4 w-14 bg-gray-200 rounded animate-pulse" /></TableCell>
                      <TableCell className="py-3"><div className="h-4 w-40 bg-gray-200 rounded animate-pulse" /></TableCell>
                      <TableCell className="py-3 hidden sm:table-cell"><div className="h-4 w-64 bg-gray-200 rounded animate-pulse" /></TableCell>
                      <TableCell className="py-3 hidden sm:table-cell"><div className="h-4 w-16 bg-gray-200 rounded animate-pulse" /></TableCell>
                      <TableCell className="py-3"><div className="h-4 w-28 bg-gray-200 rounded animate-pulse" /></TableCell>
                      <TableCell className="py-3"><div className="h-4 w-24 bg-gray-200 rounded ml-auto animate-pulse" /></TableCell>
                    </TableRow>
                  ))
                )}
                {error && !loading && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-sm text-red-600 py-6">{error}</TableCell>
                  </TableRow>
                )}
                {!loading && !error && filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-sm text-gray-500 py-6">{t("noData" as any) || "No activities"}</TableCell>
                  </TableRow>
                )}
                {filtered.map((a) => (
                  <TableRow key={a.id} className="hover:bg-gray-50">
                    <TableCell className="align-top">{typeBadge(a.type)}</TableCell>
                    <TableCell className="align-top">
                      <div className="text-sm font-medium text-gray-900 leading-tight line-clamp-2 sm:line-clamp-1">{translateText(a.title) || a.type}</div>
                      <div className="text-xs text-gray-500 sm:hidden mt-1 line-clamp-2">{translateText(a.description)}</div>
                    </TableCell>
                    <TableCell className="align-top hidden sm:table-cell text-xs text-gray-600 line-clamp-2">{translateText(a.description)}</TableCell>
                    <TableCell className="align-top hidden sm:table-cell">
                      <Badge className={`text-xs ${a.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-700'}`}>{t(a.status as any) || a.status}</Badge>
                    </TableCell>
                    <TableCell className="align-top text-xs text-gray-600 whitespace-nowrap">{new Date(a.created_at).toLocaleString()}</TableCell>
                    <TableCell className="align-top">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => openDetail(a)}>{t("detail" as any) || "Detail"}</Button>
                        <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => openEdit(a)}>{t("edit" as any) || "Edit"}</Button>
                        <Button variant="default" size="sm" className="h-7 px-2 text-xs bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white" onClick={() => setConfirmActivity(a)} disabled={restoringId === a.id}>
                          {restoringId === a.id ? (t("restoring" as any) || "Restoring...") : (t("restore" as any) || "Restore")}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg flex items-center gap-2">
              <span>{translateText(selected?.title) || (t((`type_${selected?.type}`) as any) || selected?.type)}</span>
              {selected && typeBadge(selected.type)}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selected?.description && (
              <p className="text-sm text-gray-700">{translateText(selected.description)}</p>
            )}

            {/* Key facts */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div><span className="text-gray-500">{t("type" as any) || "Type"}:</span> {t((`type_${selected?.type}`) as any) || selected?.type}</div>
              <div><span className="text-gray-500">{t("status" as any) || "Status"}:</span> {t(selected?.status as any) || selected?.status}</div>
              {detailData?.branch_name && (
                <div><span className="text-gray-500">{t("branchLabel" as any) || "Branch"}:</span> {detailData.branch_name}</div>
              )}
              {!detailData?.branch_name && (
                <div><span className="text-gray-500">{t("branchLabel" as any) || "Branch"}:</span> {selected?.branch_id || '-'}</div>
              )}
              <div><span className="text-gray-500">{t("user" as any) || "User"}:</span> {detailData?.user_email || selected?.user_id || '-'}</div>
              {detailData?.related_entity_type || selected?.related_entity_type ? (
                <div className="col-span-2"><span className="text-gray-500">{t("details" as any) || "Details"}:</span> {(detailData?.related_entity_type || selected?.related_entity_type)} {detailData?.related_entity_id || selected?.related_entity_id || ''}</div>
              ) : null}
              <div className="col-span-2"><span className="text-gray-500">{t("date" as any) || "Date"}:</span> {selected ? new Date(selected.created_at).toLocaleString() : ''}</div>
            </div>

            {/* Context blocks per type */}
            {selected?.type === 'sell' && detailData?.items?.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-800">{t("saleSummary" as any) || "Sale Summary"}</p>
                <div className="border rounded-md overflow-hidden">
                  <div className="grid grid-cols-4 px-3 py-2 text-[11px] text-gray-500 bg-gray-50">
                    <div>{t("product" as any) || "Product"}</div>
                    <div className="text-right">{t("qty" as any) || "Qty"}</div>
                    <div className="text-right">{t("price" as any) || "Price"}</div>
                    <div className="text-right">{t("total" as any) || "Total"}</div>
                  </div>
                  <div className="divide-y">
                    {detailData.items.map((it: any, idx: number) => (
                      <div key={idx} className="grid grid-cols-4 px-3 py-2 text-[12px]">
                        <div className="truncate" title={it.product_name}>{it.product_name}{it.variation_name ? ` (${it.variation_name})` : ''}{it.sku ? ` • ${it.sku}` : ''}</div>
                        <div className="text-right">{it.quantity}</div>
                        <div className="text-right">{it.unit_price}</div>
                        <div className="text-right">{it.subtotal}</div>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between px-3 py-2 text-[12px] bg-gray-50">
                    <span>{t("items" as any) || 'Items'}: {detailData.items.length}</span>
                    <span className="font-medium">{t("total" as any) || 'Total'}: {detailData.total_amount ?? detailData.total}</span>
                  </div>
                </div>
              </div>
            )}

            {selected?.type === 'transfer' && (detailData?.from_branch || detailData?.to_branch) && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-800">{t("transferDetails" as any) || "Transfer Details"}</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><span className="text-gray-500">{t("fromBranch" as any) || "From Branch"}:</span> {detailData?.from_branch || '-'}</div>
                  <div><span className="text-gray-500">{t("toBranch" as any) || "To Branch"}:</span> {detailData?.to_branch || '-'}</div>
                </div>
                {detailData?.items?.length > 0 && (
                  <div className="border rounded-md overflow-hidden">
                    <div className="grid grid-cols-3 px-3 py-2 text-[11px] text-gray-500 bg-gray-50">
                      <div>{t("product" as any) || "Product"}</div>
                      <div className="text-right">{t("qty" as any) || "Qty"}</div>
                      <div className="text-right">{t("totalQuantity" as any) || "Total"}</div>
                    </div>
                    <div className="divide-y">
                      {detailData.items.map((it: any, idx: number) => (
                        <div key={idx} className="grid grid-cols-3 px-3 py-2 text-[12px]">
                          <div className="truncate" title={it.product_name}>{it.product_name}</div>
                          <div className="text-right">{it.quantity}</div>
                          <div className="text-right">{it.quantity}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {selected?.type === 'expense_add' && (detailData?.amount || detailData?.category) && (
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div><span className="text-gray-500">{t("amount" as any) || 'Amount'}:</span> {detailData?.amount}</div>
                <div><span className="text-gray-500">{t("category" as any) || 'Category'}:</span> {t((detailData?.category || '').toLowerCase() as any) || detailData?.category}</div>
              </div>
            )}

            {/* Generic items/changes section for all types */}
            {(() => {
              const genericItems = (detailData?.items as any[]) || ((selected?.delta as any)?.items as any[])
              const totalAmount = detailData?.total_amount || (detailData?.total) || (selected?.delta as any)?.total_amount
              const discount = detailData?.discount || (selected?.delta as any)?.discount
              if (Array.isArray(genericItems) && genericItems.length > 0) {
                // Determine available columns
                const hasPrice = genericItems.some((it: any) => it.unit_price != null || it.price != null)
                const hasSubtotal = genericItems.some((it: any) => it.subtotal != null)
                return (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-800">{t("details" as any) || "Details"}</p>
                    <div className="border rounded-md overflow-hidden">
                      <div className={`grid px-3 py-2 text-[11px] text-gray-500 bg-gray-50 ${hasPrice || hasSubtotal ? 'grid-cols-4' : 'grid-cols-2'}`}>
                        <div>{t("product" as any) || "Product"}</div>
                        <div className="text-right">{t("qty" as any) || "Qty"}</div>
                        {(hasPrice || hasSubtotal) && <div className="text-right">{t("price" as any) || "Price"}</div>}
                        {(hasSubtotal) && <div className="text-right">{t("total" as any) || "Total"}</div>}
                      </div>
                      <div className="divide-y">
                        {genericItems.map((it: any, idx: number) => (
                          <div key={idx} className={`grid px-3 py-2 text-[12px] ${hasPrice || hasSubtotal ? 'grid-cols-4' : 'grid-cols-2'}`}>
                            <div className="truncate" title={it.product_name || it.product_id}>{(it.product_name || it.product_id)}{it.variation_name ? ` (${it.variation_name})` : ''}{it.sku ? ` • ${it.sku}` : ''}</div>
                            <div className="text-right">{it.quantity ?? it.qty ?? '-'}</div>
                            {(hasPrice || hasSubtotal) && <div className="text-right">{it.unit_price ?? it.price ?? '-'}</div>}
                            {(hasSubtotal) && <div className="text-right">{it.subtotal ?? '-'}</div>}
                          </div>
                        ))}
                      </div>
                      {(discount || totalAmount) && (
                        <div className="flex items-center justify-between px-3 py-2 text-[12px] bg-gray-50">
                          <span>{discount ? `${t('discount' as any) || 'Discount'}: ${discount}` : ''}</span>
                          <span className="font-medium">{totalAmount ? `${t('total' as any) || 'Total'}: ${totalAmount}` : ''}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )
              }
              return null
            })()}

            {/* No JSON is shown; details are summarized in cards above */}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editActivity} onOpenChange={(open) => !open && setEditActivity(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">{t("editActivity" as any) || "Edit Activity"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitEdit} className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs text-gray-600">{t("title" as any) || "Title"}</label>
              <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-gray-600">{t("description" as any) || "Description"}</label>
              <Textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} className="min-h-[90px] text-sm" />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditActivity(null)} className="h-8">{t("cancel" as any) || "Cancel"}</Button>
              <Button type="submit" className="h-8">{t("save" as any) || "Save"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmActivity} onOpenChange={(open) => !open && setConfirmActivity(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("areYouSure" as any) || "Are you sure?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("confirmRestore" as any) || "Do you want to restore this activity?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <label className="flex items-center gap-2 text-xs text-gray-600">
              <input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} />
              {t("dryRunPreview" as any) || "Preview impact only (no changes)"}
            </label>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel" as any) || "Cancel"}</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!confirmActivity) return
                if (dryRun) {
                  const preview = await previewRestore(confirmActivity)
                  setConfirmActivity(null)
                  toast({ title: t("dryRunComplete" as any) || "Preview complete", description: preview ? t("seeDetailForMore" as any) || "Open details to inspect." : undefined })
                } else {
                  await performRestore(confirmActivity)
                  setConfirmActivity(null)
                }
              }}
            >
              {dryRun ? (t("preview" as any) || "Preview") : (t("confirm" as any) || "Confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Tabs defaultValue="table" className="hidden">
        <TabsList className="grid w-full grid-cols-2 sm:w-auto">
          <TabsTrigger value="table">Table</TabsTrigger>
          <TabsTrigger value="list">Cards</TabsTrigger>
        </TabsList>
        <TabsContent value="list">{/* Future: mobile card list view */}</TabsContent>
      </Tabs>
    </div>
  )
}


