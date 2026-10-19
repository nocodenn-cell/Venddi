import { useState } from 'react'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'
import { Button, Card, CardContent, CardHeader, CardTitle, Badge } from '@/components/ui'
import { Download, FileText, Folder, CheckCircle, AlertCircle } from 'lucide-react'

// Lista completa de arquivos do projeto BLUM ERP
const PROJECT_FILES = [
  // Configurações raiz
  'package.json',
  'package-lock.json',
  'vite.config.js',
  'tsconfig.json',
  'index.html',
  'README.md',
  '.env.example',
  '.gitignore',
  
  // Documentação
  'docs/ARCHITECTURE.md',
  'docs/BACKLOG.md',
  'docs/BLUM_REUSE_ASSESSMENT.md',
  'docs/DATABASE.md',
  'docs/PROGRESS.md',
  'docs/ROADMAP.md',
  'docs/SECURITY.md',
  'docs/SPRINT_01_1_REPORT.md',
  'docs/SPRINT_01_2_REPORT.md',
  
  // Código fonte - Componentes
  'src/App.tsx',
  'src/main.tsx',
  'src/index.css',
  'src/vite-env.d.ts',
  'src/components/forms/ProductForm.tsx',
  'src/components/layout/AdminLayout.tsx',
  'src/components/layout/Sidebar.tsx',
  'src/components/ui/Badge.tsx',
  'src/components/ui/Button.tsx',
  'src/components/ui/Card.tsx',
  'src/components/ui/Input.tsx',
  'src/components/ui/Modal.tsx',
  'src/components/ui/Pagination.tsx',
  'src/components/ui/Select.tsx',
  'src/components/ui/Textarea.tsx',
  'src/components/ui/index.ts',
  
  // Código fonte - Lib
  'src/lib/api/products.ts',
  'src/lib/router.tsx',
  'src/lib/schemas.ts',
  'src/lib/services/auth.ts',
  'src/lib/store/auth.ts',
  'src/lib/supabase.ts',
  'src/lib/utils.ts',
  
  // Testes
  'src/lib/__tests__/permissions.test.ts',
  'src/lib/__tests__/schemas.test.ts',
  'src/lib/__tests__/utils.test.ts',
  
  // Páginas
  'src/pages/DashboardPage.tsx',
  'src/pages/LoginPage.tsx',
  'src/pages/PlaceholderPage.tsx',
  'src/pages/ProductsPage.tsx',
  'src/pages/RegisterPage.tsx',
  
  // Supabase - Migrations
  'supabase/migrations/001_foundation.sql',
  'supabase/migrations/002_products_stock.sql',
  'supabase/migrations/003_sales_customers.sql',
  'supabase/migrations/004_cashier_financial.sql',
  'supabase/migrations/005_rls_policies.sql',
  
  // Supabase - Testes
  'supabase/tests/rls_isolation_test.sql',
]

interface ExportProgress {
  status: 'idle' | 'fetching' | 'zipping' | 'complete' | 'error'
  currentFile: string
  filesProcessed: number
  totalFiles: number
  error?: string
}

export function ExportPage() {
  const [progress, setProgress] = useState<ExportProgress>({
    status: 'idle',
    currentFile: '',
    filesProcessed: 0,
    totalFiles: PROJECT_FILES.length,
  })

  const handleExport = async () => {
    try {
      setProgress({
        status: 'fetching',
        currentFile: '',
        filesProcessed: 0,
        totalFiles: PROJECT_FILES.length,
      })

      const zip = new JSZip()

      // Buscar todos os arquivos
      for (let i = 0; i < PROJECT_FILES.length; i++) {
        const filePath = PROJECT_FILES[i]
        setProgress((prev) => ({
          ...prev,
          currentFile: filePath,
          filesProcessed: i,
        }))

        try {
          const response = await fetch(`/${filePath}`)
          if (!response.ok) {
            console.warn(`Arquivo não encontrado: ${filePath}`)
            continue
          }
          
          const content = await response.text()
          zip.file(filePath, content)
        } catch (error) {
          console.warn(`Erro ao buscar ${filePath}:`, error)
        }
      }

      setProgress((prev) => ({
        ...prev,
        status: 'zipping',
        filesProcessed: PROJECT_FILES.length,
      }))

      // Gerar ZIP
      const blob = await zip.generateAsync({ 
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 9 }
      })

      // Download
      saveAs(blob, 'BLUM-ERP.zip')

      setProgress({
        status: 'complete',
        currentFile: '',
        filesProcessed: PROJECT_FILES.length,
        totalFiles: PROJECT_FILES.length,
      })
    } catch (error) {
      setProgress({
        status: 'error',
        currentFile: '',
        filesProcessed: 0,
        totalFiles: PROJECT_FILES.length,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      })
    }
  }

  const progressPercentage = (progress.filesProcessed / progress.totalFiles) * 100

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-4 flex items-center justify-center">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center">
              <Download className="h-6 w-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-2xl">Exportar BLUM ERP</CardTitle>
              <p className="text-sm text-gray-500 mt-1">
                Gere um arquivo ZIP com todo o código-fonte do projeto
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Informações do projeto */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Folder className="h-4 w-4" />
              Conteúdo do ZIP
            </h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2">
                <FileText className="h-3 w-3 text-gray-400" />
                <span className="text-gray-600">src/ — Código fonte</span>
              </div>
              <div className="flex items-center gap-2">
                <FileText className="h-3 w-3 text-gray-400" />
                <span className="text-gray-600">supabase/ — Migrations</span>
              </div>
              <div className="flex items-center gap-2">
                <FileText className="h-3 w-3 text-gray-400" />
                <span className="text-gray-600">docs/ — Documentação</span>
              </div>
              <div className="flex items-center gap-2">
                <FileText className="h-3 w-3 text-gray-400" />
                <span className="text-gray-600">Configurações</span>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-gray-200">
              <p className="text-xs text-gray-500">
                Total: <strong>{PROJECT_FILES.length} arquivos</strong>
              </p>
            </div>
          </div>

          {/* Progresso */}
          {progress.status !== 'idle' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">
                  {progress.status === 'fetching' && 'Buscando arquivos...'}
                  {progress.status === 'zipping' && 'Gerando arquivo ZIP...'}
                  {progress.status === 'complete' && 'Exportação concluída!'}
                  {progress.status === 'error' && 'Erro na exportação'}
                </span>
                <span className="font-mono text-gray-500">
                  {progress.filesProcessed} / {progress.totalFiles}
                </span>
              </div>
              
              {/* Barra de progresso */}
              <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                <div
                  className="h-full bg-emerald-600 transition-all duration-300 ease-out"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>

              {/* Arquivo atual */}
              {progress.status === 'fetching' && progress.currentFile && (
                <p className="text-xs text-gray-500 font-mono truncate">
                  {progress.currentFile}
                </p>
              )}

              {/* Status */}
              {progress.status === 'complete' && (
                <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 p-3 rounded-lg">
                  <CheckCircle className="h-4 w-4" />
                  <span>Arquivo BLUM-ERP.zip gerado com sucesso!</span>
                </div>
              )}

              {progress.status === 'error' && (
                <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 p-3 rounded-lg">
                  <AlertCircle className="h-4 w-4" />
                  <span>{progress.error}</span>
                </div>
              )}
            </div>
          )}

          {/* Botão de exportação */}
          <div className="flex gap-3">
            <Button
              onClick={handleExport}
              disabled={progress.status === 'fetching' || progress.status === 'zipping'}
              className="flex-1"
            >
              <Download className="h-4 w-4" />
              {progress.status === 'idle' && 'Gerar ZIP'}
              {progress.status === 'fetching' && 'Buscando arquivos...'}
              {progress.status === 'zipping' && 'Gerando ZIP...'}
              {progress.status === 'complete' && 'Exportar Novamente'}
              {progress.status === 'error' && 'Tentar Novamente'}
            </Button>
          </div>

          {/* Instruções */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-semibold text-blue-900 mb-2 text-sm">
              Instruções para Windows
            </h4>
            <ol className="text-xs text-blue-800 space-y-1 list-decimal list-inside">
              <li>Clique em "Gerar ZIP" para criar o arquivo</li>
              <li>O download iniciará automaticamente</li>
              <li>Extraia o ZIP na pasta desejada</li>
              <li>Execute <code className="bg-blue-100 px-1 rounded">npm install</code> para instalar dependências</li>
              <li>Configure o arquivo <code className="bg-blue-100 px-1 rounded">.env</code> com suas credenciais Supabase</li>
              <li>Execute <code className="bg-blue-100 px-1 rounded">npm run dev</code> para iniciar o servidor</li>
            </ol>
          </div>

          {/* Nota de segurança */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <h4 className="font-semibold text-amber-900 mb-2 text-sm flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Nota de Segurança
            </h4>
            <p className="text-xs text-amber-800">
              O arquivo ZIP <strong>não inclui</strong> node_modules, dist, caches ou credenciais reais.
              Após extração, você precisará executar <code className="bg-amber-100 px-1 rounded">npm install</code> para
              reinstalar as dependências e configurar suas credenciais Supabase no arquivo .env.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
