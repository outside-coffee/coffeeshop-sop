-- Ajouter colonnes dans profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS prenom       text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS nom          text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role_operationnel text;  -- Barista Lead, Barista, Service Crew, Support Crew
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS date_recrutement date;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS telephone    text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS actif        boolean DEFAULT true;
