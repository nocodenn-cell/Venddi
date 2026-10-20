import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, Button, Input } from '@/components/ui'
import { VideoTutorialsLibrary } from '@/components/VideoTutorial'
import { Search, MessageCircle, Book, Video, HelpCircle, ChevronDown, ChevronUp } from 'lucide-react'

interface FAQItem {
  question: string
  answer: string
  category: string
}

const faqItems: FAQItem[] = [
  {
    question: 'Como faço para cadastrar meu primeiro produto?',
    answer: 'Vá em Produtos > Novo Produto. Preencha o nome, SKU, preço de venda e quantidade em estoque. Clique em Salvar e pronto!',
    category: 'Produtos',
  },
  {
    question: 'Como abrir o caixa para começar a vender?',
    answer: 'Vá em Caixas > Abrir Caixa. Informe o valor inicial (fundo de troco) e clique em Abrir. Agora você pode realizar vendas no PDV.',
    category: 'Caixa',
  },
  {
    question: 'Quais formas de pagamento posso aceitar?',
    answer: 'A Venddi suporta dinheiro, cartão de crédito, cartão de débito e PIX. Você pode configurar as formas aceitas em Configurações > Pagamentos.',
    category: 'Pagamentos',
  },
  {
    question: 'Como faço o fechamento de caixa no fim do dia?',
    answer: 'Vá em Caixas > Fechar Caixa. O sistema mostrará o valor esperado. Informe o valor contado e clique em Fechar. O sistema calculará eventuais diferenças.',
    category: 'Caixa',
  },
  {
    question: 'Posso cancelar uma venda já finalizada?',
    answer: 'Sim! Vá em Vendas, localize a venda e clique em Cancelar. Informe o motivo do cancelamento. O sistema estornará o estoque e o financeiro automaticamente.',
    category: 'Vendas',
  },
  {
    question: 'Como vejo meus relatórios de vendas?',
    answer: 'Vá em Relatórios. Você pode ver vendas por período, produtos mais vendidos, formas de pagamento e muito mais. Os relatórios são atualizados em tempo real.',
    category: 'Relatórios',
  },
  {
    question: 'O que acontece quando meu trial de 30 dias acabar?',
    answer: 'Você receberá notificações antes do vencimento. Após o trial, você pode escolher um plano pago para continuar usando a Venddi. Seus dados serão preservados por 30 dias.',
    category: 'Assinatura',
  },
  {
    question: 'Posso usar a Venddi em mais de um computador?',
    answer: 'Sim! A Venddi é 100% online. Você pode acessar de qualquer dispositivo com internet, usando seu login e senha.',
    category: 'Geral',
  },
]

export function HelpCenterPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState<'faq' | 'videos' | 'contact'>('faq')

  const filteredFaqs = faqItems.filter(faq =>
    faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
    faq.answer.toLowerCase().includes(searchQuery.toLowerCase()) ||
    faq.category.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Central de Ajuda</h1>
        <p className="text-sm text-gray-500 mt-1">
          Encontre respostas, tutoriais e suporte
        </p>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <Input
              placeholder="Busque por palavras-chave..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('faq')}
          className={`px-4 py-2 font-medium text-sm transition-colors ${
            activeTab === 'faq'
              ? 'text-[#0EA572] border-b-2 border-[#0EA572]'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <HelpCircle className="h-4 w-4 inline mr-2" />
          Perguntas Frequentes
        </button>
        <button
          onClick={() => setActiveTab('videos')}
          className={`px-4 py-2 font-medium text-sm transition-colors ${
            activeTab === 'videos'
              ? 'text-[#0EA572] border-b-2 border-[#0EA572]'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Video className="h-4 w-4 inline mr-2" />
          Vídeos Tutoriais
        </button>
        <button
          onClick={() => setActiveTab('contact')}
          className={`px-4 py-2 font-medium text-sm transition-colors ${
            activeTab === 'contact'
              ? 'text-[#0EA572] border-b-2 border-[#0EA572]'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <MessageCircle className="h-4 w-4 inline mr-2" />
          Fale Conosco
        </button>
      </div>

      {/* Content */}
      {activeTab === 'faq' && (
        <Card>
          <CardHeader>
            <CardTitle>Perguntas Frequentes</CardTitle>
          </CardHeader>
          <CardContent>
            {filteredFaqs.length === 0 ? (
              <p className="text-center text-gray-500 py-8">
                Nenhuma pergunta encontrada para "{searchQuery}"
              </p>
            ) : (
              <div className="space-y-3">
                {filteredFaqs.map((faq, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg">
                    <button
                      onClick={() => setExpandedFaq(expandedFaq === index ? null : index)}
                      className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="text-xs">
                            {faq.category}
                          </Badge>
                        </div>
                        <p className="font-medium text-gray-900">{faq.question}</p>
                      </div>
                      {expandedFaq === index ? (
                        <ChevronUp className="h-5 w-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-gray-400" />
                      )}
                    </button>
                    {expandedFaq === index && (
                      <div className="px-4 pb-4 border-t border-gray-200">
                        <p className="text-gray-600 mt-3">{faq.answer}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === 'videos' && (
        <Card>
          <CardHeader>
            <CardTitle>Vídeos Tutoriais</CardTitle>
          </CardHeader>
          <CardContent>
            <VideoTutorialsLibrary />
          </CardContent>
        </Card>
      )}

      {activeTab === 'contact' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-[#0EA572]" />
                Chat de Suporte
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 mb-4">
                Fale com nossa equipe de suporte via WhatsApp. Resposta em até 30 minutos durante horário comercial.
              </p>
              <Button className="w-full">
                <MessageCircle className="h-4 w-4 mr-2" />
                Iniciar Chat
              </Button>
              <p className="text-xs text-gray-500 mt-2 text-center">
                Segunda a sexta, 8h às 18h
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Book className="h-5 w-5 text-blue-500" />
                Base de Conhecimento
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 mb-4">
                Acesse artigos detalhados, guias passo a passo e documentação completa do sistema.
              </p>
              <Button variant="outline" className="w-full">
                <Book className="h-4 w-4 mr-2" />
                Acessar Base
              </Button>
              <p className="text-xs text-gray-500 mt-2 text-center">
                +100 artigos disponíveis
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

// Helper component for Badge (if not already imported)
function Badge({ children, variant, className }: { children: React.ReactNode; variant: string; className?: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
      variant === 'outline' ? 'border border-gray-300 text-gray-700' : 'bg-gray-100 text-gray-700'
    } ${className || ''}`}>
      {children}
    </span>
  )
}
