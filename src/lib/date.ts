/**
 * Data no formato AAAA-MM-DD, no fuso local do navegador.
 * Não use toISOString(): ele converte para UTC e, à noite no Brasil, mostra o dia seguinte.
 */
export function toLocalDateInput(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
