import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '@/lib/api';

interface Profile {
  id: string;
  nickname: string;
  displayName: string | null;
  bm: number;
  level: number;
  avatarUrl: string | null;
  locale: string;
}

interface ClanMembership {
  id: string;
  clanId: string;
  role: string;
  clan: { id: string; name: string; tag: string };
}

interface DkpWallet {
  id: string;
  balance: number;
  onHold: number;
  totalEarned: number;
}

interface User {
  id: string;
  email: string;
  globalRole: string;
  emailVerified: boolean;
  profile: Profile | null;
  clanMembership: ClanMembership | null;
  dkpWallet: DkpWallet | null;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  setTokens: (accessToken: string, refreshToken: string) => void;
  setUser: (user: User) => void;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { email: string; password: string; nickname: string; displayName?: string }) => Promise<void>;
  logout: () => void;
  fetchMe: () => Promise<void>;

  isAdmin: () => boolean;
  isClanLeader: () => boolean;
  isElder: () => boolean;
  canManageClan: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,

      setTokens: (accessToken: string, refreshToken: string) => {
        set({ accessToken, refreshToken, isAuthenticated: true });
      },

      setUser: (user: User) => {
        set({ user });
      },

      login: async (email: string, password: string) => {
        set({ isLoading: true });
        try {
          const { data } = await api.post('/auth/login', { email, password });
          set({
            user: data.user,
            accessToken: data.accessToken,
            refreshToken: data.refreshToken,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      register: async (regData: { email: string; password: string; nickname: string; displayName?: string }) => {
        set({ isLoading: true });
        try {
          await api.post('/auth/register', regData);
          set({ isLoading: false });
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      logout: () => {
        const rt = get().refreshToken;
        if (rt) {
          api.post('/auth/logout', { refreshToken: rt }).catch(() => {});
        }
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
        });
      },

      fetchMe: async () => {
        try {
          const { data } = await api.get('/auth/me');
          set({ user: data, isAuthenticated: true });
        } catch {
          set({ user: null, isAuthenticated: false });
        }
      },

      isAdmin: () => get().user?.globalRole === 'PORTAL_ADMIN',
      isClanLeader: () => get().user?.clanMembership?.role === 'CLAN_LEADER',
      isElder: () => {
        const role = get().user?.clanMembership?.role;
        return role === 'CLAN_LEADER' || role === 'ELDER';
      },
      canManageClan: () => {
        const role = get().user?.clanMembership?.role;
        return role === 'CLAN_LEADER' || role === 'ELDER';
      },
    }),
    {
      name: 'ymir-auth',
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
);
