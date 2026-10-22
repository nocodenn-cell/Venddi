# Venddi · landing pública (Next.js SSG)

App separado do PDV (`/src` não é alterado). `next build` gera HTML estático em `out/`.

**Hospedagem (custo zero):** novo projeto Vercel Hobby apontando para este repo com *Root Directory* = `landing`.
Depois, escolher o domínio público (ex.: `www`/raiz) para a landing e manter o PDV no projeto `venddi` atual.

**Leads:** gravados direto do navegador em `public.commercial_leads` do hub comercial (Supabase `kbabmewnahysfvlybiak`),
com a chave anon (só INSERT, sem SELECT). Exige antes a migração em `supabase/` (não aplicada).

Env (Vercel): ver `.env.example`. `NEXT_PUBLIC_WHATSAPP_NUMBER` é TODO; sem ele o botão do WhatsApp não aparece.
