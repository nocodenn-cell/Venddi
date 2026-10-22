import type { Metadata } from 'next'
import Thanks from './Thanks'
export const metadata: Metadata = { title: 'Obrigado · Venddi', robots: { index: false, follow: false } }
export default function Page() { return <main><Thanks /></main> }
