"use client";

import { useEffect, useRef, useState } from "react";

/** CSS가 trigger를 숨기면 열린 헤더 메뉴를 닫고 보이는 브랜드 링크로 초점을 돌림. */
export function useHeaderOverlay() {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const trigger = triggerRef.current;
    if (!open || !trigger) return;

    // CSS의 반응형 기준을 그대로 따르므로 JavaScript에 breakpoint를 중복하지 않는다.
    const observer = new ResizeObserver(() => {
      if (trigger.getClientRects().length === 0) setOpen(false);
    });
    observer.observe(trigger);
    return () => observer.disconnect();
  }, [open]);

  const finalFocus = () => {
    const trigger = triggerRef.current;
    if (!trigger || trigger.getClientRects().length > 0) return true;
    return trigger.closest("header")?.querySelector("a") ?? false;
  };

  return { open, setOpen, triggerRef, finalFocus };
}
