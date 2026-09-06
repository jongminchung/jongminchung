/** `EditorialGraphic` 항목 메타데이터로 결정되는 외부 자산 없는 추상 그래픽임 */
export function EditorialGraphic({
  seed,
}: {
  readonly seed: string;
}): React.JSX.Element {
  const value = Array.from(seed).reduce(
    (total, character) => (total * 31 + character.charCodeAt(0)) % 9973,
    17,
  );
  const offset = 16 + (value % 28);
  const slope = 35 + (value % 48);

  return (
    <svg
      aria-hidden="true"
      className="aspect-[1.6] w-full border-b bg-muted"
      preserveAspectRatio="none"
      viewBox="0 0 320 200"
    >
      <path
        d="M0 40H320M0 100H320M0 160H320M64 0V200M160 0V200M256 0V200"
        fill="none"
        stroke="var(--border)"
        strokeWidth="1"
      />
      <path
        d={`M0 ${180 - offset} C70 ${slope}, 155 ${190 - slope}, 320 ${offset}`}
        fill="none"
        stroke="var(--primary)"
        strokeWidth="2"
      />
      <path
        d={`M${offset} 188 L${160 - offset / 3} ${35 + offset} L${310 - offset} ${120 + (value % 30)}`}
        fill="none"
        stroke="var(--foreground)"
        strokeOpacity=".55"
        strokeWidth="1.5"
      />
      {[offset, 160 - offset / 3, 310 - offset].map((x, index) => (
        <circle
          cx={x}
          cy={
            index === 0 ? 188 : index === 1 ? 35 + offset : 120 + (value % 30)
          }
          fill="var(--card)"
          key={x}
          r="5"
          stroke="var(--primary)"
          strokeWidth="2"
        />
      ))}
    </svg>
  );
}
