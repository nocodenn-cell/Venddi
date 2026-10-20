import { useState } from 'react'
import { Button } from '@/components/ui'
import { Download, FileText, FileSpreadsheet } from 'lucide-react'

interface ExportButtonProps {
  data: any[]
  filename: string
  columns: { key: string; label: string }[]
}

export function ExportButton({ data, filename, columns }: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false)

  const exportToCSV = () => {
    setIsExporting(true)

    try {
      // Criar header
      const headers = columns.map(col => col.label).join(',')
      
      // Criar linhas
      const rows = data.map(item => {
        return columns.map(col => {
          const value = item[col.key]
          // Escapar valores com vírgulas ou aspas
          if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
            return `"${value.replace(/"/g, '""')}"`
          }
          return value
        }).join(',')
      })

      // Combinar tudo
      const csv = [headers, ...rows].join('\n')
      
      // Criar blob e download
      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', `${filename}.csv`)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (error) {
      console.error('Error exporting to CSV:', error)
      alert('Erro ao exportar para CSV')
    } finally {
      setIsExporting(false)
    }
  }

  const exportToJSON = () => {
    setIsExporting(true)

    try {
      const json = JSON.stringify(data, null, 2)
      const blob = new Blob([json], { type: 'application/json' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', `${filename}.json`)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (error) {
      console.error('Error exporting to JSON:', error)
      alert('Erro ao exportar para JSON')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="flex gap-2">
      <Button
        variant="outline"
        onClick={exportToCSV}
        disabled={isExporting || data.length === 0}
        title="Exportar para CSV (Excel)"
      >
        <FileSpreadsheet className="h-4 w-4 mr-2" />
        Excel
      </Button>
      <Button
        variant="outline"
        onClick={exportToJSON}
        disabled={isExporting || data.length === 0}
        title="Exportar para JSON"
      >
        <FileText className="h-4 w-4 mr-2" />
        JSON
      </Button>
    </div>
  )
}
