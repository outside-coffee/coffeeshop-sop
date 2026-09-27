-- Ensure reporting views apply the querying user's grants and RLS policies.
-- PostgreSQL 15+ supports security_invoker directly on views.
alter view public.v_ca_journalier set (security_invoker = true);
alter view public.v_top_produits set (security_invoker = true);
alter view public.v_ca_caissier set (security_invoker = true);
alter view public.v_factures set (security_invoker = true);
alter view public.v_conso_theorique set (security_invoker = true);
alter view public.v_evolution_prix set (security_invoker = true);
alter view public.v_conso_detail set (security_invoker = true);

-- Keep extensions outside the exposed public schema.
create schema if not exists extensions;
do $extension_schema$
begin
  if exists (
    select 1
    from pg_extension e
    join pg_namespace n on n.oid = e.extnamespace
    where e.extname = 'unaccent' and n.nspname <> 'extensions'
  ) then
    alter extension unaccent set schema extensions;
  end if;
end
$extension_schema$;

-- Pin trigger function name resolution to trusted schemas.
alter function public.log_prix_change() set search_path = public, extensions, pg_temp;
alter function public.check_matiere_active() set search_path = public, extensions, pg_temp;
alter function public.sync_composition_prix() set search_path = public, extensions, pg_temp;
alter function public.recalc_composition_prix() set search_path = public, extensions, pg_temp;

-- Replace permissive write policies with authenticated reads and manager writes.
do $policy_hardening$
declare
  target record;
  manager_predicate constant text :=
    'exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in (''manager'', ''admin''))';
begin
  for target in
    select * from (values
      ('admin_checks', 'admin_checks_write'),
      ('admin_tasks', 'admin_tasks_write'),
      ('avis_google', 'authenticated access avis_google'),
      ('consommables', 'authenticated access consommables'),
      ('consommables_mouvements', 'authenticated access consommables_mvt'),
      ('controles_fiches', 'authenticated access controles_fiches'),
      ('finance_charges', 'finance_all'),
      ('finance_food_cost', 'finance_all'),
      ('finance_primes', 'finance_all'),
      ('finance_salaires', 'finance_all'),
      ('matiere_formats', 'formats_all'),
      ('matiere_prix_historique', 'prix_historique_all'),
      ('objectifs', 'authenticated access objectifs'),
      ('planning_shifts', 'planning_all'),
      ('produit_aliases', 'aliases_all'),
      ('staff_evaluations', 'eval_all'),
      ('stock_inventaires', 'inv_all'),
      ('stock_pertes', 'pertes_all')
    ) as policies(table_name, old_policy_name)
  loop
    execute format('drop policy if exists %I on public.%I', target.old_policy_name, target.table_name);
    execute format('drop policy if exists %I on public.%I', 'security_audit_authenticated_read', target.table_name);
    execute format('drop policy if exists %I on public.%I', 'security_audit_manager_write', target.table_name);

    execute format(
      'create policy %I on public.%I for select to authenticated using (true)',
      'security_audit_authenticated_read', target.table_name
    );
    execute format(
      'create policy %I on public.%I for all to authenticated using (%s) with check (%s)',
      'security_audit_manager_write', target.table_name, manager_predicate, manager_predicate
    );
  end loop;
end
$policy_hardening$;
