-- maPoche — Migration : suivi de missions (consultance)

-- ==========================================
-- PROJECTS (missions clients)
-- ==========================================
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  client_name TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT CHECK (status IN ('prospect','active','done','archived')) NOT NULL DEFAULT 'active',
  total_amount NUMERIC(14,2),
  start_date DATE,
  deadline DATE,
  color TEXT DEFAULT '#6366f1',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "proj_select" ON projects FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "proj_insert" ON projects FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "proj_update" ON projects FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "proj_delete" ON projects FOR DELETE USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id);

-- ==========================================
-- MILESTONES (échéances, validations, paiements attendus)
-- ==========================================
CREATE TABLE milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  kind TEXT CHECK (kind IN ('deadline','validation','payment')) NOT NULL DEFAULT 'deadline',
  due_date DATE,
  amount NUMERIC(14,2),
  done BOOLEAN DEFAULT false,
  done_at DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ms_select" ON milestones FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "ms_insert" ON milestones FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "ms_update" ON milestones FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "ms_delete" ON milestones FOR DELETE USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_milestones_project ON milestones(project_id);

-- ==========================================
-- TRANSACTIONS : liaison optionnelle à un projet
-- ==========================================
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_project ON transactions(project_id);
