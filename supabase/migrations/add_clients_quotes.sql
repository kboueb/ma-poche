-- maPoche — Migration : clients, TJM / budget des missions, devis, modèles de mission
-- Dépend de : add_projects.sql, add_time_tracking.sql, add_invoices.sql
-- Idempotente : peut être rejouée sans risque.

-- ==========================================
-- CLIENTS
-- ==========================================
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  siret TEXT,
  vat_number TEXT,
  payment_terms_days INTEGER DEFAULT 30,
  default_daily_rate NUMERIC(14,2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cli_select" ON clients;
DROP POLICY IF EXISTS "cli_insert" ON clients;
DROP POLICY IF EXISTS "cli_update" ON clients;
DROP POLICY IF EXISTS "cli_delete" ON clients;
CREATE POLICY "cli_select" ON clients FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "cli_insert" ON clients FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "cli_update" ON clients FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "cli_delete" ON clients FOR DELETE USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_clients_user ON clients(user_id);

-- ==========================================
-- PROJECTS : client, mode de facturation, TJM, budget
-- client_name reste rempli (copie du nom) pour l'affichage et la compatibilité.
-- ==========================================
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS billing_mode TEXT CHECK (billing_mode IN ('fixed','daily','hourly')) DEFAULT 'fixed',
  ADD COLUMN IF NOT EXISTS daily_rate NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS budget_days NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS recurring_monthly BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_projects_client ON projects(client_id);

-- Reprise : un client par nom distinct, puis rattachement des missions existantes
INSERT INTO clients (user_id, name)
SELECT DISTINCT p.user_id, btrim(p.client_name)
FROM projects p
WHERE p.client_id IS NULL
  AND btrim(coalesce(p.client_name, '')) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM clients c
    WHERE c.user_id = p.user_id AND lower(c.name) = lower(btrim(p.client_name))
  );

UPDATE projects p
SET client_id = c.id
FROM clients c
WHERE p.client_id IS NULL
  AND c.user_id = p.user_id
  AND lower(c.name) = lower(btrim(p.client_name));

-- Missions déjà au taux horaire sans forfait : mode horaire
UPDATE projects SET billing_mode = 'hourly'
WHERE billing_mode = 'fixed' AND total_amount IS NULL AND hourly_rate IS NOT NULL;

-- ==========================================
-- QUOTES (devis)
-- ==========================================
CREATE TABLE IF NOT EXISTS quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  number TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT CHECK (status IN ('draft','sent','accepted','declined')) NOT NULL DEFAULT 'draft',
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_until DATE,
  vat_rate NUMERIC(5,2) DEFAULT 0,
  deposit_percent NUMERIC(5,2),
  notes TEXT,
  accepted_at DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "quo_select" ON quotes;
DROP POLICY IF EXISTS "quo_insert" ON quotes;
DROP POLICY IF EXISTS "quo_update" ON quotes;
DROP POLICY IF EXISTS "quo_delete" ON quotes;
CREATE POLICY "quo_select" ON quotes FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "quo_insert" ON quotes FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "quo_update" ON quotes FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "quo_delete" ON quotes FOR DELETE USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_quotes_user ON quotes(user_id);
CREATE INDEX IF NOT EXISTS idx_quotes_client ON quotes(client_id);

CREATE TABLE IF NOT EXISTS quote_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  quote_id UUID REFERENCES quotes(id) ON DELETE CASCADE NOT NULL,
  label TEXT NOT NULL,
  quantity NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit TEXT,
  unit_price NUMERIC(14,2) NOT NULL DEFAULT 0,
  position INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE quote_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "qi_select" ON quote_items;
DROP POLICY IF EXISTS "qi_insert" ON quote_items;
DROP POLICY IF EXISTS "qi_update" ON quote_items;
DROP POLICY IF EXISTS "qi_delete" ON quote_items;
CREATE POLICY "qi_select" ON quote_items FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "qi_insert" ON quote_items FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM quotes WHERE quotes.id = quote_items.quote_id AND quotes.user_id = auth.uid())
  );
CREATE POLICY "qi_update" ON quote_items FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "qi_delete" ON quote_items FOR DELETE USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_quote_items_quote ON quote_items(quote_id);

-- ==========================================
-- MISSION_TEMPLATES (tâches + jalons types)
-- tasks : [{ "title": "...", "estimated_minutes": 120 }]
-- milestones : [{ "title": "...", "kind": "payment", "offset_days": 30, "amount_percent": 30 }]
-- ==========================================
CREATE TABLE IF NOT EXISTS mission_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  name TEXT NOT NULL,
  billing_mode TEXT CHECK (billing_mode IN ('fixed','daily','hourly')) DEFAULT 'fixed',
  tasks JSONB NOT NULL DEFAULT '[]'::jsonb,
  milestones JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE mission_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "mt_select" ON mission_templates;
DROP POLICY IF EXISTS "mt_insert" ON mission_templates;
DROP POLICY IF EXISTS "mt_update" ON mission_templates;
DROP POLICY IF EXISTS "mt_delete" ON mission_templates;
CREATE POLICY "mt_select" ON mission_templates FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "mt_insert" ON mission_templates FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "mt_update" ON mission_templates FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "mt_delete" ON mission_templates FOR DELETE USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_mission_templates_user ON mission_templates(user_id);
