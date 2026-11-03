import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Badge, Modal } from '@/components/ui'
import { ArrowLeft, ClipboardCheck, Search } from 'lucide-react'
import {
  listInventoryCounts,
  getInventoryCountItems,
  startInventoryCount,
  saveInventoryCountItem,
  completeInventoryCount,
  cancelInventoryCount,
  type InventoryCount,
  type InventoryCountItem,
} from '@/lib/api/inventory'
import { useAuthStore } from '@/lib/store/auth'
import {
  countDifference,
  matchesSearch,
  parseCountedInput,
  summarizeCount,
} from '@/lib/inventory/countMath'

const STATUS_LABEL: Record<InventoryCount['status'], string> = {
  counting: 'Em conferência',
  completed: 'Concluído',
  cancelled: 'Cancelado',
}

const STATUS_VARIANT: Record<InventoryCount['status'], 'secondary' | 'success' | 'default'> = {
  counting: 'secondary',
  completed: 'success',
  cancelled: 'default',
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

function differenceLabel(difference: number): string {
  if (difference === 0) return 'Sem divergência'
  return difference < 0 ? `Falta ${Math.abs(difference)}` : `Sobra ${difference}`
}

export function InventoryPage() {
  const { checkPermission } = useAuthStore()
  const canAdjust = checkPermission('stock.adjust')

  const [counts, setCounts] = useState<InventoryCount[]>([])
  const [loadingCounts, setLoadingCounts] = useState(true)
  const [pageError, setPageError] = useState<string | null>(null)

  const [activeCount, setActiveCount] = useState<InventoryCount | null>(null)
  const [items, setItems] = useState<InventoryCountItem[]>([])
  const [loadingItems, setLoadingItems] = useState(false)
  const [search, setSearch] = useState('')
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({})
  const [savingItemId, setSavingItemId] = useState<string | null>(null)

  const [startModalOpen, setStartModalOpen] = useState(false)
  const [countName, setCountName] = useState('')
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const [completeModalOpen, setCompleteModalOpen] = useState(false)
  const [confirmAdjustments, setConfirmAdjustments] = useState(false)
  const [cancelModalOpen, setCancelModalOpen] = useState(false)

  const loadCounts = async () => {
    try {
      setLoadingCounts(true)
      setPageError(null)
      setCounts(await listInventoryCounts())
    } catch (err) {
      setPageError(err instanceof Error ? err.message : 'Erro ao carregar inventários')
    } finally {
      setLoadingCounts(false)
    }
  }

  const loadItems = async (countId: string) => {
    try {
      setLoadingItems(true)
      setItems(await getInventoryCountItems(countId))
    } catch (err) {
      setPageError(err instanceof Error ? err.message : 'Erro ao carregar itens')
    } finally {
      setLoadingItems(false)
    }
  }

  useEffect(() => {
    loadCounts()
  }, [])

  const openCount = async (count: InventoryCount) => {
    setActiveCount(count)
    setSearch('')
    setDrafts({})
    setRowErrors({})
    setActionError(null)
    await loadItems(count.id)
  }

  // Salva os rascunhos pendentes antes de sair. Se algum falhar, permanece na tela.
  const flushDrafts = async (): Promise<boolean> => {
    let allSaved = true
    for (const item of items) {
      if (drafts[item.id] === undefined) continue
      const saved = await saveItem(item)
      if (!saved) allSaved = false
    }
    return allSaved
  }

  const backToList = async () => {
    if (Object.keys(drafts).length > 0 && !(await flushDrafts())) return
    setActiveCount(null)
    setItems([])
    await loadCounts()
  }

  // Evita perder contagens digitadas e ainda não salvas ao fechar a aba.
  useEffect(() => {
    if (Object.keys(drafts).length === 0) return
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [drafts])

  const isOpen = activeCount?.status === 'counting'
  const summary = useMemo(() => summarizeCount(items), [items])
  const visibleItems = useMemo(
    () => items.filter((item) => matchesSearch(search, [item.name, item.sku, item.barcode])),
    [items, search]
  )
  const divergentItems = useMemo(
    () => items.filter((item) => item.countedQuantity !== null && item.systemQuantity !== null
      && countDifference(item.countedQuantity, item.systemQuantity) !== 0),
    [items]
  )

  const handleStart = async () => {
    try {
      setBusy(true)
      setActionError(null)
      const { countId } = await startInventoryCount(countName)
      setStartModalOpen(false)
      setCountName('')
      const started = (await listInventoryCounts()).find((c) => c.id === countId)
      if (started) await openCount(started)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Não foi possível iniciar o inventário')
    } finally {
      setBusy(false)
    }
  }

  // Salva a contagem ao sair do campo (ou Enter). Não altera estoque.
  const saveItem = async (item: InventoryCountItem): Promise<boolean> => {
    if (!activeCount) return false
    const raw = drafts[item.id]
    if (raw === undefined) return true

    const parsed = parseCountedInput(raw)
    if (!parsed.ok) {
      setRowErrors((prev) => ({ ...prev, [item.id]: parsed.error }))
      return false
    }

    try {
      setSavingItemId(item.id)
      setRowErrors((prev) => ({ ...prev, [item.id]: '' }))
      const result = await saveInventoryCountItem({
        countId: activeCount.id,
        productId: item.productId,
        countedQuantity: parsed.value,
      })
      setItems((prev) =>
        prev.map((row) =>
          row.id === item.id
            ? { ...row, countedQuantity: parsed.value, systemQuantity: result.systemQuantity }
            : row
        )
      )
      setDrafts((prev) => {
        const next = { ...prev }
        delete next[item.id]
        return next
      })
      return true
    } catch (err) {
      setRowErrors((prev) => ({
        ...prev,
        [item.id]: err instanceof Error ? err.message : 'Erro ao salvar contagem',
      }))
      return false
    } finally {
      setSavingItemId(null)
    }
  }

  const handleComplete = async () => {
    if (!activeCount) return
    try {
      setBusy(true)
      setActionError(null)
      // Idempotente: se já estava concluído, o banco só devolve o estado atual
      await completeInventoryCount(activeCount.id)
      setCompleteModalOpen(false)
      setConfirmAdjustments(false)
      setActiveCount({ ...activeCount, status: 'completed', completedAt: new Date().toISOString() })
      await loadItems(activeCount.id)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Não foi possível concluir o inventário')
    } finally {
      setBusy(false)
    }
  }

  const handleCancel = async () => {
    if (!activeCount) return
    try {
      setBusy(true)
      setActionError(null)
      await cancelInventoryCount(activeCount.id)
      setCancelModalOpen(false)
      setActiveCount({ ...activeCount, status: 'cancelled', cancelledAt: new Date().toISOString() })
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Não foi possível cancelar o inventário')
    } finally {
      setBusy(false)
    }
  }

  // ---------- Lista de inventários ----------
  if (!activeCount) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Inventário físico</h1>
            <p className="text-sm text-gray-500">
              Compare a contagem real com o sistema e ajuste o estoque com registro.
            </p>
          </div>
          {canAdjust && (
            <Button onClick={() => setStartModalOpen(true)}>
              <ClipboardCheck className="h-4 w-4" /> Iniciar inventário
            </Button>
          )}
        </div>

        {pageError && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{pageError}</div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Inventários</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingCounts ? (
              <p className="text-sm text-gray-500">Carregando...</p>
            ) : counts.length === 0 ? (
              <p className="text-sm text-gray-500">Nenhum inventário realizado ainda.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {counts.map((count) => (
                  <li key={count.id}>
                    <button
                      type="button"
                      onClick={() => openCount(count)}
                      className="w-full text-left py-3 flex items-center justify-between gap-3 hover:bg-gray-50 px-2 rounded"
                    >
                      <div>
                        <p className="font-medium text-gray-900">{count.name}</p>
                        <p className="text-xs text-gray-500">
                          Iniciado em {formatDate(count.startedAt)}
                          {count.completedAt && ` · concluído em ${formatDate(count.completedAt)}`}
                          {count.cancelledAt && ` · cancelado em ${formatDate(count.cancelledAt)}`}
                        </p>
                      </div>
                      <Badge variant={STATUS_VARIANT[count.status]}>{STATUS_LABEL[count.status]}</Badge>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Modal
          isOpen={startModalOpen}
          onClose={() => setStartModalOpen(false)}
          title="Iniciar inventário"
          description="Os produtos ativos serão listados para contagem. Vendas e entradas continuam normalmente durante a contagem."
        >
          <div className="space-y-4">
            {actionError && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{actionError}</div>
            )}
            <Input
              label="Nome do inventário (opcional)"
              value={countName}
              onChange={(e) => setCountName(e.target.value)}
              placeholder="Ex.: Inventário de dezembro"
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setStartModalOpen(false)} disabled={busy}>
                Cancelar
              </Button>
              <Button onClick={handleStart} disabled={busy}>
                {busy ? 'Iniciando...' : 'Iniciar'}
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    )
  }

  // ---------- Detalhe do inventário ----------
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={backToList}>
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{activeCount.name}</h1>
            <Badge variant={STATUS_VARIANT[activeCount.status]}>{STATUS_LABEL[activeCount.status]}</Badge>
          </div>
        </div>
        {isOpen && canAdjust && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setCancelModalOpen(true)} disabled={busy}>
              Cancelar inventário
            </Button>
            <Button
              onClick={() => setCompleteModalOpen(true)}
              disabled={busy || summary.pending > 0 || items.length === 0 || Object.keys(drafts).length > 0}
              title={
                summary.pending > 0
                  ? 'Conte todos os produtos antes de concluir'
                  : Object.keys(drafts).length > 0
                    ? 'Saia do campo de um produto editado para salvar a contagem antes de concluir'
                    : undefined
              }
            >
              Concluir e ajustar estoque
            </Button>
          </div>
        )}
      </div>

      {actionError && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{actionError}</div>
      )}
      {pageError && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{pageError}</div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryTile label="Produtos" value={summary.total} />
        <SummaryTile label="Contados" value={summary.counted} />
        <SummaryTile label="Pendentes" value={summary.pending} />
        <SummaryTile label="Divergências" value={summary.divergent} hint={`${summary.shortage} falta · ${summary.surplus} sobra`} />
      </div>

      <Input
        label="Buscar por nome, SKU ou código de barras"
        icon={<Search className="h-4 w-4" />}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Digite para filtrar"
      />

      <Card>
        <CardContent className="p-0">
          {loadingItems ? (
            <p className="p-4 text-sm text-gray-500">Carregando produtos...</p>
          ) : visibleItems.length === 0 ? (
            <p className="p-4 text-sm text-gray-500">Nenhum produto encontrado.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {visibleItems.map((item) => {
                const draft = drafts[item.id]
                const counted = item.countedQuantity
                const diff = counted !== null && item.systemQuantity !== null
                  ? countDifference(counted, item.systemQuantity)
                  : null
                const rowError = rowErrors[item.id]
                return (
                  <li key={item.id} className="p-4 grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-3 items-center">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 truncate">{item.name}</p>
                      <p className="text-xs text-gray-500">
                        SKU {item.sku}
                        {item.barcode && ` · ${item.barcode}`}
                        {` · saldo atual ${item.liveQuantity}`}
                      </p>
                      {rowError && <p className="text-xs text-red-600 mt-1">{rowError}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <label htmlFor={`count-${item.id}`} className="sr-only">
                        Quantidade contada de {item.name}
                      </label>
                      <input
                        id={`count-${item.id}`}
                        type="number"
                        inputMode="numeric"
                        min={0}
                        step={1}
                        disabled={!isOpen || !canAdjust}
                        value={draft ?? (counted !== null ? String(counted) : '')}
                        placeholder="Contado"
                        onChange={(e) => setDrafts((prev) => ({ ...prev, [item.id]: e.target.value }))}
                        onBlur={() => saveItem(item)}
                        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                        className="w-28 h-10 rounded-lg border border-gray-300 px-3 text-right disabled:bg-gray-100"
                      />
                      {savingItemId === item.id && <span className="text-xs text-gray-500">Salvando...</span>}
                    </div>
                    <div className="text-sm md:text-right min-w-[10rem]">
                      {counted === null ? (
                        <Badge variant="default">Pendente</Badge>
                      ) : diff === 0 ? (
                        <Badge variant="success">Sem divergência</Badge>
                      ) : (
                        <Badge variant={diff !== null && diff < 0 ? 'danger' : 'warning'}>
                          {diff !== null ? differenceLabel(diff) : ''}
                        </Badge>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {!isOpen && (
        <p className="text-sm text-gray-500">
          {activeCount.status === 'completed'
            ? `Inventário concluído. ${divergentItems.length} produto(s) tiveram ajuste de estoque registrado no histórico.`
            : 'Este inventário foi cancelado. Nenhum ajuste de estoque foi aplicado.'}
        </p>
      )}

      <Modal
        isOpen={completeModalOpen}
        onClose={() => { setCompleteModalOpen(false); setConfirmAdjustments(false) }}
        title="Concluir inventário"
        description="Os ajustes abaixo serão aplicados ao estoque e registrados no histórico. Esta ação não pode ser desfeita."
      >
        <div className="space-y-4">
          {divergentItems.length === 0 ? (
            <p className="text-sm text-gray-700">Nenhuma divergência. O estoque permanece como está.</p>
          ) : (
            <ul className="max-h-64 overflow-y-auto divide-y divide-gray-100 text-sm">
              {divergentItems.map((item) => (
                <li key={item.id} className="py-2 flex justify-between gap-3">
                  <span className="truncate">{item.name}</span>
                  <span className="font-medium whitespace-nowrap">
                    {item.countedQuantity} contado · {differenceLabel(countDifference(item.countedQuantity!, item.systemQuantity!))}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <label className="flex items-start gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={confirmAdjustments}
              onChange={(e) => setConfirmAdjustments(e.target.checked)}
              className="mt-1"
            />
            Conferi as contagens e confirmo os ajustes de estoque.
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setCompleteModalOpen(false)} disabled={busy}>
              Voltar
            </Button>
            <Button onClick={handleComplete} disabled={busy || !confirmAdjustments}>
              {busy ? 'Aplicando...' : 'Aplicar ajustes'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={cancelModalOpen}
        onClose={() => setCancelModalOpen(false)}
        title="Cancelar inventário"
        description="O inventário será encerrado sem alterar o estoque. As contagens feitas ficam apenas no histórico."
      >
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setCancelModalOpen(false)} disabled={busy}>
            Voltar
          </Button>
          <Button variant="danger" onClick={handleCancel} disabled={busy}>
            {busy ? 'Cancelando...' : 'Cancelar inventário'}
          </Button>
        </div>
      </Modal>
    </div>
  )
}

function SummaryTile({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-2xl font-semibold text-gray-900">{value}</p>
        {hint && <p className="text-xs text-gray-500">{hint}</p>}
      </CardContent>
    </Card>
  )
}
