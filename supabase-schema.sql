-- =============================================
-- COFFEESHOP SOP — Supabase Schema
-- Run this in your Supabase SQL Editor
-- =============================================

-- Enable Row Level Security
create extension if not exists "uuid-ossp";

-- PROFILES (linked to Supabase Auth)
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  name text not null,
  role text not null default 'barista', -- 'manager' | 'barista'
  avatar_color text not null default '#C8956C',
  created_at timestamptz default now()
);
alter table profiles enable row level security;
create policy "profiles: anyone can read" on profiles for select using (true);
create policy "profiles: own update" on profiles for update using (auth.uid() = id);
create policy "profiles: insert own" on profiles for insert with check (auth.uid() = id);

-- CHECKLIST TEMPLATES
create table checklist_templates (
  id uuid primary key default uuid_generate_v4(),
  type text not null, -- 'opening' | 'closing'
  category text not null,
  label text not null,
  sublabel text,
  sort_order int not null default 0,
  active boolean default true
);
alter table checklist_templates enable row level security;
create policy "templates: anyone can read" on checklist_templates for select using (true);
create policy "templates: manager only write" on checklist_templates for all using (
  exists (select 1 from profiles where id = auth.uid() and role = 'manager')
);

-- CHECKLIST SESSIONS (one per shift per type)
create table checklist_sessions (
  id uuid primary key default uuid_generate_v4(),
  type text not null,
  date date not null default current_date,
  completed_by uuid references profiles(id),
  validated_at timestamptz,
  created_at timestamptz default now()
);
alter table checklist_sessions enable row level security;
create policy "sessions: team read" on checklist_sessions for select using (true);
create policy "sessions: team write" on checklist_sessions for all using (auth.uid() is not null);

-- CHECKLIST ITEMS (checked items per session)
create table checklist_items (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid references checklist_sessions(id) on delete cascade,
  template_id uuid references checklist_templates(id),
  checked_by uuid references profiles(id),
  checked_at timestamptz default now()
);
alter table checklist_items enable row level security;
create policy "items: team access" on checklist_items for all using (auth.uid() is not null);

-- SHIFT REPORTS
create table shift_reports (
  id uuid primary key default uuid_generate_v4(),
  date date not null default current_date,
  shift text not null, -- 'morning' | 'afternoon' | 'full'
  barista_id uuid references profiles(id),
  ca numeric(10,2),
  covers int,
  cash_status text default 'ok', -- 'ok' | 'surplus' | 'missing'
  cash_diff numeric(10,2) default 0,
  stock_issues text,
  equipment_issues text,
  customer_incidents text,
  handover_notes text,
  created_at timestamptz default now()
);
alter table shift_reports enable row level security;
create policy "reports: team access" on shift_reports for all using (auth.uid() is not null);

-- STOCK ITEMS
create table stock_items (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  category text not null, -- 'coffee' | 'milk' | 'consumables' | 'cleaning' | 'other'
  unit text not null default 'kg',
  current_qty numeric(10,2) default 0,
  min_qty numeric(10,2) default 0,
  ideal_qty numeric(10,2) default 0,
  supplier text,
  active boolean default true,
  updated_at timestamptz default now()
);
alter table stock_items enable row level security;
create policy "stock: team access" on stock_items for all using (auth.uid() is not null);

-- STOCK MOVEMENTS
create table stock_movements (
  id uuid primary key default uuid_generate_v4(),
  item_id uuid references stock_items(id) on delete cascade,
  type text not null, -- 'reception' | 'adjustment' | 'usage'
  qty numeric(10,2) not null,
  note text,
  done_by uuid references profiles(id),
  created_at timestamptz default now()
);
alter table stock_movements enable row level security;
create policy "movements: team access" on stock_movements for all using (auth.uid() is not null);

-- RECIPES
create table recipes (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  category text not null, -- 'espresso' | 'milk' | 'cold' | 'food'
  description text,
  cup_size text,
  active boolean default true,
  created_at timestamptz default now()
);
alter table recipes enable row level security;
create policy "recipes: team access" on recipes for all using (auth.uid() is not null);

create table recipe_steps (
  id uuid primary key default uuid_generate_v4(),
  recipe_id uuid references recipes(id) on delete cascade,
  sort_order int not null,
  label text not null,
  detail text,
  value text -- e.g. "18g", "93°C"
);
alter table recipe_steps enable row level security;
create policy "recipe_steps: team access" on recipe_steps for all using (auth.uid() is not null);

-- =============================================
-- SEED — OUTSIDE SOP v1 2025
-- Contenu extrait du document SOP Outside
-- =============================================

insert into checklist_templates (type, category, label, sublabel, sort_order) values

-- ── OUVERTURE (60 min avant le premier client) ──────────────────────────
('opening', 'Arrivée & sécurité', 'Arriver en uniforme complet avec le badge visible', null, 1),
('opening', 'Arrivée & sécurité', 'Ouvrir et couper l''alarme', null, 2),
('opening', 'Ambiance', 'Allumer les lumières (1 à 8)', null, 3),
('opening', 'Ambiance', 'Ouvrir les fenêtres et lancer la musique / Coran', 'Sourate Yassine + Al-Waqi''a jusqu''au premier client — volume 30%', 4),
('opening', 'Températures', 'Vérifier la température du frigo', '< 2°C obligatoire', 5),
('opening', 'Machine expresso', 'Allumer la machine expresso', 'Attendre 30 minutes avant utilisation', 6),
('opening', 'Machine expresso', 'Faire 1 shot d''espresso par groupe pour nettoyer', 'Jeter les shots — ne pas servir', 7),
('opening', 'Machine expresso', 'Goûter un shot d''espresso', 'Valider extraction, goût, crema dorée', 8),
('opening', 'Machine expresso', 'Remplir les grains dans le moulin', null, 9),
('opening', 'Machine expresso', 'Vérifier les niveaux : sirop, chocolat, caramel…', null, 10),
('opening', 'Lait & boissons', 'Sortir le lait et vérifier la date de péremption', null, 11),
('opening', 'Lait & boissons', 'Préparer la base chocolat chaud Nutella', null, 12),
('opening', 'Mise en place salle', 'Remplir l''eau et les cookies — approvisionner le comptoir', 'Sucre, cuillères, serviettes', 13),
('opening', 'Mise en place salle', 'Essuyer et nettoyer toutes les tables', null, 14),
('opening', 'Caisse & opérations', 'Vérifier la caisse et compter le fonds de caisse', null, 15),
('opening', 'Caisse & opérations', 'Vérifier que le Wi-Fi fonctionne', null, 16),
('opening', 'Caisse & opérations', 'Briefing rapide avec l''équipe (5 min)', 'Spécificités du jour, promotions, absences', 17),

-- ── FERMETURE (commencer 45 min avant la fermeture) ─────────────────────
('closing', 'Clients & salle', 'Informer les clients restants de l''heure de fermeture', 'Avec courtoisie — 30 min avant', 1),
('closing', 'Machine expresso', 'Lancer le backflush (rétro-lavage) de la machine', '30 min avant — avec produit détergent', 2),
('closing', 'Machine expresso', 'Vider et rincer les carafes', null, 3),
('closing', 'Machine expresso', 'Nettoyer la tête de groupe et les filtres', null, 4),
('closing', 'Machine expresso', 'Arrêter d''accepter de nouvelles commandes', '15 min avant la fermeture', 5),
('closing', 'Machine expresso', 'Éteindre la machine expresso', '15 min avant la fermeture', 6),
('closing', 'Alimentation', 'Filmer et ranger tous les produits alimentaires', 'Étiqueter avec la date', 7),
('closing', 'Nettoyage', 'Vider les sacs poubelles et les sortir', null, 8),
('closing', 'Nettoyage', 'Nettoyer le sol en entier', null, 9),
('closing', 'Nettoyage', 'Nettoyer les toilettes', null, 10),
('closing', 'Caisse & rapport', 'Compter la caisse avec le responsable', '15 min avant', 11),
('closing', 'Caisse & rapport', 'Remplir le rapport journalier', '10 min avant', 12),
('closing', 'Sécurité', 'Vérifier toutes les lumières et éteindre la musique', '5 min avant', 13),
('closing', 'Sécurité', 'Vérifier que toutes les fenêtres et portes sont fermées', null, 14),
('closing', 'Sécurité', 'Activer l''alarme et verrouiller la porte principale', null, 15);

-- ── STOCK Outside ────────────────────────────────────────────────────────
insert into stock_items (name, category, unit, current_qty, min_qty, ideal_qty) values
('Café (grains)', 'coffee', 'kg', 4.5, 2, 8),
('Lait entier', 'milk', 'L', 20, 10, 35),
('Lait d''avoine', 'milk', 'L', 6, 4, 15),
('Lait d''amande', 'milk', 'L', 3, 2, 8),
('Matcha', 'coffee', 'g', 150, 80, 300),
('Sirop vanille', 'consumables', 'bouteille', 2, 1, 4),
('Sirop caramel', 'consumables', 'bouteille', 2, 1, 4),
('Chocolat en poudre', 'consumables', 'kg', 1, 0.5, 2),
('Nutella (base chocolat chaud)', 'consumables', 'kg', 1, 0.5, 2),
('Eau plate (bouteille)', 'consumables', 'unité', 48, 24, 96),
('Eau pétillante (bouteille)', 'consumables', 'unité', 24, 12, 48),
('Cookies', 'consumables', 'unité', 30, 15, 60),
('Gobelets 8oz', 'consumables', 'unité', 150, 60, 300),
('Gobelets 12oz', 'consumables', 'unité', 100, 60, 300),
('Couvercles', 'consumables', 'unité', 120, 60, 300),
('Sucre blanc', 'consumables', 'kg', 3, 1, 5),
('Sucre roux', 'consumables', 'kg', 2, 1, 4),
('Produit rétro-lavage', 'cleaning', 'kg', 0.8, 0.4, 2),
('Produit désinfectant bar', 'cleaning', 'L', 1, 0.5, 3),
('Sacs poubelles', 'cleaning', 'rouleau', 3, 1, 6),
('Serviettes', 'consumables', 'paquet', 5, 2, 10);

-- ── RECETTES Outside ─────────────────────────────────────────────────────
insert into recipes (id, name, category, description, cup_size) values
('aaaa0001-0000-0000-0000-000000000001', 'Espresso double', 'espresso', 'La base de tout — crema dorée, 25-30 sec', '40ml'),
('aaaa0001-0000-0000-0000-000000000002', 'Americano', 'espresso', 'Espresso double allongé à l''eau chaude', '240ml'),
('aaaa0001-0000-0000-0000-000000000003', 'Cappuccino', 'milk', '1/3 espresso, 1/3 lait, 1/3 mousse épaisse', '180ml'),
('aaaa0001-0000-0000-0000-000000000004', 'Flat White', 'milk', 'Plus concentré que le latte, micro-mousse veloutée', '160ml'),
('aaaa0001-0000-0000-0000-000000000005', 'Latte', 'milk', 'Espresso + grande quantité de lait vapeur soyeux', '300ml'),
('aaaa0001-0000-0000-0000-000000000006', 'Iced Latte', 'cold', 'Espresso double + glaçons + lait froid', '350ml'),
('aaaa0001-0000-0000-0000-000000000007', 'Cold Brew', 'cold', 'Infusion froide 12h minimum — servir sur glace', '300ml'),
('aaaa0001-0000-0000-0000-000000000008', 'Iced Matcha Latte', 'cold', '2g matcha + eau chaude + glaçons + lait froid', '350ml'),
('aaaa0001-0000-0000-0000-000000000009', 'Chocolat chaud Outside', 'milk', 'Base Nutella maison — spécialité Outside', '250ml'),
('aaaa0001-0000-0000-0000-000000000010', 'Smoothie', 'cold', 'Fruits + base + glace — blender 45 sec', '350ml');

insert into recipe_steps (recipe_id, sort_order, label, detail, value) values

-- Espresso double
('aaaa0001-0000-0000-0000-000000000001', 1, 'Doser le café', 'Mouture fine — remplir le porte-filtre uniformément', '18-20g'),
('aaaa0001-0000-0000-0000-000000000001', 2, 'Tasser', 'Pression uniforme et horizontale', '15-20 kg'),
('aaaa0001-0000-0000-0000-000000000001', 3, 'Extraction', 'Lancer et surveiller — la crema doit être dorée', '25-30 sec'),
('aaaa0001-0000-0000-0000-000000000001', 4, 'Volume final', 'Stopper si la crema devient blanche ou trop claire', '30-40ml'),
('aaaa0001-0000-0000-0000-000000000001', 5, 'Contrôle qualité', 'Goûter — si extraction < 25s ou > 30s, recalibrer la mouture', null),

-- Cappuccino
('aaaa0001-0000-0000-0000-000000000003', 1, 'Extraire le double espresso', 'Dans une tasse 180ml préchauffée', '35ml'),
('aaaa0001-0000-0000-0000-000000000003', 2, 'Texturer le lait', 'Remplir la carafe au 1/3 — lait froid obligatoire', '120ml lait entier'),
('aaaa0001-0000-0000-0000-000000000003', 3, 'Phase 1 — texture', 'Lance vapeur près de la surface, angle 45° — créer un tourbillon', '5-7 sec'),
('aaaa0001-0000-0000-0000-000000000003', 4, 'Phase 2 — chauffe', 'Plonger la lance plus profond pour monter en température', '60-65°C'),
('aaaa0001-0000-0000-0000-000000000003', 5, 'Finition', 'Taper la carafe, faire des cercles pour lisser la mousse', null),
('aaaa0001-0000-0000-0000-000000000003', 6, 'Assemblage', '1/3 espresso, 1/3 lait vapeur, 1/3 mousse épaisse — verser aussitôt', null),
('aaaa0001-0000-0000-0000-000000000003', 7, 'Option', 'Saupoudrer cacao en poudre sur la mousse', null),

-- Flat White
('aaaa0001-0000-0000-0000-000000000004', 1, 'Extraire le double espresso', 'Dans une tasse 160ml préchauffée', '35ml'),
('aaaa0001-0000-0000-0000-000000000004', 2, 'Texturer le lait', 'Micro-mousse — remplir carafe au 1/3', '150ml lait entier'),
('aaaa0001-0000-0000-0000-000000000004', 3, 'Texture', 'Peu de mousse — résultat crémeux et velouté uniquement', '60-65°C'),
('aaaa0001-0000-0000-0000-000000000004', 4, 'Verser', 'Verser en cercle serré pour créer le latte art', null),
('aaaa0001-0000-0000-0000-000000000004', 5, 'Rappel', 'Plus concentré que le latte — moins de lait, même espresso', null),

-- Latte
('aaaa0001-0000-0000-0000-000000000005', 1, 'Extraire le double espresso', null, '35ml'),
('aaaa0001-0000-0000-0000-000000000005', 2, 'Texturer le lait', 'Mousse légère et soyeuse', '250ml lait entier'),
('aaaa0001-0000-0000-0000-000000000005', 3, 'Chauffe', null, '60-65°C'),
('aaaa0001-0000-0000-0000-000000000005', 4, 'Verser', 'Lait en premier, maintenir la mousse avec la cuillère', null),

-- Iced Latte
('aaaa0001-0000-0000-0000-000000000006', 1, 'Extraire le double espresso', 'Laisser refroidir 1 minute', '35ml'),
('aaaa0001-0000-0000-0000-000000000006', 2, 'Remplir de glaçons', 'Verre 350ml rempli aux 3/4', null),
('aaaa0001-0000-0000-0000-000000000006', 3, 'Verser l''espresso sur les glaçons', null, null),
('aaaa0001-0000-0000-0000-000000000006', 4, 'Ajouter le lait froid', 'Mélanger délicatement', '200ml'),
('aaaa0001-0000-0000-0000-000000000006', 5, 'Option sirop', 'Vanille ou caramel si le client le demande', null),

-- Cold Brew
('aaaa0001-0000-0000-0000-000000000007', 1, 'Préparer la veille', 'Café grossièrement moulu + eau froide', '80g café / 1L eau'),
('aaaa0001-0000-0000-0000-000000000007', 2, 'Infusion', 'Réfrigérateur — ne pas infuser à température ambiante', '12h minimum'),
('aaaa0001-0000-0000-0000-000000000007', 3, 'Filtrer', 'Filtre fin — le liquide doit être clair', null),
('aaaa0001-0000-0000-0000-000000000007', 4, 'Service', 'Servir sur glaçons — optionnel : splash lait ou lait végétal', null),

-- Iced Matcha Latte
('aaaa0001-0000-0000-0000-000000000008', 1, 'Préparer le matcha', 'Mélanger matcha + eau chaude (pas bouillante)', '2g matcha + 50ml eau 80°C'),
('aaaa0001-0000-0000-0000-000000000008', 2, 'Fouetter', 'Mélanger vigoureusement — aucun grumeau', null),
('aaaa0001-0000-0000-0000-000000000008', 3, 'Remplir de glaçons', null, null),
('aaaa0001-0000-0000-0000-000000000008', 4, 'Ajouter le lait froid', 'Lait d''avoine recommandé avec le matcha', '200ml'),

-- Chocolat chaud Outside
('aaaa0001-0000-0000-0000-000000000009', 1, 'Préparer la base Nutella', 'Préparer en début de journée — batch quotidien', null),
('aaaa0001-0000-0000-0000-000000000009', 2, 'Chauffer le lait', null, '200ml lait entier'),
('aaaa0001-0000-0000-0000-000000000009', 3, 'Incorporer la base', 'Mélanger hors feu pour éviter les grumeaux', null),
('aaaa0001-0000-0000-0000-000000000009', 4, 'Finition', 'Servir dans une tasse chaude — chantilly optionnelle', '60-65°C'),

-- Smoothie
('aaaa0001-0000-0000-0000-000000000010', 1, 'Préparer les fruits', 'Fruits frais ou congelés selon la recette du jour', null),
('aaaa0001-0000-0000-0000-000000000010', 2, 'Ajouter la base', 'Jus, lait végétal ou yaourt selon la recette', null),
('aaaa0001-0000-0000-0000-000000000010', 3, 'Glaçons', 'Pour la texture froide et onctueuse', null),
('aaaa0001-0000-0000-0000-000000000010', 4, 'Blender', 'Mixer en continu — texture homogène', '45 secondes'),
('aaaa0001-0000-0000-0000-000000000010', 5, 'Service immédiat', 'Ne pas laisser reposer — servir aussitôt', null);
