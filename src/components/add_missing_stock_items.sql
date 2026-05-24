-- ═══════════════════════════════════════════════════════════════
-- AJOUT ARTICLES MANQUANTS — Emballages & Nettoyage
-- ═══════════════════════════════════════════════════════════════

INSERT INTO stock_items (name, category, unit, current_qty, min_qty, ideal_qty, active) VALUES
  -- F. EMBALLAGES
  ('Agitateurs',              'Emballage',  'paquet',  0, 1, 3,  true),
  ('Pailles',                 'Emballage',  'paquet',  0, 1, 3,  true),
  ('Sacs poubelle',           'Emballage',  'paquet',  0, 1, 3,  true),
  ('Rouleaux de caisse',      'Emballage',  'rouleau', 0, 2, 5,  true),
  -- G. NETTOYAGE
  ('Produit nettoyant sol',   'Nettoyage',  'unite',   0, 1, 2,  true),
  ('Eau de Javel',            'Nettoyage',  'unite',   0, 1, 2,  true),
  ('Air Fraiche',             'Nettoyage',  'unite',   0, 1, 2,  true),
  ('CHCC Combat Vert',        'Nettoyage',  'unite',   0, 1, 2,  true),
  ('Ajax',                    'Nettoyage',  'unite',   0, 1, 2,  true),
  ('Pril',                    'Nettoyage',  'unite',   0, 1, 2,  true),
  ('Savon liquide',           'Nettoyage',  'unite',   0, 1, 2,  true),
  ('Nettoyant WC',            'Nettoyage',  'unite',   0, 1, 2,  true),
  ('Serviettes en papier',    'Nettoyage',  'paquet',  0, 2, 5,  true),
  ('Rouleaux toilette lotus', 'Nettoyage',  'rouleau', 0, 4, 8,  true)
ON CONFLICT DO NOTHING;

-- Mise à jour depuis PDF 17/05
UPDATE stock_items SET current_qty = 9,  updated_at = now() WHERE name = 'Agitateurs';
UPDATE stock_items SET current_qty = 17, updated_at = now() WHERE name = 'Pailles';
UPDATE stock_items SET current_qty = 7,  updated_at = now() WHERE name = 'Sacs poubelle';
UPDATE stock_items SET current_qty = 11, updated_at = now() WHERE name = 'Rouleaux de caisse';
UPDATE stock_items SET current_qty = 0,  updated_at = now() WHERE name = 'Produit nettoyant sol';
UPDATE stock_items SET current_qty = 0,  updated_at = now() WHERE name = 'Eau de Javel';
UPDATE stock_items SET current_qty = 0,  updated_at = now() WHERE name = 'Air Fraiche';
UPDATE stock_items SET current_qty = 0,  updated_at = now() WHERE name = 'CHCC Combat Vert';
UPDATE stock_items SET current_qty = 1,  updated_at = now() WHERE name = 'Ajax';
UPDATE stock_items SET current_qty = 1,  updated_at = now() WHERE name = 'Pril';
UPDATE stock_items SET current_qty = 2,  updated_at = now() WHERE name = 'Savon liquide';
UPDATE stock_items SET current_qty = 1,  updated_at = now() WHERE name = 'Nettoyant WC';
UPDATE stock_items SET current_qty = 4,  updated_at = now() WHERE name = 'Serviettes en papier';
UPDATE stock_items SET current_qty = 4,  updated_at = now() WHERE name = 'Rouleaux toilette lotus';

-- Colonne actif dans matiere_premiere (si pas déjà présente)
ALTER TABLE matiere_premiere ADD COLUMN IF NOT EXISTS actif boolean default true;

-- ═══════════════════════════════════════════════════════════════
-- CHECKLIST FIN DE SHIFT MATIN (16h — passation)
-- ═══════════════════════════════════════════════════════════════
INSERT INTO checklist_templates (type, category, label, sort_order, active) VALUES
  -- Bar & Matériel
  ('shift_end_morning', 'Bar',       'Nettoyage et rangement du bar',             1,  true),
  ('shift_end_morning', 'Bar',       'Machine espresso purgée et nettoyée',        2,  true),
  ('shift_end_morning', 'Bar',       'Lait et crèmes remis au frigo',              3,  true),
  ('shift_end_morning', 'Bar',       'Sirop et toppings bouchés et rangés',        4,  true),
  ('shift_end_morning', 'Bar',       'Verres et tasses propres et rangés',         5,  true),
  -- Stock
  ('shift_end_morning', 'Stock',     'Stock café vérifié et signalé si bas',       6,  true),
  ('shift_end_morning', 'Stock',     'Lait commandé si besoin',                    7,  true),
  ('shift_end_morning', 'Stock',     'Frigos vérifiés (dates, ordre)',             8,  true),
  -- Caisse
  ('shift_end_morning', 'Caisse',    'Caisse comptée et déclarée',                 9,  true),
  ('shift_end_morning', 'Caisse',    'CA matin saisi dans rapport shift',          10, true),
  -- Passation
  ('shift_end_morning', 'Passation', 'Équipe du soir briefée (commandes spéciales, incidents)', 11, true),
  ('shift_end_morning', 'Passation', 'Points de stock bas communiqués',           12, true),
  ('shift_end_morning', 'Passation', 'Salle propre et tables dressées',           13, true),
  -- Hygiène
  ('shift_end_morning', 'Hygiène',   'Plans de travail désinfectés',              14, true),
  ('shift_end_morning', 'Hygiène',   'Sol passé',                                 15, true),
  ('shift_end_morning', 'Hygiène',   'Poubelles vidées si pleine',                16, true)
ON CONFLICT DO NOTHING;
