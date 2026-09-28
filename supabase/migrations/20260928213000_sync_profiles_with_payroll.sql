-- Keep employee lifecycle changes and payroll identities in sync.

drop index if exists public.finance_salaires_one_active_per_profile_idx;

alter table public.finance_salaires
  drop constraint if exists finance_salaires_profile_id_key;

alter table public.finance_salaires
  add constraint finance_salaires_profile_id_key unique (profile_id);

alter table public.finance_salaires
  drop constraint if exists finance_salaires_profile_id_fkey;

alter table public.finance_salaires
  add constraint finance_salaires_profile_id_fkey
  foreign key (profile_id)
  references public.profiles(id)
  on delete set null;

create or replace function public.sync_profile_payroll()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    update public.finance_salaires
    set actif = false,
        updated_at = now()
    where profile_id = old.id;
    return old;
  end if;

  insert into public.finance_salaires (
    profile_id,
    staff_name,
    staff_role,
    salaire_base,
    actif,
    date_debut
  )
  values (
    new.id,
    new.name,
    coalesce(new.role_operationnel, new.role),
    0,
    coalesce(new.actif, true),
    coalesce(new.date_recrutement, current_date)
  )
  on conflict (profile_id) do update
  set staff_name = excluded.staff_name,
      staff_role = excluded.staff_role,
      actif = excluded.actif,
      date_debut = coalesce(new.date_recrutement, finance_salaires.date_debut),
      updated_at = now();

  return new;
end;
$$;

revoke all on function public.sync_profile_payroll() from public, anon, authenticated;

drop trigger if exists profiles_sync_payroll on public.profiles;
create trigger profiles_sync_payroll
after insert or update of name, role, role_operationnel, actif, date_recrutement
on public.profiles
for each row
execute function public.sync_profile_payroll();

drop trigger if exists profiles_deactivate_payroll_before_delete on public.profiles;
create trigger profiles_deactivate_payroll_before_delete
before delete on public.profiles
for each row
execute function public.sync_profile_payroll();
