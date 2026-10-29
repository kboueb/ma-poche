import { useEffect } from "react";
import { Modal } from "@/components/ui/Modal";
import TransactionForm from "@/features/transactions/TransactionForm";
import { useUIStore } from "@/stores/useUIStore";
import { useTransactionsStore } from "@/stores/useTransactionsStore";
import { useAccountsStore } from "@/stores/useAccountsStore";
import { useCategoriesStore } from "@/stores/useCategoriesStore";

/** Modal "Nouvelle transaction" accessible partout via la touche N. */
export default function GlobalTransactionModal() {
  const open = useUIStore((s) => s.txModalOpen);
  const setOpen = useUIStore((s) => s.setTxModalOpen);
  const { fetch: fetchTx } = useTransactionsStore();
  const { accounts, fetch: fetchAcc } = useAccountsStore();
  const { categories, fetch: fetchCat } = useCategoriesStore();

  useEffect(() => {
    if (open) { fetchAcc(); fetchCat(); }
  }, [open, fetchAcc, fetchCat]);

  return (
    <Modal isOpen={open} onClose={() => setOpen(false)} title="Nouvelle transaction">
      <TransactionForm
        onClose={() => { setOpen(false); fetchTx(); fetchAcc(); }}
        accounts={accounts}
        categories={categories}
      />
    </Modal>
  );
}
