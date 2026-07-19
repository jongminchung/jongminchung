import { Button } from "@astryxdesign/core/Button";
import { Popover } from "@astryxdesign/core/Popover";
import { RadioList, RadioListItem } from "@astryxdesign/core/RadioList";
import { useEffect, useMemo, useRef, useState } from "react";
import type { AppearanceMode } from "../domain/appearance";
import { useAppearance } from "./AppearanceProvider";
import { useDismissLayer } from "./CommandProvider";
import { Icon } from "./Icon";

const APPEARANCE_OPTIONS = [
  { mode: "system", label: "System Appearance", icon: "appearance" },
  { mode: "light", label: "Islands Light", icon: "sun" },
  { mode: "dark", label: "Islands Dark", icon: "moon" },
  { mode: "darcula", label: "Darcula", icon: "moon" },
  { mode: "highContrast", label: "High Contrast", icon: "appearance" },
] as const satisfies readonly {
  readonly mode: AppearanceMode;
  readonly label: string;
  readonly icon: "appearance" | "sun" | "moon";
}[];

export function AppearanceMenu(): React.ReactNode {
  const { mode, setMode } = useAppearance();
  const [isOpen, setOpen] = useState(false);
  const options = useRef<HTMLDivElement>(null);
  const selected = APPEARANCE_OPTIONS.find((option) => option.mode === mode);
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
    setMode(option.mode);
    setOpen(false);
  };

  useEffect(() => {
    if (!isOpen) return;
    const frame = requestAnimationFrame(() => {
      options.current?.querySelector<HTMLInputElement>('input[type="radio"]:checked')?.focus();
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
              if (event.key === "Enter" && event.target instanceof HTMLInputElement && event.target.type === "radio") {
                select(event.target.value);
                event.preventDefault();
                return;
              }
              if (event.key !== "Home" && event.key !== "End") return;
              const radios = options.current?.querySelectorAll<HTMLInputElement>('input[type="radio"]:not(:disabled)');
              const target = event.key === "Home" ? radios?.item(0) : radios?.item((radios?.length ?? 1) - 1);
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
              value={mode}
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
          label={`Appearance: ${selected?.label ?? "System Appearance"}`}
          size="sm"
          tooltip="Appearance"
          variant="ghost"
        />
      </Popover>
    </div>
  );
}
