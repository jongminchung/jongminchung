"use client";

import Link from "next/link";
import { useState, type ComponentProps } from "react";

/** 링크에 포인터나 키보드 초점이 닿으면 Next의 미리 읽기를 활성화함 */
export function IntentLink({
  onPointerEnter,
  onFocus,
  ...props
}: Omit<ComponentProps<typeof Link>, "prefetch">) {
  const [active, setActive] = useState(false);

  return (
    <Link
      {...props}
      prefetch={active ? null : false}
      onPointerEnter={(event) => {
        setActive(true);
        onPointerEnter?.(event);
      }}
      onFocus={(event) => {
        setActive(true);
        onFocus?.(event);
      }}
    />
  );
}
