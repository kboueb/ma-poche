import { useState, useEffect } from "react";
import { useTransactionsStore } from "@/stores/useTransactionsStore";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import type { Account, Category, FlowType, Transaction } from "@/types";
import { format } from "date-fns";

interface Props {
  onClose: () => void;
  accounts: Account[];
  categories: Category[];
  initialData?: Transaction;
}

const FLOW_OPTIONS = [
  { value: "expense", label: "💸 Dépense" },
  { value: "income", label: "💰 Revenu" },
  { value: "transfer", label: "🔄 Virement" },
];

export default function TransactionForm({ onClose, accounts, categories, initialData }: Props) {
  const { add, update } = useTransactionsStore();
  const [flow, setFlow] = useState<FlowType>(initialData?.flow || "expense");
  const [amount, setAmount] = useState(initialData?.amount?.toString() || "");
  const [date, setDate] = useState(initialData?.date || format(new Date(), "yyyy-MM-dd"));
  const [accountId, setAccountId] = useState(initialData?.account_id || accounts[0]?.id || "");
  const [transferToId, setTransferToId] = useState(initialData?.transfer_to_account_id || "");
  const [categoryId, setCategoryId] = useState(initialData?.category_id || "");
  const [description, setDescription] = useState(initialData?.description || "");
  const [note, setNote] = useState(initialData?.note || "");
  const [loading, setLoading] = useState(false);

  // Auto-select first account if not set
  useEffect(() => {
    if (!accountId && accounts.length > 0) {
      setAccountId(accounts[0].id);
    }
  }, [accounts, accountId]);

  const filteredCategories = categories.filter(
    (c) => c.flow === "both" || (c.flow as string) === (flow as string)
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !accountId) return;
    setLoading(true);
    
    const payload = {
      amount: parseFloat(amount),
      flow,
      date,
      account_id: accountId,
      category_id: categoryId || null,
      transfer_to_account_id: flow === "transfer" ? transferToId : null,
      description: description || null,
      note: note || null,
    };

    if (initialData) {
      await update(initialData.id, payload);
    } else {
      await add({
        ...payload,
        tags: [],
        recurrence_rule: null,
        recurrence_parent_id: null,
        is_reviewed: false,
      });
    }
    setLoading(false);
    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Flow type tabs */}
      <div className="grid grid-cols-3 gap-2 p-1 bg-surface-2 rounded-xl">
        {FLOW_OPTIONS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFlow(f.value as FlowType)}
            className={`py-2 rounded-lg text-xs font-bold transition-all ${flow === f.value ? "bg-surface-0 text-text-primary shadow" : "text-text-muted hover:text-text-secondary"}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Amount — big input */}
      <div className="text-center py-4">
        <div className="inline-flex items-baseline gap-1">
          <input
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0,00"
            className="bg-transparent text-4xl font-mono font-bold text-center outline-none w-48 placeholder:text-text-muted"
            autoFocus
            required
          />
          <span className="text-lg text-text-muted font-mono">FCFA</span>
        </div>
      </div>

      <Input type="date" label="Date" value={date} onChange={(e) => setDate(e.target.value)} required />

      <Select label="Compte" options={accounts.map((a) => ({ value: a.id, label: a.name }))} value={accountId} onChange={(e) => setAccountId(e.target.value)} />

      {flow === "transfer" && (
        <Select label="Vers le compte" options={accounts.filter((a) => a.id !== accountId).map((a) => ({ value: a.id, label: a.name }))} value={transferToId} onChange={(e) => setTransferToId(e.target.value)} placeholder="Choisir..." />
      )}

      <Select label="Catégorie" options={filteredCategories.map((c) => ({ value: c.id, label: `${c.icon} ${c.name}` }))} value={categoryId} onChange={(e) => setCategoryId(e.target.value)} placeholder="Optionnel" />

      <Input label="Description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex: Courses Carrefour" />

      <Input label="Note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note interne (optionnel)" />

      <div className="flex gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={onClose} className="flex-1">Annuler</Button>
        <Button type="submit" loading={loading} className="flex-1">Enregistrer</Button>
      </div>
    </form>
  );
}
