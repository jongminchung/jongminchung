"use client";

import {
  ThemeProvider as NextThemeProvider,
  useTheme as useNextTheme,
} from "next-themes";
import { useSyncExternalStore, type ReactNode } from "react";
import { isThemeMode, type ThemeMode } from "#lib/theme";

interface ThemeContextValue {
  readonly mode: ThemeMode;
  readonly setMode: (mode: ThemeMode) => void;
}

const subscribeToHydration = () => () => undefined;

/** `ThemeProvider` 사이트별 테마 선택과 시스템 모드를 동기화함 */
export function ThemeProvider({
  storageKey,
  children,
}: {
  readonly storageKey: string;
  readonly children: ReactNode;
}): React.JSX.Element {
  return (
    <NextThemeProvider
      attribute="data-theme"
      defaultTheme="system"
      enableColorScheme
      enableSystem
      storageKey={storageKey}
      themes={["light", "dark"]}
    >
      {children}
    </NextThemeProvider>
  );
}

/** `useTheme` 공용 테마 상태와 제어 함수를 제공함 */
export function useTheme(): ThemeContextValue {
  const { setTheme, theme } = useNextTheme();
  // 서버와 첫 브라우저 렌더는 같은 아이콘을 사용하고, hydration 뒤 저장된 테마를 표시한다.
  const hydrated = useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false,
  );
  const mode = hydrated ? (theme ?? null) : null;
  return {
    mode: isThemeMode(mode) ? mode : "system",
    setMode: setTheme,
  };
}
