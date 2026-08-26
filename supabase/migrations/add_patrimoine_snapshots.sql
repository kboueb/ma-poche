-- maPoche — Migration : snapshots patrimoine + budget rollover + recurrence pause

-- ==========================================
-- PATRIMOINE SNAPSHOTS
-- ==========================================
CREATE TABLE patrimoine_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  total_assets NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_liabilities NUMERIC(14,2) NOT NULL DEFAULT 0,
  net_worth NUMERIC(14,2) NOT NULL DEFAULT 0,
  account_balances NUMERIC(14,2) NOT NULL DEFAULT 0,
  recorded_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE patrimoine_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ps_select" ON patrimoine_snapshots FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "ps_insert" ON patrimoine_snapshots FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "ps_delete" ON patrimoine_snapshots FOR DELETE USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_patrimoine_snapshots_user_date ON patrimoine_snapshots(user_id, recorded_at DESC);

-- ==========================================
-- BUDGETS : add month/year columns for rollover
-- ==========================================
ALTER TABLE budgets
  ADD COLUMN IF NOT EXISTS budget_month INTEGER,
  ADD COLUMN IF NOT EXISTS budget_year INTEGER,
  ADD COLUMN IF NOT EXISTS rollover_used BOOLEAN DEFAULT false;

-- ==========================================
-- TRANSACTIONS : add is_active for pause/resume recurrence
-- ==========================================
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
