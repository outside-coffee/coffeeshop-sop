create or replace function public.get_consumption_variance(p_from date, p_to date)
returns table (
  material_key text,
  matiere text,
  unite text,
  stock_debut numeric,
  receptions numeric,
  pertes_declarees numeric,
  stock_fin numeric,
  conso_theorique numeric,
  conso_reelle numeric,
  stock_theorique_fin numeric,
  ecart numeric,
  ecart_pct numeric,
  cout_theorique numeric,
  cout_ecart numeric,
  prix_unitaire numeric,
  has_inventaire boolean,
  diagnostic text
)
language sql
security invoker
set search_path = ''
as $function$
  with
  base_names as (
    select distinct lower(extensions.unaccent(trim(cp.nom_produit))) as material_key
    from public.composition_produit cp
    where cp.type = 'base'
  ),
  materials as (
    select
      lower(extensions.unaccent(trim(mp.matiere))) as material_key,
      mp.matiere,
      mp.unite,
      case when mp.quantite > 0 then mp.prix / mp.quantite else 0 end as prix_unitaire
    from public.matiere_premiere mp
    where mp.actif is true
      and not exists (
        select 1 from base_names b
        where b.material_key = lower(extensions.unaccent(trim(mp.matiere)))
      )
  ),
  theoretical as (
    select
      lower(extensions.unaccent(trim(v.matiere))) as material_key,
      sum(v.qte_theo)::numeric as quantity,
      sum(v.cout_theo)::numeric as cost
    from public.v_conso_theorique v
    where v.date_vente > p_from and v.date_vente <= p_to
    group by 1
  ),
  opening_inventory as (
    select lower(extensions.unaccent(trim(i.item_name))) as material_key,
           max(i.qte_physique)::numeric as quantity
    from public.stock_inventaires i
    where i.date_inventaire = p_from
    group by 1
  ),
  closing_inventory as (
    select lower(extensions.unaccent(trim(i.item_name))) as material_key,
           max(i.qte_physique)::numeric as quantity
    from public.stock_inventaires i
    where i.date_inventaire = p_to
    group by 1
  ),
  receipts as (
    select
      lower(extensions.unaccent(trim(coalesce(si.matiere_ref, si.name)))) as material_key,
      sum(sm.qty)::numeric as quantity
    from public.stock_movements sm
    join public.stock_items si on si.id = sm.item_id
    where sm.type = 'reception'
      and sm.created_at > (p_from::text || 'T23:59:59')::timestamp
      and sm.created_at < ((p_to + 1)::text || 'T00:00:00')::timestamp
    group by 1
  ),
  declared_losses as (
    select
      lower(extensions.unaccent(trim(coalesce(l.matiere_ref, l.item_name)))) as material_key,
      sum(l.qte)::numeric as quantity
    from public.stock_pertes l
    where l.date_perte > p_from and l.date_perte <= p_to
    group by 1
  ),
  relevant_keys as (
    select material_key from theoretical
    union select material_key from opening_inventory
    union select material_key from closing_inventory
    union select material_key from receipts
    union select material_key from declared_losses
  ),
  calculated as (
    select
      m.material_key,
      m.matiere,
      m.unite,
      oi.quantity as stock_debut,
      coalesce(r.quantity, 0) as receptions,
      coalesce(dl.quantity, 0) as pertes_declarees,
      ci.quantity as stock_fin,
      coalesce(t.quantity, 0) as conso_theorique,
      case when oi.quantity is not null and ci.quantity is not null
        then oi.quantity + coalesce(r.quantity, 0) - ci.quantity - coalesce(dl.quantity, 0)
      end as conso_reelle,
      case when oi.quantity is not null and ci.quantity is not null
        then oi.quantity + coalesce(r.quantity, 0) - coalesce(t.quantity, 0) - coalesce(dl.quantity, 0)
      end as stock_theorique_fin,
      coalesce(t.cost, coalesce(t.quantity, 0) * m.prix_unitaire) as cout_theorique,
      m.prix_unitaire,
      oi.quantity is not null and ci.quantity is not null as has_inventaire
    from relevant_keys k
    join materials m using (material_key)
    left join theoretical t using (material_key)
    left join opening_inventory oi using (material_key)
    left join closing_inventory ci using (material_key)
    left join receipts r using (material_key)
    left join declared_losses dl using (material_key)
  ),
  with_variance as (
    select c.*,
      case when c.has_inventaire then c.conso_reelle - c.conso_theorique end as ecart
    from calculated c
  )
  select
    v.material_key, v.matiere, v.unite,
    v.stock_debut, v.receptions, v.pertes_declarees, v.stock_fin,
    v.conso_theorique, v.conso_reelle, v.stock_theorique_fin, v.ecart,
    case when v.conso_theorique > 0 and v.ecart is not null
      then round(v.ecart / v.conso_theorique * 100, 1)
    end as ecart_pct,
    round(v.cout_theorique, 2) as cout_theorique,
    case when v.ecart is not null then round(v.ecart * v.prix_unitaire, 2) end as cout_ecart,
    v.prix_unitaire, v.has_inventaire,
    case
      when not v.has_inventaire then 'inventaire_manquant'
      when v.conso_theorique = 0 and abs(coalesce(v.conso_reelle, 0)) > 0.01 then 'conso_sans_recette'
      when v.conso_theorique > 0 and abs(v.ecart / v.conso_theorique * 100) < 5 then 'conforme'
      when v.ecart > 0 then 'surconsommation'
      when v.ecart < 0 then 'sous_consommation'
      else 'conforme'
    end as diagnostic
  from with_variance v;
$function$;

create or replace function public.get_consumption_variance_detail(
  p_from date,
  p_to date,
  p_matiere text
)
returns table (
  produit text,
  nb_ventes numeric,
  grammage_unitaire numeric,
  qte_conso numeric
)
language sql
security invoker
set search_path = ''
as $function$
  select
    d.produit,
    sum(d.nb_ventes)::numeric as nb_ventes,
    max(d.grammage_unitaire)::numeric as grammage_unitaire,
    sum(d.qte_conso)::numeric as qte_conso
  from public.v_conso_detail d
  where d.date_vente > p_from and d.date_vente <= p_to
    and lower(extensions.unaccent(trim(d.matiere))) = lower(extensions.unaccent(trim(p_matiere)))
  group by d.produit
  order by sum(d.qte_conso) desc;
$function$;

revoke all on function public.get_consumption_variance(date, date) from public, anon;
revoke all on function public.get_consumption_variance_detail(date, date, text) from public, anon;
grant execute on function public.get_consumption_variance(date, date) to authenticated;
grant execute on function public.get_consumption_variance_detail(date, date, text) to authenticated;
