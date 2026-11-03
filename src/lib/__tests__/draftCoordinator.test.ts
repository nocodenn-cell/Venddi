import { describe, it, expect } from 'vitest'
import { DraftCoordinator } from '@/lib/inventory/draftCoordinator'

// Promessa controlada: o teste decide quando o servidor responde (ou falha).
function deferred() {
  let resolve!: (value?: unknown) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<unknown>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function makeCoordinator() {
  const calls: Array<{ itemId: string; value: number }> = []
  const pending: Array<ReturnType<typeof deferred>> = []
  const coordinator = new DraftCoordinator((itemId, value) => {
    calls.push({ itemId, value })
    const d = deferred()
    pending.push(d)
    return d.promise
  })
  return { coordinator, calls, pending }
}

describe('Voltar com salvamento pendente', () => {
  it('não reenvia a mesma contagem enquanto o salvamento do campo está em voo', async () => {
    const { coordinator, calls, pending } = makeCoordinator()
    coordinator.setDraft('A', '8')
    const blurSave = coordinator.saveOne('A') // blur: salvamento em voo
    expect(coordinator.isSaving('A')).toBe(true)

    const leaving = coordinator.flush(['A']) // Voltar durante o salvamento
    pending[0].resolve()
    await blurSave
    expect(await leaving).toBe(true)

    expect(calls).toEqual([{ itemId: 'A', value: 8 }]) // uma única persistência
    expect(coordinator.getDraft('A')).toBeUndefined()
    expect(coordinator.hasPending()).toBe(false)
  })

  it('dois salvamentos concorrentes do mesmo item geram uma persistência', async () => {
    const { coordinator, calls, pending } = makeCoordinator()
    coordinator.setDraft('A', '8')
    const first = coordinator.saveOne('A')
    const second = coordinator.saveOne('A')
    pending[0].resolve()
    await Promise.all([first, second])
    expect(calls).toHaveLength(1)
  })
})

describe('Concluir com salvamentos em andamento', () => {
  it('não permite concluir enquanto há salvamento em voo e libera depois', async () => {
    const { coordinator, pending } = makeCoordinator()
    coordinator.setDraft('A', '8')
    const save = coordinator.saveOne('A')
    expect(coordinator.canComplete()).toBe(false)

    pending[0].resolve()
    await save
    expect(coordinator.canComplete()).toBe(true)
  })

  it('não permite concluir com rascunho ainda não enviado', () => {
    const { coordinator } = makeCoordinator()
    coordinator.setDraft('A', '8')
    expect(coordinator.canComplete()).toBe(false)
  })
})

describe('Falha no salvamento', () => {
  it('mantém o rascunho, registra o erro e não conclui', async () => {
    const coordinator = new DraftCoordinator(async () => {
      throw new Error('Sem conexão')
    })
    coordinator.setDraft('A', '8')
    expect(await coordinator.saveOne('A')).toBe(false)

    expect(coordinator.getDraft('A')).toBe('8') // nada perdido
    expect(coordinator.snapshot().errors).toEqual({ A: 'Sem conexão' })
    expect(coordinator.canComplete()).toBe(false)
  })

  it('ao sair com falha, flush devolve false e o rascunho continua disponível para nova tentativa', async () => {
    let fail = true
    const persisted: number[] = []
    const coordinator = new DraftCoordinator(async (_id, value) => {
      if (fail) throw new Error('Falhou')
      persisted.push(value)
    })
    coordinator.setDraft('A', '5')
    expect(await coordinator.flush(['A'])).toBe(false)
    expect(coordinator.getDraft('A')).toBe('5')

    fail = false
    expect(await coordinator.flush(['A'])).toBe(true)
    expect(persisted).toEqual([5])
    expect(coordinator.getDraft('A')).toBeUndefined()
    expect(coordinator.snapshot().errors).toEqual({})
  })

  it('edição feita durante o salvamento continua pendente e é a próxima a ser persistida', async () => {
    const { coordinator, calls, pending } = makeCoordinator()
    coordinator.setDraft('A', '8')
    const save = coordinator.saveOne('A')
    coordinator.setDraft('A', '9') // operador corrige durante o salvamento
    pending[0].resolve()
    await save

    expect(coordinator.getDraft('A')).toBe('9') // não foi apagada
    expect(calls).toEqual([{ itemId: 'A', value: 8 }])

    const next = coordinator.saveOne('A')
    pending[1].resolve()
    await next
    expect(calls).toEqual([
      { itemId: 'A', value: 8 },
      { itemId: 'A', value: 9 },
    ])
    expect(coordinator.getDraft('A')).toBeUndefined()
  })
})

describe('Persistência única por alteração', () => {
  it('sem nova alteração, salvar de novo não persiste', async () => {
    const { coordinator, calls, pending } = makeCoordinator()
    coordinator.setDraft('A', '8')
    const first = coordinator.saveOne('A')
    pending[0].resolve()
    await first
    await coordinator.saveOne('A') // blur sem alteração
    await coordinator.flush(['A'])
    expect(calls).toHaveLength(1)
  })

  it('nova alteração gera nova persistência, uma vez', async () => {
    const { coordinator, calls, pending } = makeCoordinator()
    coordinator.setDraft('A', '8')
    const first = coordinator.saveOne('A')
    pending[0].resolve()
    await first
    coordinator.setDraft('A', '7')
    const second = coordinator.saveOne('A')
    pending[1].resolve()
    await second
    expect(calls).toEqual([
      { itemId: 'A', value: 8 },
      { itemId: 'A', value: 7 },
    ])
  })

  it('itens diferentes são persistidos cada um uma vez', async () => {
    const { coordinator, calls, pending } = makeCoordinator()
    coordinator.setDraft('A', '1')
    coordinator.setDraft('B', '2')
    const all = coordinator.flush(['A', 'B'])
    pending[0].resolve()
    await new Promise((r) => setTimeout(r, 0))
    pending[1]?.resolve()
    await all
    expect(calls.map((c) => c.itemId).sort()).toEqual(['A', 'B'])
    expect(calls).toHaveLength(2)
  })
})

describe('Validação e bloqueio de conclusão', () => {
  it('valor inválido não é persistido e vira erro', async () => {
    const { coordinator, calls } = makeCoordinator()
    coordinator.setDraft('A', '-1')
    expect(await coordinator.saveOne('A')).toBe(false)
    expect(calls).toHaveLength(0)
    expect(coordinator.snapshot().errors.A).toContain('negativa')
    expect(coordinator.canComplete()).toBe(false)
  })

  it('reset (cancelar inventário) limpa rascunhos e erros', () => {
    const { coordinator } = makeCoordinator()
    coordinator.setDraft('A', '-1')
    coordinator.setError('A', 'erro')
    coordinator.reset()
    expect(coordinator.hasPending()).toBe(false)
    expect(coordinator.snapshot().errors).toEqual({})
  })

  it('sem nada pendente a contagem pode ser concluída', () => {
    const { coordinator } = makeCoordinator()
    expect(coordinator.canComplete()).toBe(true)
  })
})
