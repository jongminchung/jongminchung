import { Button } from "@jongminchung/ui/components/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
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

export function EmptyState({
  title,
  description,
}: {
  readonly title: string;
  readonly description?: string;
}): ReactNode {
  return (
    <Empty className="gap-1 rounded-none px-6 py-10">
      <EmptyHeader className="gap-1">
        <EmptyTitle>{title}</EmptyTitle>
        {description ? (
          <EmptyDescription className="text-xs">{description}</EmptyDescription>
        ) : null}
      </EmptyHeader>
    </Empty>
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
      <SpinnerIcon
        aria-hidden
        className={size === "sm" ? "size-3" : size === "lg" ? "size-5" : "size-4"}
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
