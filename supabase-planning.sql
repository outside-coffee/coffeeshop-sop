-- Recréer la table planning_shifts avec contrainte sur les 3 colonnes
DROP TABLE IF EXISTS planning_shifts;

CREATE TABLE planning_shifts (
  id          serial PRIMARY KEY,
  staff_name  text NOT NULL,
  shift_date  date NOT NULL,
  shift_type  text NOT NULL,  -- créneau horaire ex: '07:30', '08:00' etc
  created_by  uuid REFERENCES profiles(id),
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now(),
  UNIQUE(staff_name, shift_date, shift_type)
);

ALTER TABLE planning_shifts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "planning_all" ON planning_shifts FOR ALL USING (true);
