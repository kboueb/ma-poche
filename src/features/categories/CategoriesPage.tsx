import { useEffect, useState } from "react";
import { useCategoriesStore } from "@/stores/useCategoriesStore";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Plus, Trash2, Tag, Sparkles, Edit2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { seedDefaultCategories } from "@/lib/seed";
import { useAuthStore } from "@/stores/useAuthStore";
import { toast } from "sonner";
import type { Category } from "@/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonCards } from "@/components/ui/Skeleton";
import AppIcon from "@/components/ui/AppIcon";
import IconPicker from "@/components/ui/IconPicker";

export default function CategoriesPage() {
  const { categories, loading, fetch, remove, update } = useCategoriesStore();
  const { user } = useAuthStore();
  const [formOpen, setFormOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("package");
  const [color, setColor] = useState("#6366f1");
  const [flow, setFlow] = useState<"income" | "expense" | "both">("expense");
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetch(); }, [fetch]);

  const resetForm = () => {
    setName(""); setIcon("package"); setColor("#6366f1"); setFlow("expense");
  };

  const addCategory = async () => {
    if (!name || !user) return;
    setSaving(true);
    await supabase.from("categories").insert({
      user_id: user.id,
      name,
      icon,
      color,
      flow,
    });
    await fetch();
    setSaving(false);
    setFormOpen(false);
    resetForm();
  };

  const handleEdit = async () => {
    if (!name || !editingCat) return;
    setSaving(true);
    await update(editingCat.id, { name, icon, color, flow });
    setSaving(false);
    setFormOpen(false);
    setEditingCat(null);
    resetForm();
    toast.success("Catégorie mise à jour");
  };

  const openEdit = (cat: Category) => {
    setEditingCat(cat);
    setName(cat.name);
    setIcon(cat.icon);
    setColor(cat.color);
    setFlow(cat.flow);
    setFormOpen(true);
  };

  const openCreate = () => {
    setEditingCat(null);
    resetForm();
    setFormOpen(true);
  };

  const reseed = async () => {
    if (!user) return;
    await seedDefaultCategories(user.id);
    await fetch();
    toast.success("Catégories restaurées");
  };

  const cleanDuplicates = async () => {
    if (!user) return;
    setSaving(true);
    
    // Group by name
    const seen = new Set<string>();
    const toDelete: string[] = [];
    
    // Sort to keep the oldest ones (by assuming ID order or fetching created_at)
    const { data } = await supabase.from("categories").select("id, name").eq("user_id", user.id);
    
    if (data) {
      data.forEach(cat => {
        if (seen.has(cat.name)) {
          toDelete.push(cat.id);
        } else {
          seen.add(cat.name);
        }
      });
    }

    if (toDelete.length > 0) {
      await supabase.from("categories").delete().in("id", toDelete);
      toast.success(`${toDelete.length} doublons supprimés`);
      await fetch();
    } else {
      toast.info("Aucun doublon trouvé");
    }
    setSaving(false);
  };

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-6">
      <PageHeader
        title="Catégories"
        subtitle={`${categories.length} catégories configurées`}
        actions={
          <>
            <Button variant="secondary" onClick={cleanDuplicates} icon={<Sparkles className="w-4 h-4" />}>Nettoyer doublons</Button>
            <Button variant="secondary" onClick={reseed}>Restaurer défauts</Button>
            <Button icon={<Plus className="w-4 h-4" />} onClick={openCreate}>Nouvelle</Button>
          </>
        }
      />

      {loading ? (
        <SkeletonCards count={6} cardClass="h-20" />
      ) : categories.length === 0 ? (
        <EmptyState
          icon={<Tag className="w-12 h-12" />}
          title="Aucune catégorie trouvée"
          actionLabel="Générer les catégories par défaut"
          onAction={reseed}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {categories.map((c) => (
            <div key={c.id} className="bg-surface-1 border border-surface-3 rounded-2xl p-4 flex items-center justify-between group">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${c.color}20`, color: c.color }}>
                  <AppIcon icon={c.icon} className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{c.name}</p>
                  <p className="text-[10px] text-text-muted uppercase tracking-wider">
                    {c.flow === "income" ? "Revenu" : c.flow === "expense" ? "Dépense" : "Mixte"}
                  </p>
                </div>
              </div>
              <button onClick={() => openEdit(c)} className="p-2 text-text-muted hover:text-brand-400 md:opacity-0 md:group-hover:opacity-100 transition-all">
                <Edit2 className="w-4 h-4" />
              </button>
              <button onClick={() => { remove(c.id); toast.success("Catégorie supprimée"); }} className="p-2 text-text-muted hover:text-rose-400 md:opacity-0 md:group-hover:opacity-100 transition-all">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={formOpen} onClose={() => { setFormOpen(false); setEditingCat(null); }} title={editingCat ? "Modifier la catégorie" : "Nouvelle catégorie"} size="sm">
        <div className="space-y-4">
          <Input label="Nom" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Restaurant, Cinéma..." />
          <div className="grid grid-cols-2 gap-4 items-end">
            <div className="col-span-2 sm:col-span-1"><IconPicker value={icon} onChange={setIcon} color={color} /></div>
            <Input label="Couleur" type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-10 p-1" />
          </div>
          <Select 
            label="Type de flux" 
            options={[
              { value: "expense", label: "Dépense" },
              { value: "income", label: "Revenu" },
              { value: "both", label: "Les deux" }
            ]} 
            value={flow} 
            onChange={(e) => setFlow(e.target.value as "income" | "expense" | "both")} 
          />
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" className="flex-1" onClick={() => { setFormOpen(false); setEditingCat(null); }}>Annuler</Button>
            <Button className="flex-1" loading={saving} onClick={editingCat ? handleEdit : addCategory}>{editingCat ? "Mettre à jour" : "Créer"}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
