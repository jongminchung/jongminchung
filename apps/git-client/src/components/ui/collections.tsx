import { LoaderCircle } from "lucide-react";
import { RadioGroup, Tabs, ToggleGroup } from "radix-ui";
import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/utils";

interface ListProps extends HTMLAttributes<HTMLDivElement> {
  readonly density?: "compact" | "default";
}

export function List({ density = "default", className, ...props }: ListProps): ReactNode {
  return (
    <div
      className={cn("grid min-w-0 gap-0.5", density === "compact" && "text-xs", className)}
      {...props}
    />
  );
}

interface ListItemProps extends Omit<HTMLAttributes<HTMLDivElement>, "onClick"> {
  readonly label: string;
  readonly description?: string;
  readonly startContent?: ReactNode;
  readonly endContent?: ReactNode;
  readonly isSelected?: boolean;
  readonly isDisabled?: boolean;
  readonly onClick?: () => void;
}

export function ListItem({
  label,
  description,
  startContent,
  endContent,
  isSelected = false,
  isDisabled = false,
  onClick,
  className,
  role = "listitem",
  ...props
}: ListItemProps): ReactNode {
  return (
    <div
      aria-disabled={isDisabled || undefined}
      aria-selected={isSelected || undefined}
      className={cn(
        "grid min-h-9 min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-md px-2 py-1 outline-none",
        onClick &&
          !isDisabled &&
          "cursor-default hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/45",
        isSelected && "bg-accent text-accent-foreground",
        isDisabled && "opacity-45",
        className,
      )}
      onClick={isDisabled ? undefined : onClick}
      onKeyDown={(event) => {
        if (onClick === undefined || isDisabled || (event.key !== "Enter" && event.key !== " "))
          return;
        onClick();
        event.preventDefault();
      }}
      role={role}
      tabIndex={onClick && !isDisabled ? 0 : undefined}
      {...props}
    >
      {startContent ? <span className="text-muted-foreground">{startContent}</span> : <span />}
      <span className="grid min-w-0 gap-0.5">
        <strong className="truncate font-medium">{label}</strong>
        {description ? (
          <small className="truncate text-muted-foreground">{description}</small>
        ) : null}
      </span>
      {endContent}
    </div>
  );
}

export function EmptyState({
  title,
  description,
}: {
  readonly title: string;
  readonly description?: string;
}): ReactNode {
  return (
    <div className="grid place-items-center gap-1 px-6 py-10 text-center">
      <strong className="text-sm font-medium">{title}</strong>
      {description ? (
        <p className="m-0 max-w-sm text-xs text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
}

export function Spinner({
  label,
  size = "md",
}: {
  readonly label: string;
  readonly size?: "sm" | "md" | "lg";
}): ReactNode {
  return (
    <span className="inline-flex items-center gap-2 text-xs text-muted-foreground" role="status">
      <LoaderCircle
        aria-hidden
        className={cn(
          "animate-spin",
          size === "sm" ? "size-3" : size === "lg" ? "size-5" : "size-4",
        )}
      />
      {label}
    </span>
  );
}

interface RadioListProps {
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly children: ReactNode;
  readonly isLabelHidden?: boolean;
  readonly size?: "sm" | "md";
}

export function RadioList({
  label,
  value,
  onChange,
  children,
  isLabelHidden = false,
  size = "md",
}: RadioListProps): ReactNode {
  return (
    <fieldset className="m-0 grid gap-1.5 border-0 p-0">
      <legend className={cn("mb-1 text-xs font-medium", isLabelHidden && "sr-only")}>
        {label}
      </legend>
      <RadioGroup.Root
        className={cn("grid", size === "sm" ? "gap-0.5" : "gap-1")}
        onValueChange={onChange}
        value={value}
      >
        {children}
      </RadioGroup.Root>
    </fieldset>
  );
}

export function RadioListItem({
  label,
  value,
  isDisabled = false,
  startContent,
}: {
  readonly label: string;
  readonly value: string;
  readonly isDisabled?: boolean;
  readonly startContent?: ReactNode;
}): ReactNode {
  return (
    <label
      className={cn(
        "flex min-h-7 items-center gap-2 rounded-md px-1.5 text-xs hover:bg-accent",
        isDisabled && "opacity-45",
      )}
    >
      <RadioGroup.Item
        className="grid size-4 place-items-center rounded-full border border-input bg-background outline-none focus-visible:ring-2 focus-visible:ring-ring/45"
        disabled={isDisabled}
        value={value}
      >
        <RadioGroup.Indicator className="size-2 rounded-full bg-primary" />
      </RadioGroup.Item>
      {startContent}
      <span>{label}</span>
    </label>
  );
}

interface SegmentedControlProps {
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly children: ReactNode;
  readonly isDisabled?: boolean;
  readonly layout?: "fill" | "hug";
  readonly size?: "sm" | "md";
}

export function SegmentedControl({
  label,
  value,
  onChange,
  children,
  isDisabled = false,
  layout = "hug",
}: SegmentedControlProps): ReactNode {
  return (
    <ToggleGroup.Root
      aria-label={label}
      className={cn(
        "inline-flex rounded-md border border-border bg-muted p-0.5",
        layout === "fill" && "flex w-full",
      )}
      disabled={isDisabled}
      onValueChange={(next: string) => {
        if (next) onChange(next);
      }}
      type="single"
      value={value}
    >
      {children}
    </ToggleGroup.Root>
  );
}

export function SegmentedControlItem({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}): ReactNode {
  return (
    <ToggleGroup.Item
      className="h-7 flex-1 rounded px-2.5 text-xs outline-none hover:bg-background/60 data-[state=on]:bg-background data-[state=on]:shadow-xs focus-visible:ring-2 focus-visible:ring-ring/45"
      value={value}
    >
      {label}
    </ToggleGroup.Item>
  );
}

interface TabListProps extends Omit<HTMLAttributes<HTMLDivElement>, "onChange"> {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly size?: "sm" | "md";
  readonly children: ReactNode;
}

export function TabList({
  value,
  onChange,
  size = "md",
  children,
  className,
  ...props
}: TabListProps): ReactNode {
  return (
    <Tabs.Root onValueChange={onChange} value={value}>
      <Tabs.List
        className={cn(
          "inline-flex items-center rounded-md bg-muted p-0.5",
          size === "sm" ? "h-7" : "h-8",
          className,
        )}
        {...props}
      >
        {children}
      </Tabs.List>
    </Tabs.Root>
  );
}

export function Tab({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}): ReactNode {
  return (
    <Tabs.Trigger
      className="h-full rounded px-2.5 text-xs text-muted-foreground outline-none hover:text-foreground data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs focus-visible:ring-2 focus-visible:ring-ring/45"
      value={value}
    >
      {label}
    </Tabs.Trigger>
  );
}

export function ToggleButton({
  label,
  isPressed = false,
  onPressedChange,
  isDisabled = false,
  icon,
  pressedIcon,
  isIconOnly = false,
  children,
  className,
}: {
  readonly label: string;
  readonly isPressed?: boolean;
  readonly onPressedChange?: (pressed: boolean, event: React.MouseEvent<HTMLButtonElement>) => void;
  readonly isDisabled?: boolean;
  readonly icon?: ReactNode;
  readonly pressedIcon?: ReactNode;
  readonly isIconOnly?: boolean;
  readonly children?: ReactNode;
  readonly className?: string;
  readonly size?: "sm" | "md" | "lg";
  readonly isLoading?: boolean;
  readonly tooltip?: string;
}): ReactNode {
  return (
    <button
      aria-label={isIconOnly ? label : undefined}
      aria-pressed={isPressed}
      className={cn(
        "inline-flex h-7 items-center justify-center gap-1.5 rounded-md px-2 text-xs outline-none hover:bg-accent aria-pressed:bg-accent aria-pressed:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring/45 disabled:opacity-45",
        isIconOnly && "aspect-square px-0",
        className,
      )}
      disabled={isDisabled}
      onClick={(event) => onPressedChange?.(!isPressed, event)}
      type="button"
    >
      {isPressed ? (pressedIcon ?? icon) : icon}
      {isIconOnly ? null : (children ?? label)}
    </button>
  );
}
