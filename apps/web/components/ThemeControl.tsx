"use client";

import { Button } from "@jongminchung/ui/components/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@jongminchung/ui/components/tooltip";
import type { ThemeMode } from "#lib/theme";
import { Icon, type IconType } from "./Icon";
import { DarkThemeIcon, LightThemeIcon, SystemThemeIcon } from "./ThemeIcons";
import { useTheme } from "./ThemeProvider";

const nextMode: Readonly<Record<ThemeMode, ThemeMode>> = {
  system: "light",
  light: "dark",
  dark: "system",
};

const modeIcon: Readonly<Record<ThemeMode, IconType>> = {
  system: SystemThemeIcon,
  light: LightThemeIcon,
  dark: DarkThemeIcon,
};

/** `ThemeControl` UI 컴포넌트를 렌더링함 */
export function ThemeControl({
  labelTemplate,
}: {
  readonly labelTemplate: string;
}) {
  const { mode, setMode } = useTheme();
  const label = labelTemplate.replace("{mode}", mode);
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            aria-label={label}
            className="size-11 gap-2 p-0 text-sm"
            onClick={() => setMode(nextMode[mode])}
            type="button"
            variant="ghost"
            size="icon"
          >
            <Icon icon={modeIcon[mode]} />
          </Button>
        }
      />
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
