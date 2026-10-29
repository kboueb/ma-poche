import { useEffect, useState } from "react";
import { Paperclip, Trash2, FileText, Loader2, ExternalLink, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import type { Attachment } from "@/types";
import {
  listAttachments,
  uploadAttachment,
  deleteAttachment,
  getAttachmentUrl,
  isImage,
  isMissingTableError,
} from "@/lib/services/attachmentService";

interface Props {
  transactionId: string | null;
  pendingFiles: File[];
  onPendingChange: (files: File[]) => void;
}

export default function AttachmentSection({ transactionId, pendingFiles, onPendingChange }: Props) {
  const [saved, setSaved] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [storageError, setStorageError] = useState<"missing-table" | null>(null);

  useEffect(() => {
    if (!transactionId) { setSaved([]); setStorageError(null); return; }
    listAttachments(transactionId)
      .then((rows) => { setSaved(rows); setStorageError(null); })
      .catch((e) => {
        if (isMissingTableError(e)) setStorageError("missing-table");
      });
  }, [transactionId]);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const arr = Array.from(files);
    if (!transactionId) {
      onPendingChange([...pendingFiles, ...arr]);
      return;
    }
    setUploading(true);
    for (const f of arr) {
      try {
        const att = await uploadAttachment(transactionId, f);
        if (att) setSaved((s) => [att, ...s]);
      } catch (e) {
        if (isMissingTableError(e)) {
          setStorageError("missing-table");
          toast.error("Stockage non configuré : exécutez la migration add_attachments.sql");
        } else {
          toast.error(e instanceof Error ? e.message : "Échec de l'envoi");
        }
      }
    }
    setUploading(false);
  };

  const handleRemoveSaved = async (att: Attachment) => {
    try {
      await deleteAttachment(att);
      setSaved((s) => s.filter((a) => a.id !== att.id));
    } catch {
      toast.error("Suppression impossible");
    }
  };

  const handleOpen = async (att: Attachment) => {
    const url = await getAttachmentUrl(att);
    if (url) window.open(url, "_blank", "noopener");
    else toast.error("Aperçu indisponible");
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <Paperclip className="w-4 h-4 text-text-muted" />
        <label className="text-xs font-medium text-text-muted uppercase tracking-wider">Justificatifs</label>
      </div>

      {storageError === "missing-table" && (
        <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2.5 text-[11px] text-amber-400">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-px" />
          <span>Stockage des justificatifs non configuré : exécutez la migration <code className="font-mono">add_attachments.sql</code> dans Supabase, puis rouvrez ce formulaire.</span>
        </div>
      )}

      {saved.length > 0 && (
        <div className="space-y-1.5">
          {saved.map((att) => (
            <div key={att.id} className="flex items-center gap-2 bg-surface-2 border border-surface-4 rounded-xl px-3 py-2">
              {att.mime_type && isImage(att.mime_type) ? (
                <FileText className="w-4 h-4 text-text-muted shrink-0" />
              ) : (
                <FileText className="w-4 h-4 text-text-muted shrink-0" />
              )}
              <span className="flex-1 text-xs truncate">{att.file_name}</span>
              <button type="button" onClick={() => handleOpen(att)} className="p-1 text-text-muted hover:text-brand-400">
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
              <button type="button" onClick={() => handleRemoveSaved(att)} className="p-1 text-text-muted hover:text-rose-400">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {pendingFiles.length > 0 && (
        <div className="space-y-1.5">
          {pendingFiles.map((f, i) => (
            <div key={i} className="flex items-center gap-2 bg-brand-500/5 border border-brand-500/20 rounded-xl px-3 py-2">
              <FileText className="w-4 h-4 text-brand-400 shrink-0" />
              <span className="flex-1 text-xs truncate">{f.name}</span>
              <button
                type="button"
                onClick={() => onPendingChange(pendingFiles.filter((_, j) => j !== i))}
                className="p-1 text-text-muted hover:text-rose-400"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <label className="flex items-center justify-center gap-2 border-2 border-dashed border-surface-4 hover:border-brand-500/50 rounded-xl px-3 py-2.5 text-xs text-text-muted hover:text-text-secondary cursor-pointer transition-colors">
        {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
        {uploading ? "Envoi en cours..." : "Ajouter un reçu, une facture... (max 10 Mo)"}
        <input
          type="file"
          multiple
          accept="image/*,.pdf"
          className="hidden"
          onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }}
        />
      </label>
    </div>
  );
}
