-- maPoche — Migration : conditions de paiement & échéances par facture

-- ==========================================
-- INVOICE_PAYMENTS (tranchés / échéances de règlement)
-- ==========================================
CREATE TABLE invoice_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE NOT NULL,
  label TEXT NOT NULL,                 -- ex: "Acompte 50%", "Mise en ligne 20%"
  amount_due NUMERIC(14,2) NOT NULL,   -- montant attendu pour cette tranche
  amount_paid NUMERIC(14,2) NOT NULL DEFAULT 0,
  due_date DATE,                       -- date d'échéance prévue
  paid_date DATE,                      -- date de règlement effective
  status TEXT CHECK (status IN ('pending','paid','overdue')) NOT NULL DEFAULT 'pending',
  transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL, -- transaction créée quand payé
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE invoice_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ip_select" ON invoice_payments FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "ip_insert" ON invoice_payments FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM invoices WHERE invoices.id = invoice_payments.invoice_id AND invoices.user_id = auth.uid())
  );
CREATE POLICY "ip_update" ON invoice_payments FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "ip_delete" ON invoice_payments FOR DELETE USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_invoice_payments_invoice ON invoice_payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_payments_due_date ON invoice_payments(due_date);
CREATE INDEX IF NOT EXISTS idx_invoice_payments_status ON invoice_payments(status);

-- ==========================================
-- INVOICES : champ conditions de paiement (texte libre)
-- ==========================================
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS payment_terms TEXT; -- ex: "50% démarrage / 30% MVP / 20% mise en ligne"
