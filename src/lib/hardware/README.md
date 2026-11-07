# Hardware (PDV)

Estado de cada periférico. "Real" = funciona no navegador sem driver. "Mock" = só simula.

| Dispositivo | Arquivo | Estado |
|---|---|---|
| Impressora de cupom | `browserReceiptPrinter.ts`, `receiptFormat.ts` | **Real** (caminho padrão). Usa `window.print()` num iframe com CSS de bobina 80mm/58mm. Sem driver: a impressora é a instalada no sistema operacional. |
| Leitor de código de barras (teclado/HID) | `barcodeKeyboardReader.ts` | **Real como utilitário**. Lê rajadas de teclas terminadas em Enter. Ainda **não integrado ao PDV**. |
| Impressora ESC/POS (USB, rede, serial) | `thermalPrinter.ts` | **Mock / sem driver**. `ThermalPrinter` monta os comandos, mas `connectUSB` depende de WebUSB e o fluxo não foi testado com hardware. Não é usado pela página. |
| Gaveta de dinheiro | `cashDrawer.ts` | **Mock**. Abrir a gaveta exige o comando ESC/POS enviado pela impressora (`ESC p`). Como `window.print` não envia bytes de controle, não há como acionar a gaveta por esse caminho. |

## Impressão de cupom

- `buildReceiptLines(data, columns)` gera as linhas do cupom (48 colunas em 80mm, 32 em 58mm).
- `buildReceiptHtml(data, paperWidth)` monta o HTML com `@page { size: 80mm auto; margin: 0 }`.
- `printReceiptViaBrowser(data, paperWidth)` abre o HTML num iframe oculto e chama `print()`.
- O cupom é **não fiscal**. Não substitui NFC-e/SAT.

Para testar: Configurações de Hardware → "Imprimir Cupom de Teste". No diálogo, escolha a impressora térmica, desative cabeçalho e rodapé e use margem "nenhuma".

## Leitor de código de barras

- `createBarcodeParser({ maxInterKeyMs, minLength, maxLength })` é uma máquina de estados pura. `push({ key, timestamp })` devolve o código quando a rajada termina com Enter.
- Teclas separadas por mais de `maxInterKeyMs` (padrão 50 ms) descartam o buffer, para não confundir digitação humana com leitura.
- Rajadas acima de `maxLength` são descartadas inteiras.
- `attachBarcodeKeyboardReader({ onScan })` escuta `keydown` no documento. Não chama `preventDefault`, então o texto continua indo para o campo focado. Ignora combinações com Ctrl, Alt ou Meta.

Para testar: Configurações de Hardware → "Iniciar Escuta" → escanear um código. O valor aparece em "Último código lido".

## Próximos passos (fora desta versão)

- Ligar `barcodeKeyboardReader` ao PDV (campo de busca/adição de item). Isso depende de PR separado, porque `PDVPage.tsx` está em outra alteração.
- Driver ESC/POS para gaveta e para cupom direto na impressora, se o cliente precisar de corte automático e abertura de gaveta.
- `barcodeScanner.ts` ainda tem um listener HID próprio (`BarcodeScanner`), não usado pela página. Pode ser removido ou reescrito em cima do parser novo.
