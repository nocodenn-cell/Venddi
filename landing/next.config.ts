import type { NextConfig } from 'next'
// SSG puro: `next build` gera HTML estático em out/ (Vercel Hobby, custo zero).
const config: NextConfig = { output: 'export', trailingSlash: true, images: { unoptimized: true } }
export default config
