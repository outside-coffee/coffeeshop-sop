-- Secure employee identities and confidential HR data.

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.role
  from public.profiles p
  where p.id = (select auth.uid())
$$;

revoke all on function public.current_user_role() from public, anon;
grant execute on function public.current_user_role() to authenticated;

create or replace function public.list_login_profiles()
returns table (
  id uuid,
  name text,
  role text,
  fake_email text,
  avatar_color text
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.name, p.role, p.fake_email, p.avatar_color
  from public.profiles p
  where p.actif is true
  order by p.name
$$;

revoke all on function public.list_login_profiles() from public;
grant execute on function public.list_login_profiles() to anon, authenticated;

create or replace function public.list_staff_profiles()
returns table (
  id uuid,
  name text,
  prenom text,
  nom text,
  role text,
  role_operationnel text,
  planning_color text,
  avatar_color text,
  is_planning_member boolean,
  actif boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if coalesce(public.current_user_role(), '') not in ('manager', 'admin') then
    raise exception 'Accès manager requis' using errcode = '42501';
  end if;

  return query
  select p.id, p.name, p.prenom, p.nom, p.role, p.role_operationnel,
         p.planning_color, p.avatar_color, p.is_planning_member, p.actif
  from public.profiles p
  order by p.role, p.name;
end;
$$;

revoke all on function public.list_staff_profiles() from public, anon;
grant execute on function public.list_staff_profiles() to authenticated;

create or replace function public.set_staff_planning_color(target_profile_id uuid, new_color text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(public.current_user_role(), '') not in ('manager', 'admin') then
    raise exception 'Accès manager requis' using errcode = '42501';
  end if;

  if new_color !~ '^#[0-9A-Fa-f]{6}$' then
    raise exception 'Couleur invalide' using errcode = '22023';
  end if;

  update public.profiles
  set planning_color = new_color
  where id = target_profile_id;
end;
$$;

revoke all on function public.set_staff_planning_color(uuid, text) from public, anon;
grant execute on function public.set_staff_planning_color(uuid, text) to authenticated;

drop policy if exists "profiles: anyone can read" on public.profiles;
drop policy if exists "profiles: own update" on public.profiles;
drop policy if exists "profiles: admin can update all" on public.profiles;
drop policy if exists "profiles: insert own" on public.profiles;

create policy "profiles: read own"
on public.profiles for select
to authenticated
using (id = (select auth.uid()));

create policy "profiles: admin read all"
on public.profiles for select
to authenticated
using ((select public.current_user_role()) = 'admin');

create policy "profiles: admin update all"
on public.profiles for update
to authenticated
using ((select public.current_user_role()) = 'admin')
with check ((select public.current_user_role()) = 'admin');

do $$
declare
  table_name text;
begin
  foreach table_name in array array['finance_salaires', 'finance_primes', 'staff_evaluations']
  loop
    execute format('drop policy if exists %I on public.%I', 'security_audit_authenticated_read', table_name);
    execute format(
      'create policy %I on public.%I for select to authenticated using ((select public.current_user_role()) in (''manager'', ''admin''))',
      'hr_manager_read', table_name
    );
  end loop;
end $$;

-- Link the legacy payroll rows to their employee profiles and align identity data.
update public.finance_salaires s
set profile_id = p.id,
    staff_name = p.name,
    staff_role = coalesce(p.role_operationnel, p.role),
    actif = p.actif,
    updated_at = now()
from public.profiles p
where (lower(trim(s.staff_name)) = lower(trim(p.name))
       or (s.staff_name = 'Youssef F' and p.name = 'Youssef FEIYDI')
       or (s.staff_name = 'Chahad' and p.name = 'Chahd'));

create unique index if not exists finance_salaires_one_active_per_profile_idx
on public.finance_salaires (profile_id)
where actif is true and profile_id is not null;
