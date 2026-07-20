import { useEffect, useMemo, useRef, useState } from "react";
import type { AppearancePreference, AppearanceTheme } from "../domain/appearance";
import { useAppearance } from "./AppearanceProvider";
import { useDismissLayer } from "./CommandProvider";
import { Icon } from "./Icon";
import { Button } from "./ui";
import { Popover } from "./ui";
import { RadioList, RadioListItem } from "./ui";

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
  const options = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    if (!isOpen) return;
    const frame = requestAnimationFrame(() => {
      options.current?.querySelector<HTMLElement>('[role="radio"][aria-checked="true"]')?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [isOpen]);

  return (
    <div className="self-center">
      <Popover
        alignment="end"
        hasAutoFocus
        isOpen={isOpen}
        label="Appearance"
        onOpenChange={setOpen}
        placement="below"
        width={240}
        content={
          <div
            onKeyDown={(event) => {
              const radios = options.current?.querySelectorAll<HTMLElement>('[role="radio"]');
              const radio =
                event.target instanceof HTMLElement
                  ? event.target.closest<HTMLElement>('[role="radio"]')
                  : null;
              if (event.key === "Enter" && radio !== null) {
                const index = [...(radios ?? [])].indexOf(radio);
                const mode = APPEARANCE_OPTIONS[index]?.mode;
                if (mode !== undefined) select(mode);
                event.preventDefault();
                return;
              }
              if (event.key !== "Home" && event.key !== "End") return;
              const target =
                event.key === "Home" ? radios?.item(0) : radios?.item((radios?.length ?? 1) - 1);
              target?.focus();
              event.preventDefault();
            }}
            ref={options}
          >
            <RadioList
              isLabelHidden
              label="Appearance"
              onChange={select}
              size="sm"
              value={selection}
            >
              {APPEARANCE_OPTIONS.map((option) => (
                <RadioListItem
                  key={option.mode}
                  label={option.label}
                  startContent={<Icon name={option.icon} size={14} />}
                  value={option.mode}
                />
              ))}
            </RadioList>
          </div>
        }
      >
        <Button
          icon={<Icon name={selected?.icon ?? "appearance"} size={14} />}
          isIconOnly
          label={`Appearance: ${selected?.label ?? "Sync with OS"}`}
          size="sm"
          tooltip="Appearance"
          variant="ghost"
        />
      </Popover>
    </div>
  );
}
