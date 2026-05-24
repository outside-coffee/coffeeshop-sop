-- ═══════════════════════════════════════════════════════════════
-- TABLES FINANCE
-- ═══════════════════════════════════════════════════════════════

-- Charges mensuelles
CREATE TABLE IF NOT EXISTS finance_charges (
  id          serial PRIMARY KEY,
  periode     text NOT NULL,  -- YYYY-MM
  categorie   text NOT NULL,  -- Loyer, Electricite, Eau, Fournisseur, Autre...
  label       text NOT NULL,
  montant     numeric NOT NULL DEFAULT 0,
  note        text,
  created_by  uuid REFERENCES profiles(id),
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- Salaires
CREATE TABLE IF NOT EXISTS finance_salaires (
  id          serial PRIMARY KEY,
  staff_name  text NOT NULL,
  staff_role  text NOT NULL,
  salaire_base numeric NOT NULL DEFAULT 0,
  actif       boolean DEFAULT true,
  date_debut  date DEFAULT CURRENT_DATE,
  note        text,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- Primes mensuelles
CREATE TABLE IF NOT EXISTS finance_primes (
  id          serial PRIMARY KEY,
  staff_name  text NOT NULL,
  periode     text NOT NULL,  -- YYYY-MM
  montant     numeric NOT NULL DEFAULT 0,
  motif       text,
  created_by  uuid REFERENCES profiles(id),
  created_at  timestamptz DEFAULT now()
);

-- Food cost saisi (override du théorique)
CREATE TABLE IF NOT EXISTS finance_food_cost (
  id          serial PRIMARY KEY,
  periode     text NOT NULL UNIQUE,  -- YYYY-MM
  cout_reel   numeric,   -- saisi manuellement si override
  cout_theo   numeric,   -- calculé depuis écarts (mis à jour auto)
  note        text,
  updated_at  timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE finance_charges  ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_salaires ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_primes   ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_food_cost ENABLE ROW LEVEL SECURITY;

CREATE POLICY "finance_all" ON finance_charges   FOR ALL USING (true);
CREATE POLICY "finance_all" ON finance_salaires  FOR ALL USING (true);
CREATE POLICY "finance_all" ON finance_primes    FOR ALL USING (true);
CREATE POLICY "finance_all" ON finance_food_cost FOR ALL USING (true);

-- Données initiales salaires
INSERT INTO finance_salaires (staff_name, staff_role, salaire_base) VALUES
  ('Youssef F', 'manager',      0),
  ('Wassim',    'barista',      0),
  ('Hamza',     'barista',      0),
  ('Chahad',    'service_crew', 0),
  ('Hachem',    'support_crew', 0),
  ('Youssef',   'support_crew', 0)
ON CONFLICT DO NOTHING;

-- Charges fixes récurrentes initiales
INSERT INTO finance_charges (periode, categorie, label, montant) VALUES
  (to_char(CURRENT_DATE, 'YYYY-MM'), 'Loyer',       'Loyer mensuel',     0),
  (to_char(CURRENT_DATE, 'YYYY-MM'), 'Electricite', 'Facture électricité',0),
  (to_char(CURRENT_DATE, 'YYYY-MM'), 'Eau',         'Facture eau/gaz',    0),
  (to_char(CURRENT_DATE, 'YYYY-MM'), 'Autre',       'Divers',             0)
ON CONFLICT DO NOTHING;
