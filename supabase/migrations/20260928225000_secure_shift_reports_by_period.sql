-- Normalize reports to business shifts and protect each employee's writes.

update public.shift_reports
set shift = 'evening'
where shift = 'afternoon';

alter table public.shift_reports
  drop constraint if exists shift_reports_shift_check;

alter table public.shift_reports
  add constraint shift_reports_shift_check
  check (shift in ('morning', 'evening'));

alter table public.shift_reports
  add constraint shift_reports_employee_date_shift_key
  unique (barista_id, date, shift);

drop policy if exists "reports: team access" on public.shift_reports;

create policy "shift reports: authenticated read"
on public.shift_reports for select
to authenticated
using (true);

create policy "shift reports: insert own"
on public.shift_reports for insert
to authenticated
with check (barista_id = (select auth.uid()));

create policy "shift reports: update own"
on public.shift_reports for update
to authenticated
using (barista_id = (select auth.uid()))
with check (barista_id = (select auth.uid()));

create policy "shift reports: delete own"
on public.shift_reports for delete
to authenticated
using (barista_id = (select auth.uid()));
