import { Button } from "@jongminchung/ui/components/button";
import { DropdownMenuItem as SharedDropdownMenuItem } from "@jongminchung/ui/components/dropdown-menu";
import {
    Popover as PopoverPrimitive,
    PopoverContent,
    PopoverTrigger,
} from "@jongminchung/ui/components/popover";
import { cn } from "@jongminchung/ui/lib/utils";
import { isValidElement } from "react";
import type { ComponentProps, ReactNode } from "react";

interface PopoverProps {
    readonly isOpen: boolean;
    readonly onOpenChange: (isOpen: boolean) => void;
    readonly label: string;
    readonly content: ReactNode;
    readonly children: ReactNode;
    readonly placement?: "above" | "below" | "left" | "right";
    readonly alignment?: "start" | "center" | "end";
    readonly width?: number | string;
    readonly hasAutoFocus?: boolean;
}

const SIDES = {
    above: "top",
    below: "bottom",
    left: "left",
    right: "right",
} as const;

export function Popover({
    isOpen,
    onOpenChange,
    label,
    content,
    children,
    placement = "below",
    alignment = "center",
    width,
    hasAutoFocus = false,
}: PopoverProps): ReactNode {
    const trigger = isValidElement(children) ? (
        children
    ) : (
        <Button type="button" size="sm" variant="outline">
            {children}
        </Button>
    );
    return (
        <PopoverPrimitive onOpenChange={onOpenChange} open={isOpen}>
            <PopoverTrigger render={trigger} />
            <PopoverContent
                align={alignment}
                aria-label={label}
                className="z-(--layer-popover) max-h-[min(70vh,560px)] w-auto overflow-auto border border-border p-1"
                initialFocus={hasAutoFocus ? true : false}
                side={SIDES[placement]}
                sideOffset={5}
                style={{ width }}
            >
                {content}
            </PopoverContent>
        </PopoverPrimitive>
    );
}

interface DropdownMenuItemProps extends Omit<
    ComponentProps<typeof SharedDropdownMenuItem>,
    "children" | "disabled" | "onClick"
> {
    readonly label?: string;
    readonly icon?: ReactNode;
    readonly endContent?: ReactNode;
    readonly isDisabled?: boolean;
    readonly onClick?: () => void;
}

export function DropdownMenuItem({
    label,
    icon,
    endContent,
    isDisabled = false,
    onClick,
    className,
    ...props
}: DropdownMenuItemProps): ReactNode {
    return (
        <SharedDropdownMenuItem
            className={cn(
                "grid min-h-7 w-full grid-cols-[18px_minmax(0,1fr)_auto] gap-2 rounded-md px-2 text-left text-xs",
                className,
            )}
            disabled={isDisabled}
            onClick={onClick}
            {...props}
        >
            <span className="text-muted-foreground">{icon}</span>
            <span>{label}</span>
            <span className="text-[10px] text-muted-foreground">
                {endContent}
            </span>
        </SharedDropdownMenuItem>
    );
}
