import { Button } from "@jongminchung/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@jongminchung/ui/components/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@jongminchung/ui/components/tooltip";
import { useMemo, useState } from "react";
import type { AppearancePreference, AppearanceTheme } from "../domain/appearance";
import { useAppearance } from "./AppearanceProvider";
import { useDismissLayer } from "./CommandProvider";
import { Icon } from "./Icon";

const APPEARANCE_OPTIONS = [
  { mode: "system", label: "Sync with OS", icon: "appearance" },
  { mode: "light", label: "Islands Light", icon: "sun" },
  { mode: "dark", label: "Islands Dark", icon: "moon" },
] as const satisfies readonly {
  readonly mode: AppearanceTheme | "system";
  readonly label: string;
  readonly icon: "appearance" | "sun" | "moon";
}[];

export function AppearanceMenu(): React.ReactNode {
  const { preference, setPreference } = useAppearance();
  const [isOpen, setOpen] = useState(false);
  const selection = preference.syncWithOs ? "system" : preference.theme;
  const selected = APPEARANCE_OPTIONS.find((option) => option.mode === selection);
  const close = (): void => setOpen(false);

  useDismissLayer(
    useMemo(
      () => ({
        id: "appearance-menu",
        priority: 110,
        active: isOpen,
        dismiss: close,
      }),
      [isOpen],
    ),
  );

  const select = (value: string): void => {
    const option = APPEARANCE_OPTIONS.find((candidate) => candidate.mode === value);
    if (!option) return;
    const nextPreference: AppearancePreference =
      option.mode === "system"
        ? { ...preference, syncWithOs: true }
        : { theme: option.mode, syncWithOs: false };
    setPreference(nextPreference);
    setOpen(false);
  };

  return (
    <div className="self-center">
      <Tooltip>
        <DropdownMenu
          onOpenChange={(open) => {
            setOpen(open);
          }}
          open={isOpen}
        >
          <TooltipTrigger
            render={
              <DropdownMenuTrigger
                render={
                  <Button
                    aria-label={`Appearance: ${selected?.label ?? "Sync with OS"}`}
                    className="aspect-square h-7 px-0"
                    size="icon-sm"
                    type="button"
                    variant="ghost"
                  >
                    <Icon name={selected?.icon ?? "appearance"} size={14} />
                  </Button>
                }
              />
            }
          />
          <DropdownMenuContent
            align="end"
            aria-label="Appearance"
            className="z-[110] w-60 border border-border"
          >
            <DropdownMenuRadioGroup onValueChange={select} value={selection}>
              {APPEARANCE_OPTIONS.map((option) => (
                <DropdownMenuRadioItem
                  className="grid min-h-8 grid-cols-[18px_minmax(0,1fr)] gap-2 px-2 text-xs data-checked:bg-primary data-checked:text-primary-foreground data-highlighted:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
                  key={option.mode}
                  value={option.mode}
                >
                  <Icon name={option.icon} size={14} />
                  <span className="truncate">{option.label}</span>
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        <TooltipContent>Appearance</TooltipContent>
      </Tooltip>
    </div>
  );
}
