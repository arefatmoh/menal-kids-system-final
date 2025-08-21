"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import api from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

interface ColumnMeta {
  name: string
  type: string
  nullable: boolean
}

export default function DeveloperToolsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [tables, setTables] = useState<string[]>([])
  const [columnsByTable, setColumnsByTable] = useState<Record<string, ColumnMeta[]>>({})
  const [selectedTable, setSelectedTable] = useState<string>("")
  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(25)
  const [total, setTotal] = useState(0)
  const [editRowIndex, setEditRowIndex] = useState<number | null>(null)
  const [editBuffer, setEditBuffer] = useState<Record<string, unknown>>({})
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [insertBuffer, setInsertBuffer] = useState<Record<string, unknown>>({})
  const [depDialogOpen, setDepDialogOpen] = useState(false)
  const [depFor, setDepFor] = useState<{ table: string; pk: string; value: unknown } | null>(null)
  const [dependents, setDependents] = useState<Array<{ table: string; column: string; count: number }>>([])
  const [dependentSamples, setDependentSamples] = useState<Record<string, unknown[]>>({})
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false)
  const [bulkConfirm, setBulkConfirm] = useState("")
  const [bulkSoft, setBulkSoft] = useState(true)

  useEffect(() => {
    ;(async () => {
      try {
        const res: any = await api.getCurrentUser()
        const user = res?.data?.user
        if (!user || user.role !== "owner") {
          router.replace("/dashboard")
          return
        }
      } catch {
        router.replace("/dashboard")
        return
      }
    })()
    ;(async () => {
      try {
        setLoading(true)
        const res: any = await api.adminGetTables()
        if (res?.success) {
          setTables(res.data.tables)
          setColumnsByTable(res.data.columnsByTable)
          if (res.data.tables.length > 0) setSelectedTable(res.data.tables[0])
        }
      } catch (e: any) {
        toast.error(e?.message || "Failed to load tables")
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const columns = useMemo(() => columnsByTable[selectedTable] || [], [columnsByTable, selectedTable])

  async function loadRows() {
    if (!selectedTable) return
    try {
      setLoading(true)
      const res: any = await api.adminGetRows(selectedTable, page, limit)
      if (res?.success) {
        setRows(res.data.rows)
        setTotal(res.data.total)
      }
    } catch (e: any) {
      toast.error(e?.message || "Failed to load rows")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRows()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTable, page, limit])

  function startEdit(index: number) {
    setEditRowIndex(index)
    setEditBuffer({ ...rows[index] })
  }

  function cancelEdit() {
    setEditRowIndex(null)
    setEditBuffer({})
  }

  async function saveEdit() {
    if (editRowIndex === null) return
    const row = rows[editRowIndex]
    const pkCandidate = columns.find((c) => c.name === "id")?.name || columns[0]?.name
    if (!pkCandidate) return
    try {
      setLoading(true)
      const res: any = await api.adminUpdateRow({
        table: selectedTable,
        primaryKey: pkCandidate,
        primaryKeyValue: (row as any)[pkCandidate],
        updates: editBuffer,
      })
      if (res?.success) {
        toast.success("Row updated")
        setEditRowIndex(null)
        setEditBuffer({})
        loadRows()
      }
    } catch (e: any) {
      if (e?.code === '23505') {
        toast.error('Duplicate value violates a unique constraint. Try a different value.')
      } else if (e?.code === '23503') {
        toast.error('This row is referenced by other data. Reassign or delete dependents first, or Archive if available.')
      } else if (e?.status === 400) {
        toast.error(e?.message || 'Invalid values provided.')
      } else {
        toast.error(e?.message || "Failed to update row")
      }
    } finally {
      setLoading(false)
    }
  }

  async function deleteRow(index: number, opts: { soft?: boolean } = {}) {
    const row = rows[index]
    const pkCandidate = columns.find((c) => c.name === "id")?.name || columns[0]?.name
    if (!pkCandidate) return
    try {
      setLoading(true)
      const res: any = await api.adminDeleteRow({
        table: selectedTable,
        primaryKey: pkCandidate,
        primaryKeyValue: (row as any)[pkCandidate],
        soft: opts.soft,
      })
      if (res?.success) {
        toast.success(res?.message || (opts.soft ? "Row archived" : "Row deleted"))
        loadRows()
      }
    } catch (e: any) {
      if (e?.code === '23503') {
        // Open dependency dialog
        setDepFor({ table: selectedTable, pk: pkCandidate, value: (row as any)[pkCandidate] })
        try {
          const res: any = await api.adminGetDependents({
            table: selectedTable,
            primaryKey: pkCandidate,
            primaryKeyValue: (row as any)[pkCandidate],
          })
          if (res?.success) {
            setDependents(res.data.dependents)
            const map: Record<string, unknown[]> = {}
            for (const d of res.data.dependents as Array<{ table: string; column: string; samples: unknown[] }>) {
              map[`${d.table}.${d.column}`] = d.samples
            }
            setDependentSamples(map)
            setDepDialogOpen(true)
          }
        } catch (err) {
          toast.error('Failed to inspect dependencies')
        }
      } else {
        toast.error(e?.message || "Failed to delete row")
      }
    } finally {
      setLoading(false)
    }
  }

  async function saveInsert() {
    try {
      setLoading(true)
      const res: any = await api.adminInsertRow({ table: selectedTable, values: insertBuffer })
      if (res?.success) {
        toast.success("Row inserted")
        setShowAddDialog(false)
        setInsertBuffer({})
        loadRows()
      }
    } catch (e: any) {
      if (e?.code === '23505') {
        toast.error('Duplicate value violates a unique constraint. Try a different value.')
      } else if (e?.status === 400) {
        toast.error(e?.message || 'Invalid values provided.')
      } else {
        toast.error(e?.message || "Failed to insert row")
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-2 text-xs max-w-6xl mx-auto">
      <Card>
        <CardHeader className="py-2">
          <CardTitle className="text-xs font-medium">Developer Tools — Database</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 py-2">
          <div className="flex items-center gap-1">
            <Select value={selectedTable} onValueChange={setSelectedTable}>
              <SelectTrigger className="w-56 h-7 text-xs">
                <SelectValue placeholder="Select table" className="text-xs" />
              </SelectTrigger>
              <SelectContent className="text-xs">
                {tables.map((t) => (
                  <SelectItem key={t} value={t} className="text-xs px-2 py-1">
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="number"
              className="w-16 h-7 text-xs px-2"
              value={limit}
              onChange={(e) => setLimit(Math.max(1, Math.min(200, Number(e.target.value) || 25)))}
            />
            <div className="ml-auto flex items-center gap-1">
              <Button className="h-7 px-2 text-xs" onClick={() => setShowAddDialog(true)} disabled={!selectedTable || loading}>
                Add Row
              </Button>
              <Button className="h-7 px-2 text-xs" variant="destructive" onClick={() => { setBulkDialogOpen(true); setBulkConfirm("") }} disabled={!selectedTable || loading}>
                Delete All
              </Button>
              <Button className="h-7 px-2 text-xs" variant="outline" disabled={page <= 1 || loading} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                Prev
              </Button>
              <span className="text-[11px]">
                Page {page} / {Math.max(1, Math.ceil(total / Math.max(1, limit)))}
              </span>
              <Button className="h-7 px-2 text-xs" variant="outline" disabled={rows.length < limit || loading} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          </div>

          <div className="overflow-auto border rounded-md">
            <Table className="text-[11px]">
              <TableHeader>
                <TableRow className="h-8">
                  {columns.map((c) => (
                    <TableHead key={c.name} className="py-1 px-2 text-[11px]">{c.name}</TableHead>
                  ))}
                  <TableHead className="py-1 px-2 text-[11px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, idx) => (
                  <TableRow key={idx} className="h-8">
                    {columns.map((c) => (
                      <TableCell key={c.name} className="max-w-[200px] py-1 px-2 text-[11px]">
                        {editRowIndex === idx ? (
                          <Input
                            className="h-7 text-[11px] px-2"
                            value={String((editBuffer as any)[c.name] ?? "")}
                            onChange={(e) =>
                              setEditBuffer((prev) => ({ ...prev, [c.name]: e.target.value }))
                            }
                          />
                        ) : (
                          <span className="truncate inline-block max-w-[200px] align-top text-[11px]">
                            {String((r as any)[c.name] ?? "")}
                          </span>
                        )}
                      </TableCell>
                    ))}
                    <TableCell className="py-1 px-2">
                      {editRowIndex === idx ? (
                        <div className="flex gap-1">
                          <Button className="h-7 px-2 text-xs" onClick={saveEdit} disabled={loading}>
                            Save
                          </Button>
                          <Button className="h-7 px-2 text-xs" variant="outline" onClick={cancelEdit} disabled={loading}>
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <div className="flex gap-1">
                          <Button className="h-7 px-2 text-xs" variant="outline" onClick={() => startEdit(idx)} disabled={loading}>
                            Edit
                          </Button>
                          {columns.some((c) => c.name === "is_active") ? (
                            <Button className="h-7 px-2 text-xs" variant="outline" onClick={() => deleteRow(idx, { soft: true })} disabled={loading}>
                              Archive
                            </Button>
                          ) : null}
                          <Button
                            className="h-7 px-2 text-xs"
                            variant="destructive"
                            onClick={() => deleteRow(idx)}
                            disabled={loading}
                          >
                            Delete
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="p-3">
          <DialogHeader>
            <DialogTitle className="text-xs">Insert Row</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-[60vh] overflow-auto pr-1">
            {columns.map((c) => (
              <div key={c.name} className="grid grid-cols-3 items-center gap-2">
                <div className="col-span-1 text-xs text-gray-600">{c.name}</div>
                <div className="col-span-2">
                  <Input
                    className="h-7 text-xs px-2"
                    value={String((insertBuffer as any)[c.name] ?? "")}
                    onChange={(e) => setInsertBuffer((prev) => ({ ...prev, [c.name]: e.target.value }))}
                    placeholder={c.type}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <Button className="h-7 px-2 text-xs" variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button className="h-7 px-2 text-xs" onClick={saveInsert} disabled={loading}>
              Insert
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={depDialogOpen} onOpenChange={setDepDialogOpen}>
        <DialogContent className="p-3">
          <DialogHeader>
            <DialogTitle className="text-xs">Resolve Dependencies</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
          {dependents.length === 0 ? (
              <div className="text-xs text-gray-600">No dependents found.</div>
            ) : (
              <div className="space-y-2">
              {dependents.map((d) => (
                <div key={`${d.table}.${d.column}`} className="space-y-1 border p-2 rounded">
                  <div className="text-xs">
                    {d.count} rows in <span className="font-medium">{d.table}</span> referencing via <code>{d.column}</code>
                  </div>
                  <div className="text-[11px] text-gray-500">Sample rows:</div>
                  <pre className="text-[10px] bg-gray-50 p-2 rounded overflow-auto max-h-32">{JSON.stringify(dependentSamples[`${d.table}.${d.column}`] || [], null, 2)}</pre>
                </div>
              ))}
              </div>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <Button className="h-7 px-2 text-xs" variant="outline" onClick={() => setDepDialogOpen(false)}>Close</Button>
              <Button
                className="h-7 px-2 text-xs"
                variant="destructive"
                disabled={!depFor || dependents.length === 0 || loading}
                onClick={async () => {
                  if (!depFor) return
                  try {
                    setLoading(true)
                    const res: any = await api.adminCascadeDelete({
                      table: depFor.table,
                      primaryKey: depFor.pk,
                      primaryKeyValue: depFor.value,
                      dependents: dependents.map((d) => ({ table: d.table, column: d.column })),
                    })
                    if (res?.success) {
                      toast.success('Deleted dependents and the selected row')
                      setDepDialogOpen(false)
                      setDependents([])
                      setDepFor(null)
                      loadRows()
                    }
                  } catch (err: any) {
                    toast.error(err?.message || 'Cascade delete failed')
                  } finally {
                    setLoading(false)
                  }
                }}
              >
                Delete dependents then delete row
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
        <DialogContent className="p-3">
          <DialogHeader>
            <DialogTitle className="text-xs">Delete All Rows in {selectedTable}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <div className="text-xs text-gray-700">
              This will {bulkSoft ? 'archive (set is_active=false for)' : 'permanently delete'} all rows in <span className="font-semibold">{selectedTable}</span>.
              Type the table name to confirm.
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs"><input className="mr-2" type="checkbox" checked={bulkSoft} onChange={(e) => setBulkSoft(e.target.checked)} /> Soft delete (recommended)</label>
            </div>
            <Input className="h-7 text-xs px-2" value={bulkConfirm} onChange={(e) => setBulkConfirm(e.target.value)} placeholder={`Type "${selectedTable}"`} />
            <div className="flex justify-end gap-2">
              <Button className="h-7 px-2 text-xs" variant="outline" onClick={() => setBulkDialogOpen(false)}>Cancel</Button>
              <Button
                className="h-7 px-2 text-xs"
                variant="destructive"
                disabled={bulkConfirm !== selectedTable || loading}
                onClick={async () => {
                  try {
                    setLoading(true)
                    const res: any = await api.adminBulkDelete({ table: selectedTable, soft: bulkSoft, confirm: bulkConfirm })
                    if (res?.success) {
                      toast.success(bulkSoft ? 'Archived all rows' : 'Deleted all rows')
                      setBulkDialogOpen(false)
                      loadRows()
                    }
                  } catch (e: any) {
                    toast.error(e?.message || 'Bulk delete failed')
                  } finally {
                    setLoading(false)
                  }
                }}
              >
                {bulkSoft ? 'Archive All' : 'Delete All'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}


