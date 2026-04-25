-- maPoche — Schema SQL Supabase
-- Migration initiale : tables, RLS, index

-- ==========================================
-- ACCOUNTS
-- ==========================================
CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  name TEXT NOT NULL,
  type TEXT CHECK (type IN ('checking','savings','credit','investment','cash','other')) NOT NULL,
  institution TEXT,
  currency CHAR(3) DEFAULT 'XOF',
  color TEXT DEFAULT '#6366f1',
  is_liquid BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "accounts_select" ON accounts FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "accounts_insert" ON accounts FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "accounts_update" ON accounts FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "accounts_delete" ON accounts FOR DELETE USING (user_id = auth.uid());

-- ==========================================
-- CATEGORIES (hiérarchiques)
-- ==========================================
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  name TEXT NOT NULL,
  icon TEXT DEFAULT 'circle',
  color TEXT DEFAULT '#94a3b8',
  parent_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  flow TEXT CHECK (flow IN ('income','expense','both')) DEFAULT 'expense'
);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "categories_select" ON categories FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "categories_insert" ON categories FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "categories_update" ON categories FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "categories_delete" ON categories FOR DELETE USING (user_id = auth.uid());

-- ==========================================
-- TRANSACTIONS
-- ==========================================
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE NOT NULL,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  amount NUMERIC(12,2) NOT NULL,
  flow TEXT CHECK (flow IN ('income','expense','transfer')) NOT NULL,
  transfer_to_account_id UUID REFERENCES accounts(id),
  date DATE NOT NULL,
  description TEXT,
  note TEXT,
  tags TEXT[],
  recurrence_rule TEXT,
  recurrence_parent_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
  is_reviewed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "txn_select" ON transactions FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "txn_insert" ON transactions FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "txn_update" ON transactions FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "txn_delete" ON transactions FOR DELETE USING (user_id = auth.uid());

CREATE INDEX idx_txn_user_date ON transactions(user_id, date DESC);
CREATE INDEX idx_txn_user_account ON transactions(user_id, account_id);
CREATE INDEX idx_txn_description ON transactions USING gin(to_tsvector('french', coalesce(description, '')));

-- ==========================================
-- ASSETS
-- ==========================================
CREATE TABLE assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  name TEXT NOT NULL,
  type TEXT CHECK (type IN ('real_estate','stock','etf','crypto','savings_account','life_insurance','other')) NOT NULL,
  purchase_price NUMERIC(14,2),
  current_value NUMERIC(14,2) NOT NULL,
  purchase_date DATE,
  quantity NUMERIC(18,8),
  ticker TEXT,
  currency CHAR(3) DEFAULT 'XOF',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "assets_select" ON assets FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "assets_insert" ON assets FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "assets_update" ON assets FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "assets_delete" ON assets FOR DELETE USING (user_id = auth.uid());

-- ==========================================
-- LIABILITIES
-- ==========================================
CREATE TABLE liabilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  account_id UUID REFERENCES accounts(id) ON DELETE SET NULL, -- Compte de débit
  name TEXT NOT NULL,
  type TEXT CHECK (type IN ('mortgage','car_loan','student_loan','personal_loan','credit_card','other')) NOT NULL,
  total_amount NUMERIC(14,2) NOT NULL,
  remaining_amount NUMERIC(14,2) NOT NULL,
  interest_rate NUMERIC(5,2),
  monthly_payment NUMERIC(12,2),
  start_date DATE,
  end_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE liabilities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "liab_select" ON liabilities FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "liab_insert" ON liabilities FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "liab_update" ON liabilities FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "liab_delete" ON liabilities FOR DELETE USING (user_id = auth.uid());

-- ==========================================
-- BUDGETS
-- ==========================================
CREATE TABLE budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  category_id UUID REFERENCES categories(id) ON DELETE CASCADE NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  period TEXT CHECK (period IN ('monthly','yearly')) DEFAULT 'monthly',
  rollover BOOLEAN DEFAULT false,
  alert_threshold NUMERIC(3,0) DEFAULT 80,
  active_from DATE NOT NULL,
  active_to DATE
);

ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "budgets_select" ON budgets FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "budgets_insert" ON budgets FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "budgets_update" ON budgets FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "budgets_delete" ON budgets FOR DELETE USING (user_id = auth.uid());

-- ==========================================
-- GOALS
-- ==========================================
CREATE TABLE goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  name TEXT NOT NULL,
  target_amount NUMERIC(12,2) NOT NULL,
  current_amount NUMERIC(12,2) DEFAULT 0,
  deadline DATE,
  linked_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  icon TEXT DEFAULT 'target',
  color TEXT DEFAULT '#10b981',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "goals_select" ON goals FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "goals_insert" ON goals FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "goals_update" ON goals FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "goals_delete" ON goals FOR DELETE USING (user_id = auth.uid());

-- ==========================================
-- ASSET HISTORY
-- ==========================================
CREATE TABLE asset_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID REFERENCES assets(id) ON DELETE CASCADE NOT NULL,
  value NUMERIC(14,2) NOT NULL,
  recorded_at DATE NOT NULL
);

-- RLS via join : only owner of parent asset can see/write
ALTER TABLE asset_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ah_select" ON asset_history FOR SELECT
  USING (EXISTS (SELECT 1 FROM assets WHERE assets.id = asset_history.asset_id AND assets.user_id = auth.uid()));
CREATE POLICY "ah_insert" ON asset_history FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM assets WHERE assets.id = asset_history.asset_id AND assets.user_id = auth.uid()));
CREATE POLICY "ah_delete" ON asset_history FOR DELETE
  USING (EXISTS (SELECT 1 FROM assets WHERE assets.id = asset_history.asset_id AND assets.user_id = auth.uid()));

-- ==========================================
-- SEED : catégories par défaut (exécuter après inscription)
-- ==========================================
-- Sera géré côté application lors du premier login (onboarding)
