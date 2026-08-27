"use client";

import {
  ThemeProvider as NextThemeProvider,
  useTheme as useNextTheme,
} from "next-themes";
import type { ReactNode } from "react";
import { isThemeMode, type ThemeMode } from "#lib/theme";

interface ThemeContextValue {
  readonly mode: ThemeMode;
  readonly setMode: (mode: ThemeMode) => void;
}

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
  const mode = theme ?? null;
  return {
    mode: isThemeMode(mode) ? mode : "system",
    setMode: setTheme,
  };
}
