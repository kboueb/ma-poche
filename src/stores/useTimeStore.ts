import { create } from "zustand";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import type { Task, TimeEntry } from "@/types";

interface TimeState {
  tasks: Task[];
  entries: TimeEntry[];
  loading: boolean;
  loaded: boolean;
  fetch: () => Promise<void>;
  // Tâches
  addTask: (projectId: string, title: string, estimatedMinutes?: number | null) => Promise<void>;
  updateTask: (id: string, data: Partial<Task>) => Promise<void>;
  removeTask: (id: string) => Promise<void>;
  // Timer (un seul actif à la fois : démarrer stoppe le précédent)
  activeEntry: () => TimeEntry | null;
  startTimer: (taskId: string) => Promise<void>;
  stopTimer: (description?: string) => Promise<void>;
  // Saisie manuelle
  addManualEntry: (e: {
    project_id: string;
    task_id?: string | null;
    description?: string | null;
    date: string; // yyyy-MM-dd
    startTime: string; // HH:mm
    durationMinutes: number;
    billable: boolean;
  }) => Promise<void>;
  removeEntry: (id: string) => Promise<void>;
}

export const useTimeStore = create<TimeState>((set, get) => ({
  tasks: [],
  entries: [],
  loading: false,
  loaded: false,

  fetch: async () => {
    set({ loading: true });
    const [{ data: t }, { data: e }] = await Promise.all([
      supabase.from("tasks").select("*").order("created_at", { ascending: true }),
      supabase
        .from("time_entries")
        .select("*, task:tasks(*)")
        .order("started_at", { ascending: false })
        .limit(1000),
    ]);
    set({
      tasks: (t as Task[]) || [],
      entries: (e as TimeEntry[]) || [],
      loading: false,
      loaded: true,
    });
  },

  addTask: async (projectId, title, estimatedMinutes = null) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error } = await supabase
      .from("tasks")
      .insert({ user_id: user.id, project_id: projectId, title: title.trim(), estimated_minutes: estimatedMinutes })
      .select()
      .single();
    if (error) {
      toast.error("Création de la tâche impossible");
      return;
    }
    if (data) set((s) => ({ tasks: [...s.tasks, data as Task] }));
  },

  updateTask: async (id, data) => {
    await supabase.from("tasks").update(data).eq("id", id);
    set((s) => ({ tasks: s.tasks.map((t) => t.id === id ? { ...t, ...data } : t) }));
  },

  removeTask: async (id) => {
    await supabase.from("tasks").delete().eq("id", id);
    set((s) => ({
      tasks: s.tasks.filter((t) => t.id !== id),
      entries: s.entries.map((e) => e.task_id === id ? { ...e, task_id: null } : e),
    }));
    toast.success("Tâche supprimée (temps conservé)");
  },

  activeEntry: () => {
    return get().entries.find((e) => !e.ended_at) || null;
  },

  startTimer: async (taskId) => {
    const task = get().tasks.find((t) => t.id === taskId);
    if (!task) return;
    // Stoppe le timer en cours éventuel
    const current = get().activeEntry();
    if (current) {
      await get().stopTimer();
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error } = await supabase
      .from("time_entries")
      .insert({
        user_id: user.id,
        task_id: taskId,
        project_id: task.project_id,
        started_at: new Date().toISOString(),
        ended_at: null,
        billable: true,
      })
      .select("*, task:tasks(*)")
      .single();
    if (error) {
      toast.error("Démarrage du timer impossible");
      return;
    }
    if (data) set((s) => ({ entries: [data as TimeEntry, ...s.entries] }));
  },

  stopTimer: async (description) => {
    const current = get().activeEntry();
    if (!current) return;
    const endedAt = new Date().toISOString();
    const minutes = Math.max(Math.round((new Date(endedAt).getTime() - new Date(current.started_at).getTime()) / 60000), 0);
    await supabase
      .from("time_entries")
      .update({
        ended_at: endedAt,
        duration_minutes: minutes,
        ...(description !== undefined ? { description } : {}),
      })
      .eq("id", current.id);
    set((s) => ({
      entries: s.entries.map((e) =>
        e.id === current.id ? { ...e, ended_at: endedAt, duration_minutes: minutes, description: description ?? e.description } : e
      ),
    }));
    toast.success(`Timer arrêté — ${minutes}m enregistrés`);
  },

  addManualEntry: async (e) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const [h, m] = e.startTime.split(":").map(Number);
    const start = new Date(`${e.date}T00:00:00`);
    start.setHours(h || 0, m || 0, 0, 0);
    const end = new Date(start.getTime() + e.durationMinutes * 60000);
    const { data, error } = await supabase
      .from("time_entries")
      .insert({
        user_id: user.id,
        task_id: e.task_id || null,
        project_id: e.project_id,
        description: e.description || null,
        started_at: start.toISOString(),
        ended_at: end.toISOString(),
        duration_minutes: e.durationMinutes,
        billable: e.billable,
      })
      .select("*, task:tasks(*)")
      .single();
    if (error) {
      toast.error("Saisie impossible");
      return;
    }
    if (data) {
      set((s) => ({ entries: [data as TimeEntry, ...s.entries] }));
      toast.success("Temps enregistré");
    }
  },

  removeEntry: async (id) => {
    const current = get().activeEntry();
    if (current?.id === id) {
      toast.error("Stoppe le timer avant de supprimer");
      return;
    }
    await supabase.from("time_entries").delete().eq("id", id);
    set((s) => ({ entries: s.entries.filter((e) => e.id !== id) }));
    toast.success("Entrée supprimée");
  },
}));
