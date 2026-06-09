import { create } from 'zustand';
import { getMe, login as apiLogin, logout as apiLogout, register as apiRegister } from '../api/auth';
import type { UserProfile } from '../api/auth';
import { getAccessToken } from '../api/client';

interface AuthState {
  user: UserProfile | null;
  loading: boolean;
  initialized: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string, password2: string) => Promise<void>;
  logout: () => Promise<void>;
  init: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: false,
  initialized: false,

  init: async () => {
    if (!getAccessToken()) {
      set({ initialized: true });
      return;
    }
    try {
      const user = await getMe();
      set({ user, initialized: true });
    } catch {
      set({ user: null, initialized: true });
    }
  },

  login: async (username, password) => {
    set({ loading: true });
    try {
      await apiLogin(username, password);
      const user = await getMe();
      set({ user, loading: false });
    } catch (err) {
      set({ loading: false });
      throw err;
    }
  },

  register: async (username, email, password, password2) => {
    set({ loading: true });
    try {
      await apiRegister(username, email, password, password2);
      set({ loading: false });
    } catch (err) {
      set({ loading: false });
      throw err;
    }
  },

  logout: async () => {
    await apiLogout();
    set({ user: null });
  },
}));
