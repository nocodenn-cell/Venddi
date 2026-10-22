-- Venddi landing · campos extras no hub comercial. NÃO APLICADO (aguarda autorização).
-- Projeto alvo: hub comercial Nature Code = Supabase kbabmewnahysfvlybiak, onde public.commercial_leads
-- já existe (migração 20261021115705, fastproduct hub/). Em vez de criar outra tabela "leads",
-- alinhamos com ela: product ('venddi'|'jinlong'), name, store, contact (WhatsApp), status default 'novo'.
-- Aditivo: só colunas novas, todas opcionais; nada do ERP/PDV é tocado.
alter table public.commercial_leads
  add column if not exists city text check (city is null or char_length(city) between 2 and 80),
  add column if not exists segment text check (segment is null or char_length(segment) between 2 and 60),
  add column if not exists utm_source text check (utm_source is null or char_length(utm_source) <= 100),
  add column if not exists utm_medium text check (utm_medium is null or char_length(utm_medium) <= 100),
  add column if not exists utm_campaign text check (utm_campaign is null or char_length(utm_campaign) <= 100);

-- anon continua só com INSERT (sem SELECT); a policy commercial_leads_anon_insert segue valendo.
grant insert (city, segment, utm_source, utm_medium, utm_campaign) on public.commercial_leads to anon;
