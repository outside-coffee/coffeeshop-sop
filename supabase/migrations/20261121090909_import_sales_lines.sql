create or replace function public.import_sales_lines(p_lines jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_rows jsonb;
  v_new jsonb;
  v_ids text[];
  v_inserted integer;
  v_total integer;
  v_summary jsonb;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role in ('manager','admin') and actif is not false) then
    raise exception 'Accès manager requis' using errcode = '42501';
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' then raise exception 'Liste de ventes invalide'; end if;
  if jsonb_array_length(p_lines) = 0 or jsonb_array_length(p_lines) > 20000 then raise exception 'Entre 1 et 20 000 lignes requises'; end if;
  -- Serialize imports so two concurrent uploads cannot import the same ticket.
  perform pg_advisory_xact_lock(20261121, 1);
  select jsonb_agg(to_jsonb(x) - 'line_id') into v_rows
  from jsonb_populate_recordset(null::public.transaction_line, p_lines) x;
  if exists (
    select 1 from jsonb_populate_recordset(null::public.transaction_line, v_rows) x
    where x.numero_ticket is null or x.date_vente is null or x.heure is null
      or nullif(trim(x.produit),'') is null or x.qte is null or x.prix_unitaire is null
      or x.total_ttc is null or x.prix_unitaire::text in ('NaN','Infinity','-Infinity')
      or x.total_ttc::text in ('NaN','Infinity','-Infinity')
      or x.id_ticket_compact is distinct from (x.numero_ticket::text || to_char(x.date_vente,'YYYYMMDD') || to_char(x.heure,'HH24MISS'))
  ) then raise exception 'Ligne de vente invalide'; end if;
  select count(distinct x.id_ticket_compact) into v_total
  from jsonb_populate_recordset(null::public.transaction_line,v_rows) x where x.prix_unitaire > 0;
  select jsonb_agg(to_jsonb(x) - 'line_id') into v_new
  from jsonb_populate_recordset(null::public.transaction_line,v_rows) x
  where x.prix_unitaire > 0 and not exists (
    select 1 from public.transaction_line l where l.id_ticket_compact = x.id_ticket_compact
  ) and not exists (select 1 from public.transaction t where t.id_ticket_compact = x.id_ticket_compact);
  if v_new is null then return jsonb_build_object('inserted_lines',0,'inserted_tickets',0,'skipped_tickets',v_total,'summary','[]'::jsonb); end if;
  select array_agg(distinct x.id_ticket_compact) into v_ids from jsonb_populate_recordset(null::public.transaction_line,v_new) x;
  insert into public.transaction_line(id_ticket_compact,numero_ticket,date_vente,heure,produit,qte,prix_unitaire,total_ttc,caissier,caisse,numtable)
  select id_ticket_compact,numero_ticket,date_vente,heure,produit,qte,prix_unitaire,total_ttc,caissier,caisse,numtable
  from jsonb_populate_recordset(null::public.transaction_line,v_new);
  get diagnostics v_inserted = row_count;
  insert into public.transaction(id_ticket_compact,numero_ticket,date_vente,heure,caissier,caisse,nb_lignes,qte_totale,total_ticket,numtable)
  select id_ticket_compact,numero_ticket,date_vente,heure,min(caissier),min(caisse),count(*),sum(qte),round(sum(total_ttc),2),max(numtable)
  from public.transaction_line where id_ticket_compact = any(v_ids)
  group by id_ticket_compact,numero_ticket,date_vente,heure;
  select jsonb_agg(to_jsonb(s) order by s.date_vente) into v_summary from (
    select date_vente,count(distinct id_ticket_compact) as tickets,count(*) as lignes,sum(qte) as articles,round(sum(total_ttc),2) as ca
    from public.transaction_line where id_ticket_compact = any(v_ids) group by date_vente
  ) s;
  return jsonb_build_object('inserted_lines',v_inserted,'inserted_tickets',cardinality(v_ids),'skipped_tickets',v_total-cardinality(v_ids),'summary',v_summary);
end;
$$;
revoke all on function public.import_sales_lines(jsonb) from public,anon;
grant execute on function public.import_sales_lines(jsonb) to authenticated;
