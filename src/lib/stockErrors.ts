// Mensagens de estoque vêm do banco (trigger de saldo e RPC de venda). Esta função
// reconhece essas mensagens para repassá-las ao operador, em vez do erro genérico.
export function stockErrorMessage(error: unknown): string | null {
  const message = (error as { message?: string } | null)?.message ?? ''

  const named = message.match(/Estoque insuficiente para o produto (\S+)/)
  if (named) {
    return `Estoque insuficiente para o produto ${named[1]}. Ajuste a quantidade e tente novamente.`
  }

  if (/insufficient stock|estoque insuficiente/i.test(message)) {
    return 'Estoque insuficiente para um dos produtos. Ajuste a quantidade e tente novamente.'
  }

  return null
}
