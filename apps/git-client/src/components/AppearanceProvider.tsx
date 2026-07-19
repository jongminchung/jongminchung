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
  resolveAppearance,
  type AppearanceMode,
  type ColorScheme,
} from "../domain/appearance";

interface AppearanceContextValue {
  readonly mode: AppearanceMode;
  readonly colorScheme: ColorScheme;
  readonly setMode: (mode: AppearanceMode) => void;
}

const AppearanceContext = createContext<AppearanceContextValue | null>(null);

export function AppearanceProvider({ children }: { readonly children: ReactNode }) {
  const mediaQuery = useMemo(() => window.matchMedia("(prefers-color-scheme: dark)"), []);
  const storage = useMemo(() => AppearanceStorage.of(window.localStorage), []);
  const [mode, setModeState] = useState<AppearanceMode>(() => storage.load());
  const [systemDark, setSystemDark] = useState(mediaQuery.matches);
  const colorScheme = resolveAppearance(mode, systemDark);

  useEffect(() => {
    if (mode !== "system") return;
    setSystemDark(mediaQuery.matches);
    const update = (event: MediaQueryListEvent): void => setSystemDark(event.matches);
    mediaQuery.addEventListener("change", update);
    return () => mediaQuery.removeEventListener("change", update);
  }, [mediaQuery, mode]);

  const setMode = useCallback(
    (nextMode: AppearanceMode): void => {
      storage.save(nextMode);
      setModeState(nextMode);
    },
    [storage],
  );

  const value = useMemo<AppearanceContextValue>(
    () => ({ mode, colorScheme, setMode }),
    [colorScheme, mode, setMode],
  );

  useEffect(() => {
    document.documentElement.dataset.appearanceMode = mode;
  }, [mode]);

  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}

export function useAppearance(): AppearanceContextValue {
  const value = useContext(AppearanceContext);
  if (!value) throw new Error("useAppearance must be used inside AppearanceProvider");
  return value;
}
