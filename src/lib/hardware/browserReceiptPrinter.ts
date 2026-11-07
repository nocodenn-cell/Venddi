/**
 * Impressão de cupom pelo navegador (caminho padrão, sem driver).
 *
 * Abre o cupom num iframe oculto e chama window.print() sobre ele, para que
 * só o cupom seja impresso (não a tela inteira do VENDDI). A impressora é
 * qualquer impressora instalada no sistema operacional: térmica 80mm/58mm
 * ou comum. O usuário escolhe a impressora no diálogo do navegador.
 *
 * Limitações: não abre gaveta, não corta papel (depende da configuração do
 * driver/diálogo) e não confirma se a impressão saiu. Para isso seria
 * preciso o caminho ESC/POS em thermalPrinter.ts (ainda sem driver).
 */

import { buildReceiptHtml, ReceiptData, ReceiptPaperWidth } from './receiptFormat'

/**
 * Imprime o HTML informado via iframe oculto + window.print().
 * Resolve `true` quando o diálogo de impressão foi disparado; `false` se o
 * ambiente não tiver DOM ou o iframe não puder ser criado.
 */
export function printHtmlViaBrowser(html: string): Promise<boolean> {
  if (typeof document === 'undefined' || !document.body) {
    return Promise.resolve(false)
  }

  return new Promise<boolean>((resolve) => {
    // Blob URL em vez de document.write: o load do iframe só dispara para o cupom,
    // sem o load inicial de about:blank que dispararia a impressão em branco.
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }))
    const iframe = document.createElement('iframe')
    iframe.setAttribute('aria-hidden', 'true')
    iframe.style.position = 'fixed'
    iframe.style.right = '0'
    iframe.style.bottom = '0'
    iframe.style.width = '0'
    iframe.style.height = '0'
    iframe.style.border = '0'
    iframe.style.visibility = 'hidden'

    const cleanup = () => {
      // Atraso: remover o iframe antes do diálogo abrir cancela a impressão em alguns navegadores.
      setTimeout(() => {
        iframe.remove()
        URL.revokeObjectURL(url)
      }, 1000)
    }

    iframe.onload = () => {
      const frameWindow = iframe.contentWindow
      if (!frameWindow) {
        cleanup()
        resolve(false)
        return
      }
      try {
        frameWindow.focus()
        frameWindow.print()
        resolve(true)
      } catch (error) {
        console.error('Erro ao imprimir cupom:', error)
        resolve(false)
      } finally {
        cleanup()
      }
    }

    iframe.src = url
    document.body.appendChild(iframe)
  })
}

/** Gera o HTML do cupom e envia para impressão pelo navegador. */
export function printReceiptViaBrowser(
  data: ReceiptData,
  paperWidth: ReceiptPaperWidth = 80,
): Promise<boolean> {
  return printHtmlViaBrowser(buildReceiptHtml(data, paperWidth))
}
