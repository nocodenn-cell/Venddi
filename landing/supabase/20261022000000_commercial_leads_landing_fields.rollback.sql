-- Rollback de 20261022000000 (remove só as colunas novas; leads e demais colunas intactos).
revoke insert (city, segment, utm_source, utm_medium, utm_campaign) on public.commercial_leads from anon;
alter table public.commercial_leads
  drop column if exists utm_campaign, drop column if exists utm_medium, drop column if exists utm_source,
  drop column if exists segment, drop column if exists city;
