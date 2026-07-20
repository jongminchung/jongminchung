import { Search } from "lucide-react";
import type { HTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/utils";

interface CommandPaletteInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  readonly value: string;
  readonly onValueChange: (value: string) => void;
  readonly endContent?: ReactNode;
}

export function CommandPaletteInput({
  value,
  onValueChange,
  endContent,
  className,
  ...props
}: CommandPaletteInputProps): ReactNode {
  return (
    <label className="flex h-12 items-center gap-2 border-b border-border px-3">
      <Search aria-hidden className="size-4 text-muted-foreground" />
      <input
        autoFocus
        className={cn(
          "min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground",
          className,
        )}
        onChange={(event) => onValueChange(event.target.value)}
        value={value}
        {...props}
      />
      {endContent}
    </label>
  );
}

export function CommandPaletteList({
  label,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & { readonly label: string }): ReactNode {
  return (
    <div
      aria-label={label}
      className={cn("grid gap-0.5 p-1", className)}
      role="listbox"
      {...props}
    />
  );
}

interface CommandPaletteItemProps extends HTMLAttributes<HTMLDivElement> {
  readonly value: string;
  readonly isDisabled?: boolean;
  readonly isHighlighted?: boolean;
  readonly onSelect?: () => void;
  readonly children: ReactNode;
}

export function CommandPaletteItem({
  value,
  isDisabled = false,
  isHighlighted = false,
  onSelect,
  children,
  className,
  ...props
}: CommandPaletteItemProps): ReactNode {
  return (
    <div
      aria-disabled={isDisabled || undefined}
      aria-selected={isHighlighted}
      className={cn(
        "flex min-h-11 items-center gap-3 rounded-md px-2.5 text-xs outline-none",
        isHighlighted && "bg-accent text-accent-foreground",
        isDisabled && "opacity-45",
        className,
      )}
      data-value={value}
      onClick={isDisabled ? undefined : onSelect}
      role="option"
      {...props}
    >
      {children}
    </div>
  );
}
