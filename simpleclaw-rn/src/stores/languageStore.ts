import { create } from 'zustand';
import i18n from '../i18n';
import {
  getItem,
  setItem,
} from '../services/secureStorage';

const LANG_KEY = 'app_language';

interface LanguageState {
  language: string;
  setLanguage: (lang: string) => void;
  init: () => Promise<void>;
}

export const useLanguageStore = create<LanguageState>((set) => ({
  language: i18n.language,

  setLanguage: (lang) => {
    i18n.changeLanguage(lang);
    set({ language: lang });
    setItem(LANG_KEY, lang).catch(() => {});
  },

  init: async () => {
    const saved = await getItem(LANG_KEY);
    if (saved && (saved === 'en' || saved === 'ru')) {
      i18n.changeLanguage(saved);
      set({ language: saved });
    }
  },
}));
