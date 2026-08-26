-- maPoche — Migration : aligner le schema avec le code TypeScript
-- Ajoute les colonnes manquantes et corrige les CHECK constraints

-- ==========================================
-- ACCOUNTS : ajouter mobile_money + colonnes solde
-- ==========================================
ALTER TABLE accounts
  DROP CONSTRAINT IF EXISTS accounts_type_check;

ALTER TABLE accounts
  ADD CONSTRAINT accounts_type_check
  CHECK (type IN ('checking','savings','credit','investment','cash','mobile_money','other'));

ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS initial_balance NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS current_balance NUMERIC(14,2) DEFAULT 0;

-- ==========================================
-- LIABILITIES : corriger types + ajouter colonnes manquantes
-- ==========================================
ALTER TABLE liabilities
  DROP CONSTRAINT IF EXISTS liabilities_type_check;

ALTER TABLE liabilities
  ADD CONSTRAINT liabilities_type_check
  CHECK (type IN ('mortgage','car_loan','consumer_credit','student_loan','other'));

ALTER TABLE liabilities
  ADD COLUMN IF NOT EXISTS linked_asset_id UUID REFERENCES assets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS start_date DATE,
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- Renommer total_amount en initial_amount pour correspondre au code TS
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'liabilities' AND column_name = 'total_amount')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'liabilities' AND column_name = 'initial_amount') THEN
    ALTER TABLE liabilities RENAME COLUMN total_amount TO initial_amount;
  END IF;
END $$;

-- ==========================================
-- INDEX : ajouter les index manquants
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_goals_user ON goals(user_id);
CREATE INDEX IF NOT EXISTS idx_assets_user ON assets(user_id);
CREATE INDEX IF NOT EXISTS idx_liabilities_user ON liabilities(user_id);
CREATE INDEX IF NOT EXISTS idx_budgets_user_category ON budgets(user_id, category_id);
CREATE INDEX IF NOT EXISTS idx_asset_history_asset_date ON asset_history(asset_id, recorded_at);
