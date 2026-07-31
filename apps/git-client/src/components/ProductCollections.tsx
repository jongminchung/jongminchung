import { Badge } from "@jongminchung/ui/components/badge";
import { Button } from "@jongminchung/ui/components/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@jongminchung/ui/components/empty";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemGroup,
  ItemMedia,
} from "@jongminchung/ui/components/item";
import { RadioGroup, RadioGroupItem } from "@jongminchung/ui/components/radio-group";
import { Spinner as SpinnerIcon } from "@jongminchung/ui/components/spinner";
import { ToggleGroup, ToggleGroupItem } from "@jongminchung/ui/components/toggle-group";
import { cn } from "@jongminchung/ui/lib/utils";
import type { HTMLAttributes, ReactNode } from "react";

interface ListProps extends HTMLAttributes<HTMLDivElement> {
  readonly density?: "compact" | "default";
}

export function List({ density = "default", className, ...props }: ListProps): ReactNode {
  return (
    <ItemGroup
      className={cn("gap-0.5", density === "compact" && "text-xs", className)}
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
  role,
  ...props
}: ListItemProps): ReactNode {
  return (
    <Item
      aria-disabled={isDisabled || undefined}
      aria-selected={isSelected || undefined}
      className={cn(
        "min-h-9 gap-2 rounded-md px-2 py-1",
        onClick && !isDisabled && "cursor-default hover:bg-accent",
        isSelected && "bg-accent text-accent-foreground",
        isDisabled && "opacity-45",
        className,
      )}
      onClick={isDisabled ? undefined : onClick}
      render={
        onClick === undefined ? undefined : (
          <Button disabled={isDisabled} size="default" type="button" variant="ghost" />
        )
      }
      role={role ?? (onClick === undefined ? "listitem" : undefined)}
      {...props}
    >
      {startContent ? (
        <ItemMedia className="text-muted-foreground">{startContent}</ItemMedia>
      ) : (
        <span />
      )}
      <ItemContent className="gap-0.5">
        <strong className="truncate font-medium">{label}</strong>
        {description ? (
          <small className="truncate text-muted-foreground">{description}</small>
        ) : null}
      </ItemContent>
      {endContent ? <ItemActions>{endContent}</ItemActions> : null}
    </Item>
  );
}

interface EmptyStateProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  readonly title?: ReactNode;
  readonly description?: ReactNode;
  readonly icon?: ReactNode;
}

export function EmptyState({
  title,
  description,
  icon,
  className,
  children,
  ...props
}: EmptyStateProps): ReactNode {
  return (
    <Empty className={cn("h-full min-h-0 gap-1 rounded-none px-6 py-10", className)} {...props}>
      {icon || title || description ? (
        <EmptyHeader className="gap-1">
          {icon ? <EmptyMedia>{icon}</EmptyMedia> : null}
          {title ? (
            <EmptyTitle className="text-xs font-normal text-muted-foreground">{title}</EmptyTitle>
          ) : null}
          {description ? (
            <EmptyDescription className="text-xs">{description}</EmptyDescription>
          ) : null}
        </EmptyHeader>
      ) : null}
      {children ? <EmptyContent>{children}</EmptyContent> : null}
    </Empty>
  );
}

interface SpinnerProps extends HTMLAttributes<HTMLSpanElement> {
  readonly label: string;
  readonly size?: "sm" | "md" | "lg";
}

export function Spinner({ label, size = "md", className, ...props }: SpinnerProps): ReactNode {
  return (
    <span
      className={cn("inline-flex items-center gap-2 text-xs text-muted-foreground", className)}
      role="status"
      {...props}
    >
      <SpinnerIcon
        aria-hidden
        className={size === "sm" ? "size-3" : size === "lg" ? "size-5" : "size-4"}
      />
      {label}
    </span>
  );
}

export function StatusBadge({
  className,
  children,
}: {
  readonly className?: string;
  readonly children: ReactNode;
}): ReactNode {
  return (
    <Badge
      className={cn("size-4 flex-none rounded-xs p-0 font-mono text-[9px] font-bold", className)}
      variant="ghost"
    >
      {children}
    </Badge>
  );
}

const statePillToneClasses = {
  neutral: "border-border text-muted-foreground",
  success: "border-success/45 bg-success-muted text-success-muted-foreground",
  destructive: "border-destructive/45 bg-destructive-muted text-destructive-muted-foreground",
  disabled: "border-border bg-muted text-disabled-foreground",
  primary: "border-primary",
} as const;

interface StatePillProps extends HTMLAttributes<HTMLSpanElement> {
  readonly tone?: keyof typeof statePillToneClasses;
}

export function StatePill({
  children,
  className,
  tone = "neutral",
  ...props
}: StatePillProps): ReactNode {
  return (
    <Badge
      className={cn(
        "h-auto rounded-xl border px-2 py-0.5 font-normal",
        statePillToneClasses[tone],
        className,
      )}
      variant={
        tone === "primary" ? "default" : tone === "destructive" ? "destructive" : "secondary"
      }
      {...props}
    >
      {children}
    </Badge>
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
      <RadioGroup
        className={cn(size === "sm" ? "gap-0.5" : "gap-1")}
        onValueChange={onChange}
        value={value}
      >
        {children}
      </RadioGroup>
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
      <RadioGroupItem disabled={isDisabled} value={value} />
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
    <ToggleGroup
      aria-label={label}
      className={cn(
        "rounded-md border border-border bg-muted p-0.5",
        layout === "fill" && "flex w-full",
      )}
      disabled={isDisabled}
      onValueChange={(next: string[]) => {
        const selected = next[0];
        if (selected !== undefined) onChange(selected);
      }}
      spacing={0}
      value={[value]}
    >
      {children}
    </ToggleGroup>
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
    <ToggleGroupItem
      className="h-7 flex-1 rounded px-2.5 text-xs data-pressed:shadow-xs"
      value={value}
    >
      {label}
    </ToggleGroupItem>
  );
}
