// A API devolve no máximo PAGE_SIZE linhas por resposta. Este leitor percorre todas as
// páginas, para que contagens, somas e filtros cubram o conjunto inteiro.
export const PAGE_SIZE = 1000

export async function fetchAllRows<T>(
  query: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>
): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await query(from, from + PAGE_SIZE - 1)
    if (error) throw error
    const page = data ?? []
    rows.push(...page)
    if (page.length < PAGE_SIZE) return rows
  }
}
