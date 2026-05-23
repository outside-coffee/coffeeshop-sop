-- Colonne facture dans stock_movements
alter table stock_movements add column if not exists facture_url text;
alter table stock_movements add column if not exists fournisseur text;

-- Bucket Supabase Storage
-- À créer manuellement dans Supabase Storage → New Bucket → "factures" → Private

-- Vue factures pour historique
create or replace view v_factures as
select 
  sm.id,
  sm.item_id,
  si.name as item_name,
  si.category,
  sm.qty,
  sm.note,
  sm.fournisseur,
  sm.facture_url,
  sm.done_by,
  p.name as done_by_name,
  sm.created_at
from stock_movements sm
join stock_items si on sm.item_id = si.id
left join profiles p on sm.done_by = p.id
where sm.type = 'reception'
  and sm.facture_url is not null
order by sm.created_at desc;
