-- Ajouter contrainte unique sur matiere_premiere
alter table matiere_premiere add constraint matiere_premiere_matiere_unique unique (matiere);

-- Table formats avec poids
create table if not exists matiere_formats (
  id         serial primary key,
  matiere    text not null references matiere_premiere(matiere) on update cascade,
  label      text not null,        -- ex: "Nestle 395g"
  poids      numeric not null,     -- poids net en g ou ml
  prix       numeric not null,     -- prix d'achat DT
  actif      boolean default true,
  created_at timestamptz default now()
);

alter table matiere_formats enable row level security;
create policy "formats_all" on matiere_formats for all using (true);
