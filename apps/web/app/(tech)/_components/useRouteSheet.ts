"use client";

import { usePathname } from "next/navigation";
import { useRef, useState } from "react";

/** `useRouteSheet` 훅 상태와 제어 함수를 제공함 */
export function useRouteSheet() {
    const pathname = usePathname();
    const triggerRef = useRef<HTMLButtonElement>(null);
    const [openedPathname, setOpenedPathname] = useState<string | null>(null);
    const isOpen = openedPathname === pathname;

    const setOpen = (nextOpen: boolean): void => {
        setOpenedPathname(nextOpen ? pathname : null);
        if (!nextOpen) requestAnimationFrame(() => triggerRef.current?.focus());
    };

    return { isOpen, setOpen, triggerRef } as const;
}
