// @ts-nocheck -- Upstream visual source; runtime contracts are checked at the registry boundary.

import { useCallback, useState } from "react";

/**
 * 본문 '제어와 비제어, 둘 다 지원하기' 절에서 구현하는 훅.
 * value가 넘어오면 제어 모드, 없으면 내부 상태(비제어 모드)로 동작한다.
 */
export function useControllableState<T>({
  value,
  defaultValue,
  onChange,
}: {
  value?: T;
  defaultValue: T;
  onChange?: (value: T) => void;
}) {
  const [internal, setInternal] = useState(defaultValue);
  const isControlled = value !== undefined;
  const current = isControlled ? value : internal;

  const set = useCallback(
    (next: T) => {
      if (!isControlled) setInternal(next);
      onChange?.(next);
    },
    [isControlled, onChange],
  );

  return [current, set] as const;
}
