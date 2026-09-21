import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { SupportedLanguage } from '@/constants/app';

export type ThemePreference = 'dark' | 'light' | 'system';

type SettingsState = {
  hydrated: boolean;
  languagePreference: SupportedLanguage;
  prefersReducedMotion: boolean;
  themePreference: ThemePreference;
  hydrate: () => Promise<void>;
  setLanguagePreference: (language: SupportedLanguage) => void;
  setPrefersReducedMotion: (value: boolean) => void;
  setThemePreference: (value: ThemePreference) => void;
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, _get, store) => ({
      hydrate: async () => {
        await store.persist.rehydrate();
        set({ hydrated: true });
      },
      hydrated: false,
      languagePreference: 'en',
      prefersReducedMotion: false,
      setLanguagePreference: (languagePreference) => set({ languagePreference }),
      setPrefersReducedMotion: (prefersReducedMotion) => set({ prefersReducedMotion }),
      setThemePreference: (themePreference) => set({ themePreference }),
      // New installs always start in light mode. Existing users keep their persisted choice.
      themePreference: 'light',
    }),
    {
      name: 'app.settings',
      partialize: (state) => ({
        languagePreference: state.languagePreference,
        prefersReducedMotion: state.prefersReducedMotion,
        themePreference: state.themePreference,
      }),
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
