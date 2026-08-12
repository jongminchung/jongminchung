import { cn } from "@jongminchung/ui/lib/utils";
import { Loader2Icon } from "lucide-react";

type SpinnerProps = Omit<
    React.ComponentProps<"svg">,
    "aria-hidden" | "aria-label" | "role"
> &
    (
        | { "aria-hidden": true; label?: never }
        | { "aria-hidden"?: false; label: string }
    );

function Spinner({ className, label, ...props }: SpinnerProps) {
    const hidden = props["aria-hidden"] === true;

    return (
        <Loader2Icon
            data-slot="spinner"
            role={hidden ? undefined : "status"}
            aria-label={label}
            className={cn("size-4 animate-spin", className)}
            {...props}
        />
    );
}

export { Spinner };
