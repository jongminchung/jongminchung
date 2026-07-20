import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  AppearanceStorage,
  synchronizeAppearancePreference,
  type AppearancePreference,
  type AppearanceTheme,
  type ColorScheme,
} from "../domain/appearance";

interface AppearanceContextValue {
  readonly preference: AppearancePreference;
  readonly colorScheme: ColorScheme;
  readonly systemTheme: AppearanceTheme;
  readonly setPreference: (preference: AppearancePreference) => void;
}

const AppearanceContext = createContext<AppearanceContextValue | null>(null);

export function AppearanceProvider({ children }: { readonly children: ReactNode }) {
  const mediaQuery = useMemo(() => window.matchMedia("(prefers-color-scheme: dark)"), []);
  const storage = useMemo(() => AppearanceStorage.of(window.localStorage), []);
  const [preference, setPreferenceState] = useState<AppearancePreference>(() =>
    synchronizeAppearancePreference(storage.load(), mediaQuery.matches ? "dark" : "light"),
  );
  const [systemDark, setSystemDark] = useState(mediaQuery.matches);
  const systemTheme: AppearanceTheme = systemDark ? "dark" : "light";
  const colorScheme = preference.theme;

  useEffect(() => {
    const update = (event: MediaQueryListEvent): void => {
      const nextSystemTheme = event.matches ? "dark" : "light";
      setSystemDark(event.matches);
      setPreferenceState((current) => synchronizeAppearancePreference(current, nextSystemTheme));
    };
    mediaQuery.addEventListener("change", update);
    return () => mediaQuery.removeEventListener("change", update);
  }, [mediaQuery]);

  const setPreference = useCallback(
    (nextPreference: AppearancePreference): void => {
      setPreferenceState(
        synchronizeAppearancePreference(nextPreference, mediaQuery.matches ? "dark" : "light"),
      );
    },
    [mediaQuery],
  );

  useEffect(() => storage.save(preference), [preference, storage]);

  const value = useMemo<AppearanceContextValue>(
    () => ({ preference, colorScheme, systemTheme, setPreference }),
    [colorScheme, preference, setPreference, systemTheme],
  );

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.appearanceMode = preference.syncWithOs ? "system" : preference.theme;
    root.dataset.theme = colorScheme;
    root.style.colorScheme = colorScheme;
  }, [colorScheme, preference]);

  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}

export function useAppearance(): AppearanceContextValue {
  const value = useContext(AppearanceContext);
  if (!value) throw new Error("useAppearance must be used inside AppearanceProvider");
  return value;
}
