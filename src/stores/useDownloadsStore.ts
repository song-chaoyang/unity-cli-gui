import { create } from "zustand";

export interface DownloadTask {
  id: string;
  title: string;
  eventPrefix: string;
  processId?: number;
  status: "running" | "completed" | "failed" | "cancelled";
  output: string[];
  startTime: number;
  endTime?: number;
}

interface DownloadsState {
  tasks: DownloadTask[];
  addTask: (task: Omit<DownloadTask, "status" | "output" | "startTime">) => void;
  setTaskProcessId: (id: string, processId: number) => void;
  completeTask: (eventPrefix: string, success: boolean, cancelled?: boolean) => void;
  updateTaskOutput: (eventPrefix: string, line: string) => void;
  cancelTask: (id: string) => void;
  clearCompleted: () => void;
}

export const useDownloadsStore = create<DownloadsState>((set, get) => ({
  tasks: [],

  addTask: (task) => {
    const fullTask: DownloadTask = {
      ...task,
      status: "running",
      output: [],
      startTime: Date.now(),
    };
    set(state => ({ tasks: [fullTask, ...state.tasks] }));
  },

  setTaskProcessId: (id: string, processId: number) => {
    set(state => ({
      tasks: state.tasks.map(t => t.id === id ? { ...t, processId } : t),
    }));
  },

  completeTask: (eventPrefix, success, cancelled) => {
    set(state => ({
      tasks: state.tasks.map(t =>
        t.eventPrefix === eventPrefix && t.status === "running"
          ? {
              ...t,
              status: cancelled ? "cancelled" : success ? "completed" : "failed",
              endTime: Date.now(),
            }
          : t
      ),
    }));
  },

  updateTaskOutput: (eventPrefix, line) => {
    set(state => ({
      tasks: state.tasks.map(t =>
        t.eventPrefix === eventPrefix && t.status === "running"
          ? { ...t, output: [...t.output.slice(-99), line] }
          : t
      ),
    }));
  },

  cancelTask: (id) => {
    const task = get().tasks.find(t => t.id === id);
    if (task?.processId !== undefined) {
      import("@/lib/tauri").then(tauri => {
        tauri.cancelProcess(task.processId!).catch(() => {});
      });
    }
  },

  clearCompleted: () => {
    set(state => ({ tasks: state.tasks.filter(t => t.status === "running") }));
  },
}));
