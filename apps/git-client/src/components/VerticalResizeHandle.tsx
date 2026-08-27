import { useRef } from "react";
import type { KeyboardEvent, PointerEvent } from "react";

export function VerticalResizeHandle({
  label,
  value,
  direction,
  onChange,
}: {
  readonly label: string;
  readonly value: number;
  readonly direction: 1 | -1;
  readonly onChange: (value: number) => void;
}) {
  const drag = useRef<{ readonly x: number; readonly value: number } | null>(
    null,
  );

  const updateFromPointer = (event: PointerEvent<HTMLDivElement>): void => {
    if (!drag.current) return;
    onChange(drag.current.value + (event.clientX - drag.current.x) * direction);
  };

  const handleKeyboard = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const delta = event.key === "ArrowRight" ? 12 : -12;
    onChange(value + delta * direction);
  };

  return (
    <div
      aria-label={label}
      aria-orientation="vertical"
      aria-valuenow={Math.round(value)}
      className={`verticalResizeHandle verticalResizeHandle [position:absolute] [top:0] [right:-4px] [bottom:0] [z-index:var(--layer-resize-handle)] [width:7px] [cursor:col-resize] max-[1120px]:[display:none] [&::after]:[position:absolute] [&::after]:[inset:0_3px] [&::after]:[content:""] [&::after]:[background:transparent] [&::after]:[transition:background_100ms_ease-out] [&:focus-visible::after]:[background:var(--primary)] [&:hover::after]:[background:var(--primary)]`}
      onKeyDown={handleKeyboard}
      onPointerCancel={(event) => {
        drag.current = null;
        event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onPointerDown={(event) => {
        drag.current = { x: event.clientX, value };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={updateFromPointer}
      onPointerUp={(event) => {
        updateFromPointer(event);
        drag.current = null;
        event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      role="separator"
      tabIndex={0}
    />
  );
}
