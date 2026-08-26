import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTransactionsStore } from "@/stores/useTransactionsStore";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import type { Account, Category, FlowType, Transaction } from "@/types";
import { format } from "date-fns";
import { transactionSchema } from "@/lib/validations";
import type { z } from "zod";
import { X, Repeat, Tag } from "lucide-react";

interface Props {
  onClose: () => void;
  accounts: Account[];
  categories: Category[];
  initialData?: Transaction;
  recentDescriptions?: string[];
  onPrefill?: (description: string) => void;
}

const FLOW_OPTIONS = [
  { value: "expense", label: "Dépense" },
  { value: "income", label: "Revenu" },
  { value: "transfer", label: "Virement" },
];

const RECURRENCE_OPTIONS = [
  { value: "", label: "Une seule fois" },
  { value: "weekly", label: "Chaque semaine" },
  { value: "monthly", label: "Chaque mois" },
  { value: "yearly", label: "Chaque année" },
];

type FormData = z.infer<typeof transactionSchema>;

export default function TransactionForm({ onClose, accounts, categories, initialData, recentDescriptions, onPrefill }: Props) {
  const { add, update } = useTransactionsStore();
  const [loading, setLoading] = useState(false);
  const [tagInput, setTagInput] = useState("");

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      amount: initialData?.amount || 0,
      flow: (initialData?.flow as FlowType) || "expense",
      date: initialData?.date || format(new Date(), "yyyy-MM-dd"),
      account_id: initialData?.account_id || accounts[0]?.id || "",
      transfer_to_account_id: initialData?.transfer_to_account_id || null,
      category_id: initialData?.category_id || null,
      description: initialData?.description || null,
      note: initialData?.note || null,
      recurrence_rule: initialData?.recurrence_rule || null,
      tags: initialData?.tags || [],
    },
  });

  const flow = watch("flow");
  const accountId = watch("account_id");
  const tags = watch("tags") || [];

  useEffect(() => {
    if (!accountId && accounts.length > 0) {
      setValue("account_id", accounts[0].id);
    }
  }, [accounts, accountId, setValue]);

  const filteredCategories = categories.filter(
    (c) => c.flow === "both" || (c.flow as string) === (flow as string)
  );

  const selectedAccount = accounts.find(a => a.id === accountId);
  const currencySymbol = selectedAccount?.currency || "XOF";

  const addTag = () => {
    const trimmed = tagInput.trim();
    if (trimmed && !tags.includes(trimmed)) {
      setValue("tags", [...tags, trimmed]);
    }
    setTagInput("");
  };

  const removeTag = (tag: string) => {
    setValue("tags", tags.filter((t) => t !== tag));
  };

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    
    const payload = {
      amount: data.amount,
      flow: data.flow,
      date: data.date,
      account_id: data.account_id,
      category_id: data.category_id || null,
      transfer_to_account_id: data.flow === "transfer" ? (data.transfer_to_account_id || null) : null,
      description: data.description || null,
      note: data.note || null,
    };

    if (initialData) {
      const updatePayload: Record<string, unknown> = { ...payload, tags: data.tags || [] };
      if (initialData.recurrence_rule && !initialData.recurrence_parent_id) {
        updatePayload.recurrence_rule = data.recurrence_rule || null;
      }
      await update(initialData.id, updatePayload);
    } else {
      await add({
        ...payload,
        tags: data.tags || [],
        recurrence_rule: data.recurrence_rule || null,
        recurrence_parent_id: null,
        is_reviewed: false,
        is_active: true,
      });
    }
    setLoading(false);
    onClose();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {/* Flow type tabs */}
      <div className="grid grid-cols-3 gap-2 p-1 bg-surface-2 rounded-xl">
        {FLOW_OPTIONS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setValue("flow", f.value as FlowType)}
            className={`py-2 rounded-lg text-xs font-bold transition-all ${flow === f.value ? "bg-surface-0 text-text-primary shadow" : "text-text-muted hover:text-text-secondary"}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Amount */}
      <div className="text-center py-4">
        <div className="inline-flex items-baseline gap-1">
          <input
            type="number"
            step="0.01"
            min="0"
            {...register("amount", { valueAsNumber: true })}
            placeholder="0,00"
            className="bg-transparent text-4xl font-mono font-bold text-center outline-none w-48 placeholder:text-text-muted"
            autoFocus
          />
          <span className="text-lg text-text-muted font-mono">{currencySymbol}</span>
        </div>
        {errors.amount && <p className="text-xs text-rose-400 mt-1">{errors.amount.message}</p>}
      </div>

      <Input type="date" label="Date" {...register("date")} error={errors.date?.message} required />

      <Select label="Compte" options={accounts.map((a) => ({ value: a.id, label: a.name }))} {...register("account_id")} error={errors.account_id?.message} />

      {flow === "transfer" && (
        <Select label="Vers le compte" options={accounts.filter((a) => a.id !== accountId).map((a) => ({ value: a.id, label: a.name }))} {...register("transfer_to_account_id")} error={errors.transfer_to_account_id?.message} placeholder="Choisir..." />
      )}

      <Select label="Catégorie" options={filteredCategories.map((c) => ({ value: c.id, label: `${c.icon} ${c.name}` }))} {...register("category_id")} placeholder="Optionnel" />

      {/* Recurrence */}
      <div className="flex items-center gap-2">
        <Repeat className="w-4 h-4 text-text-muted shrink-0" />
        <Select label="Récurrence" options={RECURRENCE_OPTIONS} {...register("recurrence_rule")} />
      </div>

      <Input label="Description" {...register("description")} placeholder="Ex: Courses Carrefour" />

      {/* Recent descriptions (Quick-Add) */}
      {recentDescriptions && recentDescriptions.length > 0 && !initialData && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-medium text-text-muted uppercase tracking-wider">Récemment</p>
          <div className="flex flex-wrap gap-1.5">
            {recentDescriptions.map((desc, i) => (
              <button
                key={i}
                type="button"
                onClick={() => { setValue("description", desc); onPrefill?.(desc); }}
                className="px-2.5 py-1 text-[11px] bg-surface-2 hover:bg-surface-3 border border-surface-4 rounded-lg text-text-secondary transition-colors truncate max-w-[200px]"
              >
                {desc}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Tags */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <Tag className="w-4 h-4 text-text-muted" />
          <label className="text-xs font-medium text-text-muted uppercase tracking-wider">Tags</label>
        </div>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <span key={tag} className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium bg-brand-500/10 text-brand-400 border border-brand-500/20 rounded-lg">
                {tag}
                <button type="button" onClick={() => removeTag(tag)} className="hover:text-rose-400">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
            placeholder="Ajouter un tag..."
            className="flex-1 bg-surface-2 border border-surface-4 rounded-xl px-3 py-1.5 text-xs text-text-primary placeholder:text-text-muted outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30"
          />
          <Button type="button" size="sm" variant="ghost" onClick={addTag}>Ajouter</Button>
        </div>
      </div>

      <Input label="Note" {...register("note")} placeholder="Note interne (optionnel)" />

      <div className="flex gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={onClose} className="flex-1">Annuler</Button>
        <Button type="submit" loading={loading} className="flex-1">Enregistrer</Button>
      </div>
    </form>
  );
}
