import { create } from "zustand";

export interface Toast {
  id: string;
  type: "success" | "error" | "info";
  msg: string;
}

interface ToastState {
  toasts: Toast[];
  addToast: (type: Toast["type"], msg: string) => void;
  removeToast: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  addToast: (type, msg) => {
    const id = Date.now().toString() + Math.random().toString(36).slice(2);
    set(state => ({ toasts: [...state.toasts, { id, type, msg }] }));
    setTimeout(() => {
      set(state => ({ toasts: state.toasts.filter(t => t.id !== id) }));
    }, 5000);
  },
  removeToast: (id) => set(state => ({ toasts: state.toasts.filter(t => t.id !== id) })),
}));
