const base = 'inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50'
const V = { primary: 'bg-[#0EA572] text-white hover:bg-[#087A54] shadow-sm', secondary: 'bg-gray-100 text-gray-900 hover:bg-gray-200', outline: 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50', ghost: 'text-gray-700 hover:bg-gray-100' }
const S = { sm: 'h-8 px-3 text-xs', md: 'h-10 px-4 text-sm', lg: 'h-12 px-6 text-base' }
type P = { variant?: keyof typeof V; size?: keyof typeof S; className?: string; children: React.ReactNode }
export const btn = ({ variant = 'primary', size = 'md', className = '' }: Omit<P, 'children'>) => `${base} ${V[variant]} ${S[size]} ${className}`
export function Button(p: P) { return <span className={btn(p)}>{p.children}</span> }
