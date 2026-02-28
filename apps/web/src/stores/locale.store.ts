import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AppLocale = 'ru' | 'en' | 'tr';

const STORAGE_KEY = 'ymir-locale';

export function normalizeLocale(locale?: string | null): AppLocale {
  const value = (locale || '').toLowerCase();

  if (value.startsWith('en')) return 'en';
  if (value.startsWith('tr')) return 'tr';
  if (value.startsWith('ru') || value.startsWith('kz') || value.startsWith('kk')) return 'ru';

  return 'ru';
}

function applyLocaleToDocument(locale: AppLocale) {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = locale;
}

interface LocaleState {
  locale: AppLocale;
  setLocale: (locale: string) => void;
}

export const useLocaleStore = create<LocaleState>()(
  persist(
    (set) => ({
      locale: 'ru',
      setLocale: (locale: string) => {
        const normalized = normalizeLocale(locale);
        applyLocaleToDocument(normalized);
        set({ locale: normalized });
      },
    }),
    {
      name: STORAGE_KEY,
      onRehydrateStorage: () => (state) => {
        if (state?.locale) {
          applyLocaleToDocument(state.locale);
        }
      },
    },
  ),
);

