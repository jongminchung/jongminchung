"use client";

import { SelectContent as SharedSelectContent } from "@jongminchung/ui/components/select";
import { cn } from "@jongminchung/ui/lib/utils";
import type { ComponentProps, ReactNode } from "react";

export {
  Select,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@jongminchung/ui/components/select";

export function SelectContent({
  positionerClassName,
  ...props
}: ComponentProps<typeof SharedSelectContent>): ReactNode {
  return (
    <SharedSelectContent positionerClassName={cn("z-[150]", positionerClassName)} {...props} />
  );
}
