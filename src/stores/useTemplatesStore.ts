import { create } from "zustand";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { useProjectsStore } from "./useProjectsStore";
import { useTimeStore } from "./useTimeStore";
import { templateMilestones } from "@/lib/utils/missionMetrics";
import type { MissionTemplate, Project } from "@/types";

type TemplateInput = Pick<MissionTemplate, "name" | "billing_mode" | "tasks" | "milestones">;

interface TemplatesState {
  templates: MissionTemplate[];
  loaded: boolean;
  schemaError: boolean;
  fetch: () => Promise<void>;
  add: (t: TemplateInput) => Promise<MissionTemplate | null>;
  remove: (id: string) => Promise<void>;
  /** Crée les tâches et jalons du modèle sur une mission. */
  apply: (t: MissionTemplate, project: Project, amount: number | null) => Promise<void>;
  /** Enregistre les tâches et jalons d'une mission comme modèle (dates relatives au début). */
  saveFromProject: (project: Project, name: string) => Promise<MissionTemplate | null>;
}

export const useTemplatesStore = create<TemplatesState>((set, get) => ({
  templates: [],
  loaded: false,
  schemaError: false,

  fetch: async () => {
    const { data, error } = await supabase.from("mission_templates").select("*").order("name", { ascending: true });
    set({
      templates: (data as MissionTemplate[]) || [],
      loaded: true,
      schemaError: (error as { code?: string } | null)?.code === "PGRST205",
    });
  },

  add: async (t) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data, error } = await supabase
      .from("mission_templates")
      .insert({ ...t, user_id: user.id })
      .select()
      .single();
    if (error || !data) {
      toast.error((error as { code?: string } | null)?.code === "PGRST205"
        ? "Modèles indisponibles : exécutez la migration add_clients_quotes.sql"
        : "Enregistrement du modèle impossible");
      return null;
    }
    set((s) => ({ templates: [...s.templates, data as MissionTemplate].sort((a, b) => a.name.localeCompare(b.name)) }));
    return data as MissionTemplate;
  },

  remove: async (id) => {
    await supabase.from("mission_templates").delete().eq("id", id);
    set((s) => ({ templates: s.templates.filter((t) => t.id !== id) }));
  },

  apply: async (t, project, amount) => {
    const { addTask } = useTimeStore.getState();
    const { addMilestone } = useProjectsStore.getState();
    for (const task of t.tasks) await addTask(project.id, task.title, task.estimated_minutes);
    const start = project.start_date || new Date().toISOString().slice(0, 10);
    for (const m of templateMilestones(t, start, amount)) {
      await addMilestone({ project_id: project.id, ...m, done: false, done_at: null, notes: null });
    }
  },

  saveFromProject: async (project, name) => {
    const tasks = useTimeStore.getState().tasks.filter((t) => t.project_id === project.id);
    const milestones = useProjectsStore.getState().milestones.filter((m) => m.project_id === project.id);
    const start = project.start_date ? Date.parse(project.start_date) : null;
    const amount = project.total_amount != null ? Number(project.total_amount) : null;
    return get().add({
      name,
      billing_mode: project.billing_mode ?? null,
      tasks: tasks.map((t) => ({ title: t.title, estimated_minutes: t.estimated_minutes })),
      milestones: milestones.map((m) => ({
        title: m.title,
        kind: m.kind,
        offset_days: start != null && m.due_date ? Math.round((Date.parse(m.due_date) - start) / 86400000) : null,
        amount_percent: amount && m.amount != null ? Math.round((Number(m.amount) / amount) * 10000) / 100 : null,
      })),
    });
  },
}));
