-- maPoche — Durcissement RLS : vérifier l'appartenance des objets parents (anti-IDOR)
-- Un utilisateur ne doit pas pouvoir lier ses lignes aux transactions/projets d'un autre
-- (les UUID ne sont pas énumérables, mais on verrouille quand même).

-- ==========================================
-- ATTACHMENTS : la transaction liée doit appartenir à l'utilisateur
-- ==========================================
DROP POLICY IF EXISTS "att_insert" ON attachments;
CREATE POLICY "att_insert" ON attachments FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM transactions WHERE transactions.id = attachments.transaction_id AND transactions.user_id = auth.uid())
  );

-- ==========================================
-- MILESTONES : le projet parent doit appartenir à l'utilisateur
-- ==========================================
DROP POLICY IF EXISTS "ms_insert" ON milestones;
CREATE POLICY "ms_insert" ON milestones FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM projects WHERE projects.id = milestones.project_id AND projects.user_id = auth.uid())
  );

-- ==========================================
-- TRANSACTIONS : le projet lié doit appartenir à l'utilisateur
-- ==========================================
DROP POLICY IF EXISTS "txn_insert" ON transactions;
CREATE POLICY "txn_insert" ON transactions FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND (project_id IS NULL OR EXISTS (SELECT 1 FROM projects WHERE projects.id = transactions.project_id AND projects.user_id = auth.uid()))
  );

DROP POLICY IF EXISTS "txn_update" ON transactions;
CREATE POLICY "txn_update" ON transactions FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND (project_id IS NULL OR EXISTS (SELECT 1 FROM projects WHERE projects.id = transactions.project_id AND projects.user_id = auth.uid()))
  );
