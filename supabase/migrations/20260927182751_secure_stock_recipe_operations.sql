create or replace function public.record_stock_reception(
  p_item_id uuid,
  p_qty numeric,
  p_prix numeric default 0,
  p_fournisseur text default null,
  p_note text default null,
  p_facture_url text default null,
  p_created_at timestamptz default now()
) returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role in ('manager', 'admin') and actif is not false
  ) then raise exception 'Accès manager requis' using errcode = '42501'; end if;
  if p_qty is null or p_qty <= 0 then raise exception 'La quantité doit être positive'; end if;

  insert into public.stock_movements(item_id, qty, type, note, done_by, created_at, facture_url, fournisseur, prix)
  values (p_item_id, p_qty, 'reception', nullif(trim(p_note), ''), (select auth.uid()), p_created_at, p_facture_url, nullif(trim(p_fournisseur), ''), coalesce(p_prix, 0))
  returning id into v_id;

  update public.stock_items
  set current_qty = coalesce(current_qty, 0) + p_qty, updated_at = now()
  where id = p_item_id;
  if not found then raise exception 'Article de stock introuvable'; end if;
  return v_id;
end;
$$;

create or replace function public.record_stock_loss(
  p_item_id uuid,
  p_qty numeric,
  p_motif text,
  p_motif_detail text default null,
  p_date_perte date default current_date
) returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_item public.stock_items%rowtype;
  v_id integer;
begin
  if not exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role in ('manager', 'admin') and actif is not false
  ) then raise exception 'Accès manager requis' using errcode = '42501'; end if;
  if p_qty is null or p_qty <= 0 then raise exception 'La quantité doit être positive'; end if;

  select * into v_item from public.stock_items where id = p_item_id for update;
  if not found then raise exception 'Article de stock introuvable'; end if;
  if coalesce(v_item.current_qty, 0) < p_qty then raise exception 'Stock insuffisant'; end if;

  insert into public.stock_pertes(item_name, matiere_ref, qte, unite, motif, motif_detail, date_perte, created_by)
  values (v_item.name, v_item.matiere_ref, p_qty, v_item.unit, p_motif, nullif(trim(p_motif_detail), ''), p_date_perte, (select auth.uid()))
  returning id into v_id;

  update public.stock_items
  set current_qty = coalesce(current_qty, 0) - p_qty, updated_at = now()
  where id = p_item_id;
  return v_id;
end;
$$;

create or replace function public.replace_product_recipe(
  p_old_name text,
  p_new_name text,
  p_lines jsonb
) returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role in ('manager', 'admin') and actif is not false
  ) then raise exception 'Accès manager requis' using errcode = '42501'; end if;
  if nullif(trim(p_new_name), '') is null then raise exception 'Nom produit requis'; end if;
  if jsonb_typeof(p_lines) <> 'array' then raise exception 'Composition invalide'; end if;

  delete from public.composition_produit
  where lower(unaccent(trim(nom_produit))) = lower(unaccent(trim(coalesce(p_old_name, p_new_name))))
    and type = 'produit fini';

  insert into public.composition_produit(nom_produit, type, matiere, quantite_m, unite, prix_achat, actif)
  select trim(p_new_name), 'produit fini', trim(x.matiere), x.quantite_m,
         coalesce(nullif(trim(x.unite), ''), 'g'), coalesce(x.prix_achat, 0), true
  from jsonb_to_recordset(p_lines) as x(matiere text, quantite_m numeric, unite text, prix_achat numeric)
  where nullif(trim(x.matiere), '') is not null and x.quantite_m > 0;
end;
$$;

revoke all on function public.record_stock_reception(uuid,numeric,numeric,text,text,text,timestamptz) from public, anon;
revoke all on function public.record_stock_loss(uuid,numeric,text,text,date) from public, anon;
revoke all on function public.replace_product_recipe(text,text,jsonb) from public, anon;
grant execute on function public.record_stock_reception(uuid,numeric,numeric,text,text,text,timestamptz) to authenticated;
grant execute on function public.record_stock_loss(uuid,numeric,text,text,date) to authenticated;
grant execute on function public.replace_product_recipe(text,text,jsonb) to authenticated;
