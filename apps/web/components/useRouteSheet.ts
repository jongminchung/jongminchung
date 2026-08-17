"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/** `useRouteSheet` 훅 상태와 제어 함수를 제공함 */
export function useRouteSheet() {
    const pathname = usePathname();
    const triggerRef = useRef<HTMLButtonElement>(null);
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => setIsOpen(false), [pathname]);

    const setOpen = (nextOpen: boolean): void => {
        setIsOpen(nextOpen);
        if (!nextOpen) requestAnimationFrame(() => triggerRef.current?.focus());
    };

    return { isOpen, setOpen, triggerRef } as const;
}
