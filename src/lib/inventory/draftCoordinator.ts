// Coordenação dos rascunhos de contagem (sem React e sem I/O próprio: a persistência é injetada).
//
// Regras:
// - Cada alteração do operador é persistida no máximo uma vez. Se já há salvamento em voo para o
//   item, a nova tentativa espera por ele e não reenvia a mesma contagem.
// - Falha de persistência mantém o rascunho e registra o erro. Nada é perdido.
// - Uma edição feita durante o salvamento continua pendente depois dele.
// - Não se conclui a contagem com rascunho pendente, salvamento em voo ou erro.

import { parseCountedInput } from './countMath'

export type PersistFn = (itemId: string, countedQuantity: number) => Promise<unknown>

export interface DraftSnapshot {
  drafts: Record<string, string>
  errors: Record<string, string>
  saving: string[]
}

export class DraftCoordinator {
  private drafts: Record<string, string> = {}
  private errors: Record<string, string> = {}
  private inFlight = new Map<string, Promise<boolean>>()
  private listeners: Array<() => void> = []

  constructor(private readonly persist: PersistFn) {}

  subscribe(listener: () => void): () => void {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener)
    }
  }

  private notify(): void {
    this.listeners.forEach((listener) => listener())
  }

  snapshot(): DraftSnapshot {
    return {
      drafts: { ...this.drafts },
      errors: { ...this.errors },
      saving: [...this.inFlight.keys()],
    }
  }

  getDraft(itemId: string): string | undefined {
    return this.drafts[itemId]
  }

  setDraft(itemId: string, value: string | null): void {
    const next = { ...this.drafts }
    if (value === null) delete next[itemId]
    else next[itemId] = value
    this.drafts = next
    this.notify()
  }

  setError(itemId: string, message: string | null): void {
    const next = { ...this.errors }
    if (message === null) delete next[itemId]
    else next[itemId] = message
    this.errors = next
    this.notify()
  }

  reset(): void {
    this.drafts = {}
    this.errors = {}
    this.notify()
  }

  isSaving(itemId: string): boolean {
    return this.inFlight.has(itemId)
  }

  /** Há algo que impede sair ou concluir sem perda: rascunho, salvamento em voo ou erro. */
  hasPending(): boolean {
    return Object.keys(this.drafts).length > 0 || this.inFlight.size > 0
  }

  canComplete(): boolean {
    return !this.hasPending() && Object.keys(this.errors).length === 0
  }

  /** Salva o rascunho atual do item (uma persistência por alteração). Retorna true se não há pendência. */
  async saveOne(itemId: string): Promise<boolean> {
    const pending = this.inFlight.get(itemId)
    if (pending) await pending

    const raw = this.drafts[itemId]
    if (raw === undefined) return true

    const parsed = parseCountedInput(raw)
    if (!parsed.ok) {
      this.setError(itemId, parsed.error)
      return false
    }

    const run = (async (): Promise<boolean> => {
      try {
        this.setError(itemId, null)
        await this.persist(itemId, parsed.value)
        // Só limpa se o valor não mudou durante o salvamento
        if (this.drafts[itemId] === raw) this.setDraft(itemId, null)
        return true
      } catch (err) {
        this.setError(itemId, err instanceof Error ? err.message : 'Erro ao salvar contagem')
        return false
      }
    })()

    this.inFlight.set(itemId, run)
    this.notify()
    try {
      return await run
    } finally {
      if (this.inFlight.get(itemId) === run) this.inFlight.delete(itemId)
      this.notify()
    }
  }

  /** Salva os rascunhos dos itens dados, esperando os salvamentos em voo. Retorna true se tudo foi salvo. */
  async flush(itemIds: string[]): Promise<boolean> {
    let allSaved = true
    for (const itemId of itemIds) {
      if (this.drafts[itemId] === undefined && !this.inFlight.has(itemId)) continue
      if (!(await this.saveOne(itemId))) allSaved = false
    }
    return allSaved
  }

  /** Espera todos os salvamentos em voo terminarem (sem iniciar novos). */
  async settle(): Promise<void> {
    await Promise.all([...this.inFlight.values()])
  }
}
