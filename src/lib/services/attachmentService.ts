import { supabase } from "@/lib/supabase";
import type { Attachment } from "@/types";

const BUCKET = "receipts";
const MAX_SIZE = 10 * 1024 * 1024; // 10 Mo

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100);
}

export async function listAttachments(transactionId: string): Promise<Attachment[]> {
  const { data, error } = await supabase
    .from("attachments")
    .select("*")
    .eq("transaction_id", transactionId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as Attachment[]) || [];
}

/** Compte les justificatifs pour un lot de transactions en une seule requête. */
export async function getAttachmentCounts(transactionIds: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (transactionIds.length === 0) return counts;
  const { data, error } = await supabase
    .from("attachments")
    .select("transaction_id")
    .in("transaction_id", transactionIds);
  if (error) throw error;
  for (const row of (data as Array<{ transaction_id: string }>) || []) {
    counts.set(row.transaction_id, (counts.get(row.transaction_id) || 0) + 1);
  }
  return counts;
}

/** Vrai si la table `attachments` est absente (migration non exécutée). */
export function isMissingTableError(e: unknown): boolean {
  return (
    typeof e === "object" && e !== null &&
    "code" in e && (e as { code: string }).code === "PGRST205"
  );
}

export async function uploadAttachment(transactionId: string, file: File): Promise<Attachment | null> {
  if (file.size > MAX_SIZE) throw new Error("Fichier trop volumineux (max 10 Mo)");

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Non authentifié");

  const path = `${user.id}/${transactionId}/${Date.now()}_${sanitizeFileName(file.name)}`;

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type || "application/octet-stream",
  });
  if (uploadError) throw uploadError;

  const { data, error: dbError } = await supabase
    .from("attachments")
    .insert({
      user_id: user.id,
      transaction_id: transactionId,
      file_path: path,
      file_name: file.name,
      mime_type: file.type || null,
      size_bytes: file.size,
    })
    .select()
    .single();
  if (dbError) {
    await supabase.storage.from(BUCKET).remove([path]).catch(() => {});
    throw dbError;
  }
  return data as Attachment;
}

export async function deleteAttachment(att: Attachment): Promise<void> {
  await supabase.storage.from(BUCKET).remove([att.file_path]).catch(() => {});
  await supabase.from("attachments").delete().eq("id", att.id);
}

export async function getAttachmentUrl(att: Attachment): Promise<string | null> {
  // TTL court (15 min) : limite la fenêtre d'exposition en cas de fuite d'URL
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(att.file_path, 900);
  return data?.signedUrl || null;
}

export function isImage(mime: string | null): boolean {
  return !!mime?.startsWith("image/");
}
