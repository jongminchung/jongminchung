import { LayerProvider } from "@astryxdesign/core/Layer";
import { Theme } from "@astryxdesign/core/theme";
import { neutralTheme } from "@astryxdesign/theme-neutral/built";
import type { ReactNode } from "react";
import { useAppearance } from "./AppearanceProvider";

export function GitClientTheme({ children }: { readonly children: ReactNode }): ReactNode {
  const { colorScheme } = useAppearance();

  return (
    <Theme mode={colorScheme} theme={neutralTheme}>
      <LayerProvider toast={{ position: "bottomEnd", maxVisible: 3 }}>{children}</LayerProvider>
    </Theme>
  );
}
