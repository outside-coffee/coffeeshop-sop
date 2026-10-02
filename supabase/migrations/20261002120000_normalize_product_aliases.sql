-- Preserve raw POS history and resolve active aliases at read time.

create or replace view public.v_conso_theorique
with (security_invoker = true)
as
with ventes as (
  select
    coalesce(pa.nom_produit, tl.produit) as produit,
    tl.qte,
    tl.date_vente,
    tl.numtable
  from public.transaction_line tl
  left join public.produit_aliases pa
    on lower(extensions.unaccent(trim(pa.alias))) = lower(extensions.unaccent(trim(tl.produit)))
   and pa.actif is true
),
conso_directe as (
  select v.date_vente, cp.matiere,
         sum(v.qte::numeric * cp.quantite_m) as qte_theo,
         sum(v.qte::numeric * cp.prix_achat) as cout_theo
  from ventes v
  join public.composition_produit cp
    on lower(extensions.unaccent(trim(cp.nom_produit))) = lower(extensions.unaccent(trim(v.produit)))
  where cp.type = 'produit fini'
  group by v.date_vente, cp.matiere
),
conso_bases as (
  select v.date_vente, bi.matiere,
         sum(v.qte::numeric * (cp.quantite_m / base_totaux.total) * bi.quantite_m) as qte_theo,
         sum(v.qte::numeric * (cp.quantite_m / base_totaux.total) * bi.prix_achat) as cout_theo
  from ventes v
  join public.composition_produit cp
    on lower(extensions.unaccent(trim(cp.nom_produit))) = lower(extensions.unaccent(trim(v.produit)))
  join public.composition_produit bi
    on lower(extensions.unaccent(trim(bi.nom_produit))) = lower(extensions.unaccent(trim(cp.matiere)))
   and bi.type = 'base'
  join (
    select nom_produit, sum(quantite_m) as total
    from public.composition_produit
    where type = 'base'
    group by nom_produit
  ) base_totaux on base_totaux.nom_produit = bi.nom_produit
  where cp.type = 'produit fini'
  group by v.date_vente, bi.matiere
)
select date_vente, matiere, sum(qte_theo) as qte_theo, sum(cout_theo) as cout_theo
from (
  select * from conso_directe
  union all
  select * from conso_bases
) all_conso
group by date_vente, matiere;

create or replace view public.v_conso_detail
with (security_invoker = true)
as
with ventes as (
  select
    lower(extensions.unaccent(trim(coalesce(pa.nom_produit, tl.produit)))) as produit_norm,
    coalesce(pa.nom_produit, tl.produit) as produit_original,
    tl.date_vente,
    sum(tl.qte) as qte_vendue
  from public.transaction_line tl
  left join public.produit_aliases pa
    on lower(extensions.unaccent(trim(pa.alias))) = lower(extensions.unaccent(trim(tl.produit)))
   and pa.actif is true
  group by 1, 2, tl.date_vente
),
conso_directe as (
  select v.date_vente, v.produit_original, v.qte_vendue, cp.matiere,
         cp.quantite_m as grammage,
         v.qte_vendue::numeric * cp.quantite_m as qte_conso
  from ventes v
  join public.composition_produit cp
    on lower(extensions.unaccent(trim(cp.nom_produit))) = v.produit_norm
   and cp.type = 'produit fini'
  where lower(extensions.unaccent(trim(cp.matiere))) not in (
    select distinct lower(extensions.unaccent(trim(nom_produit)))
    from public.composition_produit where type = 'base'
  )
),
conso_bases as (
  select v.date_vente, v.produit_original, v.qte_vendue, bi.matiere,
         bi.quantite_m as grammage,
         v.qte_vendue::numeric * bi.quantite_m * (cp.quantite_m / nullif(base_totaux.total, 0)) as qte_conso
  from ventes v
  join public.composition_produit cp
    on lower(extensions.unaccent(trim(cp.nom_produit))) = v.produit_norm
   and cp.type = 'produit fini'
  join public.composition_produit bi
    on lower(extensions.unaccent(trim(bi.nom_produit))) = lower(extensions.unaccent(trim(cp.matiere)))
   and bi.type = 'base'
  join (
    select nom_produit, sum(quantite_m) as total
    from public.composition_produit where type = 'base'
    group by nom_produit
  ) base_totaux on base_totaux.nom_produit = bi.nom_produit
)
select date_vente, produit_original as produit, matiere,
       max(grammage) as grammage_unitaire,
       sum(qte_vendue) as nb_ventes,
       sum(qte_conso) as qte_conso
from (
  select * from conso_directe
  union all
  select * from conso_bases
) all_conso
group by date_vente, produit_original, matiere
order by date_vente, matiere, sum(qte_conso) desc;
