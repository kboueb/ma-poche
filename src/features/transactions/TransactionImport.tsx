import { useState, useCallback, useMemo } from "react";
import { parseCSVText, applyMapping, dedup, type ParsedRow, type CSVMapping } from "@/lib/parsers/csvParser";
import { useTransactionsStore } from "@/stores/useTransactionsStore";
import { useCategoriesStore } from "@/stores/useCategoriesStore";
import { formatCurrency } from "@/lib/utils/currency";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { Upload, FileSpreadsheet, Check, Sparkles } from "lucide-react";
import type { Account } from "@/types";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  accounts: Account[];
}

type Step = "upload" | "mapping" | "preview" | "done";

export default function TransactionImport({ isOpen, onClose, accounts }: Props) {
  const { transactions, add } = useTransactionsStore();
  const { categories } = useCategoriesStore();
  const [step, setStep] = useState<Step>("upload");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<CSVMapping>({ dateCol: 0, amountCol: 1, descCol: 2 });
  const [accountId, setAccountId] = useState(accounts[0]?.id || "");
  const [parsed, setParsed] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [importCount, setImportCount] = useState(0);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const { headers: h, rows: r } = parseCSVText(text);
      setHeaders(h);
      setRows(r);

      // Auto-detect columns by header names
      const lower = h.map((x) => x.toLowerCase());
      const dateIdx = lower.findIndex((x) => x.includes("date"));
      const amountIdx = lower.findIndex((x) => x.includes("montant") || x.includes("amount") || x.includes("debit"));
      const descIdx = lower.findIndex((x) => x.includes("libelle") || x.includes("description") || x.includes("label"));
      const creditIdx = lower.findIndex((x) => x.includes("credit") || x.includes("crédit"));

      setMapping({
        dateCol: dateIdx >= 0 ? dateIdx : 0,
        amountCol: amountIdx >= 0 ? amountIdx : 1,
        descCol: descIdx >= 0 ? descIdx : 2,
        creditCol: creditIdx >= 0 ? creditIdx : undefined,
      });

      setStep("mapping");
    };
    reader.readAsText(file, "UTF-8");
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith(".csv") || file.name.endsWith(".txt"))) handleFile(file);
  }, [handleFile]);

  const handlePick = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const colOptions = useMemo(() => headers.map((h, i) => ({ value: String(i), label: `${i + 1}. ${h}` })), [headers]);

  const guessCategory = (description: string): string | null => {
    const desc = description.toLowerCase();
    
    // Mots-clés pour catégorisation "intelligente"
    const keywords: Record<string, string[]> = {
      "alimentation": ["auchan", "carrefour", "casino", "super u", "leclerc", "boulangerie", "resto", "restaurant", "mcdo", "uber eats", "deliveroo", "monoprix", "lidl"],
      "transport": ["total", "shell", "sncf", "uber", "bolt", "ratp", "navigo", "station service", "essence"],
      "logement": ["loyer", "edf", "engie", "eau", "assurance", "internet", "orange", "free", "bouygues", "sfr"],
      "loisirs": ["netflix", "spotify", "cinema", "fnac", "amazon", "steam", "playstation", "apple"],
      "santé": ["pharmacie", "docteur", "medecin", "mutuelle", "hopital", "dentiste", "chu"],
      "revenu": ["salaire", "virement", "caf", "remboursement"],
    };

    // Cherche via le dictionnaire de mots-clés
    for (const [key, words] of Object.entries(keywords)) {
      if (words.some(w => desc.includes(w))) {
        const match = categories.find(c => c.name.toLowerCase().includes(key));
        if (match) return match.id;
      }
    }

    // Cherche directement via le nom de la catégorie
    for (const cat of categories) {
      if (cat.name.length > 3 && desc.includes(cat.name.toLowerCase())) {
        return cat.id;
      }
    }

    return null;
  };

  const doPreview = () => {
    const mapped = applyMapping(rows, mapping);
    const deduped = dedup(mapped, transactions);
    
    // Attacher la catégorie devinée pour l'aperçu
    const withCategories = deduped.map(r => ({
      ...r,
      guessedCategoryId: guessCategory(r.description)
    }));
    
    setParsed(withCategories as any);
    setStep("preview");
  };

  const doImport = async () => {
    if (!accountId) return;
    setImporting(true);
    let count = 0;
    for (const row of parsed) {
      await add({
        amount: row.amount,
        flow: row.flow,
        date: row.date,
        account_id: accountId,
        category_id: (row as any).guessedCategoryId || null,
        transfer_to_account_id: null,
        description: row.description,
        note: null,
        tags: [],
        recurrence_rule: null,
        recurrence_parent_id: null,
        is_reviewed: false,
        is_active: true,
      });
      count++;
    }
    setImportCount(count);
    setImporting(false);
    setStep("done");
  };

  const reset = () => {
    setStep("upload"); setHeaders([]); setRows([]); setParsed([]); setImportCount(0);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={reset} title="Importer des transactions" size="lg">
      {/* Step: Upload */}
      {step === "upload" && (
        <div
          className={`border-2 border-dashed rounded-2xl p-12 text-center transition-colors ${dragOver ? "border-brand-400 bg-brand-500/5" : "border-surface-4 hover:border-surface-5"}`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          <Upload className="w-10 h-10 text-text-muted mx-auto mb-4" />
          <p className="text-sm font-medium mb-1">Glisse ton fichier CSV ici</p>
          <p className="text-xs text-text-muted mb-4">ou clique pour parcourir</p>
          <label className="inline-block">
            <input type="file" accept=".csv,.txt,.tsv" onChange={handlePick} className="hidden" />
            <span className="inline-flex items-center gap-2 px-4 py-2 bg-surface-3 rounded-xl text-sm font-medium cursor-pointer hover:bg-surface-4 transition-colors">
              <FileSpreadsheet className="w-4 h-4" /> Choisir un fichier
            </span>
          </label>
        </div>
      )}

      {/* Step: Column mapping */}
      {step === "mapping" && (
        <div className="space-y-5">
          <p className="text-sm text-text-secondary">{rows.length} lignes détectées — configure le mapping des colonnes :</p>

          <Select label="Colonne Date" options={colOptions} value={String(mapping.dateCol)} onChange={(e) => setMapping({ ...mapping, dateCol: parseInt(e.target.value) })} />
          <Select label="Colonne Montant / Débit" options={colOptions} value={String(mapping.amountCol)} onChange={(e) => setMapping({ ...mapping, amountCol: parseInt(e.target.value) })} />
          <Select label="Colonne Description" options={colOptions} value={String(mapping.descCol)} onChange={(e) => setMapping({ ...mapping, descCol: parseInt(e.target.value) })} />
          <Select
            label="Colonne Crédit (optionnel)"
            options={[{ value: "", label: "— Pas de colonne crédit séparée —" }, ...colOptions]}
            value={mapping.creditCol !== undefined ? String(mapping.creditCol) : ""}
            onChange={(e) => setMapping({ ...mapping, creditCol: e.target.value ? parseInt(e.target.value) : undefined })}
          />
          <Select label="Compte cible" options={accounts.map((a) => ({ value: a.id, label: a.name }))} value={accountId} onChange={(e) => setAccountId(e.target.value)} />

          {/* Preview first 3 rows */}
          <div className="bg-surface-2 rounded-xl p-3 overflow-x-auto">
            <p className="text-xs text-text-muted mb-2">Aperçu (3 premières lignes) :</p>
            <table className="w-full text-xs">
              <thead><tr>{headers.map((h, i) => <th key={i} className="text-left p-1 text-text-muted">{h}</th>)}</tr></thead>
              <tbody>{rows.slice(0, 3).map((row, i) => <tr key={i}>{row.map((c, j) => <td key={j} className="p-1 text-text-secondary">{c}</td>)}</tr>)}</tbody>
            </table>
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="secondary" className="flex-1" onClick={() => setStep("upload")}>Retour</Button>
            <Button className="flex-1" onClick={doPreview}>Prévisualiser</Button>
          </div>
        </div>
      )}

      {/* Step: Preview */}
      {step === "preview" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 bg-brand-500/10 border border-brand-500/20 rounded-xl">
            <Check className="w-5 h-5 text-brand-400" />
            <p className="text-sm font-medium text-brand-400">{parsed.length} transactions prêtes à importer (doublons exclus)</p>
          </div>

          <div className="max-h-64 overflow-y-auto space-y-1">
            {parsed.slice(0, 50).map((r, i) => (
              <div key={i} className="flex items-center gap-3 p-2.5 bg-surface-2 rounded-xl">
                <span className={`text-xs font-bold px-2 py-0.5 rounded ${r.flow === "income" ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"}`}>
                  {r.flow === "income" ? "+" : "-"}
                </span>
                <div className="flex-1 min-w-0">
                  <span className="text-sm truncate block">{r.description}</span>
                  {(r as any).guessedCategoryId && (
                    <span className="text-[10px] text-brand-400 flex items-center gap-1 mt-0.5">
                      <Sparkles className="w-3 h-3" />
                      {categories.find(c => c.id === (r as any).guessedCategoryId)?.name || "Catégorie suggérée"}
                    </span>
                  )}
                </div>
                <span className="text-xs text-text-muted">{r.date}</span>
                <span className={`text-sm font-mono font-bold ${r.flow === "income" ? "text-emerald-400" : "text-rose-400"}`}>
                  {formatCurrency(r.amount)}
                </span>
              </div>
            ))}
            {parsed.length > 50 && <p className="text-xs text-text-muted text-center py-2">... et {parsed.length - 50} de plus</p>}
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="secondary" className="flex-1" onClick={() => setStep("mapping")}>Retour</Button>
            <Button className="flex-1" loading={importing} onClick={doImport}>Importer {parsed.length} transactions</Button>
          </div>
        </div>
      )}

      {/* Step: Done */}
      {step === "done" && (
        <div className="text-center py-8 space-y-4">
          <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto">
            <Check className="w-8 h-8 text-emerald-400" />
          </div>
          <h3 className="text-lg font-bold">{importCount} transactions importées !</h3>
          <p className="text-sm text-text-muted">Tu peux maintenant les catégoriser depuis la liste.</p>
          <Button onClick={reset}>Fermer</Button>
        </div>
      )}
    </Modal>
  );
}
