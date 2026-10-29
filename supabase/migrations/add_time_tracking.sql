-- maPoche — Migration : suivi du temps de travail (missions)

-- ==========================================
-- TASKS (tâches par mission)
-- ==========================================
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  done BOOLEAN DEFAULT false,
  estimated_minutes INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "task_select" ON tasks FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "task_insert" ON tasks FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM projects WHERE projects.id = tasks.project_id AND projects.user_id = auth.uid())
  );
CREATE POLICY "task_update" ON tasks FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "task_delete" ON tasks FOR DELETE USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);

-- ==========================================
-- TIME_ENTRIES (timer + saisies manuelles)
-- ended_at NULL = timer en cours
-- ==========================================
CREATE TABLE time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  description TEXT,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  duration_minutes INTEGER,
  billable BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "te_select" ON time_entries FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "te_insert" ON time_entries FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM projects WHERE projects.id = time_entries.project_id AND projects.user_id = auth.uid())
    AND (task_id IS NULL OR EXISTS (SELECT 1 FROM tasks WHERE tasks.id = time_entries.task_id AND tasks.user_id = auth.uid()))
  );
CREATE POLICY "te_update" ON time_entries FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "te_delete" ON time_entries FOR DELETE USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_time_entries_project ON time_entries(project_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_task ON time_entries(task_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_started ON time_entries(user_id, started_at DESC);

-- ==========================================
-- PROJECTS : taux horaire pour valorisation
-- ==========================================
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS hourly_rate NUMERIC(14,2);
