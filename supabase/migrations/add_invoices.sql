-- maPoche — Migration : factures clients

-- ==========================================
-- INVOICES
-- ==========================================
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  number TEXT NOT NULL,
  status TEXT CHECK (status IN ('draft','sent','paid','cancelled')) NOT NULL DEFAULT 'draft',
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  vat_rate NUMERIC(5,2) DEFAULT 0,
  notes TEXT,
  issuer_name TEXT,
  issuer_details TEXT,
  client_details TEXT,
  transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
  paid_at DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inv_select" ON invoices FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "inv_insert" ON invoices FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND (project_id IS NULL OR EXISTS (SELECT 1 FROM projects WHERE projects.id = invoices.project_id AND projects.user_id = auth.uid()))
  );
CREATE POLICY "inv_update" ON invoices FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "inv_delete" ON invoices FOR DELETE USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_invoices_project ON invoices(project_id);
CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices(user_id, number);

-- ==========================================
-- INVOICE ITEMS (lignes)
-- ==========================================
CREATE TABLE invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE NOT NULL,
  label TEXT NOT NULL,
  quantity NUMERIC(12,2) DEFAULT 1,
  unit_price NUMERIC(14,2) NOT NULL,
  kind TEXT CHECK (kind IN ('time','fixed','other')) NOT NULL DEFAULT 'other',
  position INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ii_select" ON invoice_items FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "ii_insert" ON invoice_items FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM invoices WHERE invoices.id = invoice_items.invoice_id AND invoices.user_id = auth.uid())
  );
CREATE POLICY "ii_update" ON invoice_items FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "ii_delete" ON invoice_items FOR DELETE USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items(invoice_id);

-- ==========================================
-- TIME ENTRIES : lien vers facture (temps déjà facturé)
-- ==========================================
ALTER TABLE time_entries
  ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_time_entries_invoice ON time_entries(invoice_id);
