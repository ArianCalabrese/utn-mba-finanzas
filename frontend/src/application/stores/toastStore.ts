import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'info';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastStore {
  toasts: Toast[];
  toast: (message: string, type?: ToastType) => void;
  dismiss: (id: string) => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  toast: (message, type = 'info') => {
    const id = crypto.randomUUID();
    set(s => ({ toasts: [...s.toasts, { id, message, type }] }));
    setTimeout(
      () => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })),
      type === 'error' ? 5000 : 3500,
    );
  },
  dismiss: (id) => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })),
}));

export function useToast() {
  const { toast } = useToastStore();
  return {
    success: (msg: string) => toast(msg, 'success'),
    error:   (msg: string) => toast(msg, 'error'),
    info:    (msg: string) => toast(msg, 'info'),
  };
}
