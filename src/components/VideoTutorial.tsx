import { useState } from 'react'
import { Modal, Button } from '@/components/ui'
import { Play, X } from 'lucide-react'

interface VideoTutorialProps {
  title: string
  description: string
  videoUrl: string
  thumbnailUrl?: string
  duration?: string
}

export function VideoTutorial({ title, description, videoUrl, thumbnailUrl, duration }: VideoTutorialProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="w-full group"
      >
        <div className="relative aspect-video bg-gray-100 rounded-lg overflow-hidden mb-3">
          {thumbnailUrl ? (
            <img src={thumbnailUrl} alt={title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#0EA572] to-[#087A54]">
              <Play className="h-12 w-12 text-white" />
            </div>
          )}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
            <div className="w-16 h-16 bg-white/90 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Play className="h-8 w-8 text-[#0EA572] ml-1" />
            </div>
          </div>
          {duration && (
            <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-2 py-1 rounded">
              {duration}
            </div>
          )}
        </div>
        <h3 className="font-semibold text-gray-900 text-left mb-1">{title}</h3>
        <p className="text-sm text-gray-500 text-left">{description}</p>
      </button>

      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} size="xl">
        <div className="aspect-video bg-black rounded-lg overflow-hidden">
          <iframe
            src={videoUrl}
            title={title}
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
        <div className="mt-4">
          <h3 className="text-xl font-bold text-gray-900 mb-2">{title}</h3>
          <p className="text-gray-600">{description}</p>
        </div>
      </Modal>
    </>
  )
}

// Biblioteca de tutoriais em vídeo
export const videoTutorials = [
  {
    id: 'getting-started',
    title: 'Começando com a Venddi',
    description: 'Aprenda a configurar sua loja em menos de 10 minutos',
    videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ', // Placeholder
    duration: '5:30',
  },
  {
    id: 'first-sale',
    title: 'Realizando sua primeira venda',
    description: 'Veja como é fácil vender com o PDV da Venddi',
    videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ', // Placeholder
    duration: '3:45',
  },
  {
    id: 'products',
    title: 'Cadastrando produtos',
    description: 'Aprenda a adicionar produtos manualmente ou importar de planilha',
    videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ', // Placeholder
    duration: '4:20',
  },
  {
    id: 'cash-register',
    title: 'Gerenciando o caixa',
    description: 'Abra, feche e gerencie o caixa da sua loja',
    videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ', // Placeholder
    duration: '6:10',
  },
  {
    id: 'reports',
    title: 'Analisando relatórios',
    description: 'Entenda seus resultados com os relatórios da Venddi',
    videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ', // Placeholder
    duration: '7:15',
  },
]

export function VideoTutorialsLibrary() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {videoTutorials.map((tutorial) => (
        <VideoTutorial
          key={tutorial.id}
          title={tutorial.title}
          description={tutorial.description}
          videoUrl={tutorial.videoUrl}
          duration={tutorial.duration}
        />
      ))}
    </div>
  )
}
