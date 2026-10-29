import { create } from "zustand";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import type { Project, Milestone } from "@/types";

interface ProjectsState {
  projects: Project[];
  milestones: Milestone[];
  loading: boolean;
  schemaError: boolean;
  fetch: () => Promise<void>;
  addProject: (p: Omit<Project, "id" | "user_id" | "created_at">) => Promise<Project | null>;
  updateProject: (id: string, data: Partial<Project>) => Promise<void>;
  removeProject: (id: string) => Promise<void>;
  addMilestone: (m: Omit<Milestone, "id" | "user_id" | "created_at">) => Promise<void>;
  updateMilestone: (id: string, data: Partial<Milestone>) => Promise<void>;
  removeMilestone: (id: string) => Promise<void>;
}

// Colonnes ajoutées par add_clients_quotes.sql : ignorées tant que la migration n'est pas appliquée
const CLIENT_COLUMNS = ["client_id", "billing_mode", "daily_rate", "budget_days", "recurring_monthly"] as const;

function isMissingColumnError(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: string }).code === "PGRST204";
}

function withoutClientColumns<T extends Partial<Project>>(row: T): Partial<Project> {
  const copy: Partial<Project> = { ...row };
  CLIENT_COLUMNS.forEach((c) => delete copy[c]);
  return copy;
}

export const useProjectsStore = create<ProjectsState>((set) => ({
  projects: [],
  milestones: [],
  loading: false,
  schemaError: false,

  fetch: async () => {
    set({ loading: true });
    const [{ data: p, error: pErr }, { data: m }] = await Promise.all([
      supabase.from("projects").select("*").order("created_at", { ascending: false }),
      supabase.from("milestones").select("*").order("due_date", { ascending: true, nullsFirst: false }),
    ]);
    set({
      projects: (p as Project[]) || [],
      milestones: (m as Milestone[]) || [],
      loading: false,
      schemaError: (pErr as { code?: string } | null)?.code === "PGRST205",
    });
  },

  addProject: async (p) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const insert = (row: Partial<Project>) => supabase
      .from("projects")
      .insert({ ...row, user_id: user.id })
      .select()
      .single();
    let { data, error } = await insert(p);
    if (isMissingColumnError(error)) ({ data, error } = await insert(withoutClientColumns(p)));
    if (error) {
      toast.error("Erreur lors de la création du projet");
      return null;
    }
    if (data) set((s) => ({ projects: [data as Project, ...s.projects] }));
    return (data as Project) || null;
  },

  updateProject: async (id, data) => {
    const { error } = await supabase.from("projects").update(data).eq("id", id);
    if (isMissingColumnError(error)) await supabase.from("projects").update(withoutClientColumns(data)).eq("id", id);
    set((s) => ({ projects: s.projects.map((p) => p.id === id ? { ...p, ...data } : p) }));
  },

  removeProject: async (id) => {
    await supabase.from("projects").delete().eq("id", id);
    set((s) => ({
      projects: s.projects.filter((p) => p.id !== id),
      milestones: s.milestones.filter((m) => m.project_id !== id),
    }));
  },

  addMilestone: async (m) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error } = await supabase
      .from("milestones")
      .insert({ ...m, user_id: user.id })
      .select()
      .single();
    if (error) {
      toast.error("Erreur lors de la création du jalon");
      return;
    }
    if (data) set((s) => ({ milestones: [...s.milestones, data as Milestone] }));
  },

  updateMilestone: async (id, data) => {
    await supabase.from("milestones").update(data).eq("id", id);
    set((s) => ({ milestones: s.milestones.map((m) => m.id === id ? { ...m, ...data } : m) }));
  },

  removeMilestone: async (id) => {
    await supabase.from("milestones").delete().eq("id", id);
    set((s) => ({ milestones: s.milestones.filter((m) => m.id !== id) }));
  },
}));
