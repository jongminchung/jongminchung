/** Tech 글의 메타데이터를 동일한 추상 그래픽으로 표현함. */
export function EngineeringGraphic({
  seed,
}: {
  readonly seed: string;
}): React.JSX.Element {
  const value = Array.from(seed).reduce(
    (total, character) => (total * 31 + character.charCodeAt(0)) % 9973,
    17,
  );
  const palette = [
    ["#081fff", "#67c9ff", "#372cff"],
    ["#0077d8", "#20cff2", "#102eb8"],
    ["#00476d", "#00b5c8", "#003f95"],
    ["#5924ee", "#a84dff", "#2130db"],
    ["#0c62d6", "#54a9f7", "#0937ae"],
  ] as const;
  const [start, end, accent] = palette[value % palette.length] ?? palette[0];
  const gradientId = `editorial-gradient-${value}`;
  const glowId = `editorial-glow-${value}`;
  return (
    <svg
      aria-hidden="true"
      className="aspect-square w-full bg-muted"
      preserveAspectRatio="none"
      viewBox="0 0 320 320"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" x2="1" y1="0" y2="1">
          <stop stopColor={start} />
          <stop offset=".52" stopColor={end} />
          <stop offset="1" stopColor={accent} />
        </linearGradient>
        <filter id={glowId} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="20" />
        </filter>
      </defs>
      <rect fill={`url(#${gradientId})`} height="320" width="320" />
      <ellipse
        cx={70 + (value % 180)}
        cy={40 + (value % 180)}
        fill="#ffffff"
        filter={`url(#${glowId})`}
        opacity=".22"
        rx="84"
        ry="46"
      />
      <path
        d="M0 80H320M0 160H320M0 240H320M80 0V320M160 0V320M240 0V320"
        fill="none"
        stroke="#ffffff"
        strokeDasharray="2 5"
        strokeOpacity=".7"
        strokeWidth="1.5"
      />
      <path
        d={`M${54 + (value % 30)} 230 L160 ${78 + (value % 50)} L${244 - (value % 30)} 212`}
        fill="none"
        stroke="#ffffff"
        strokeLinecap="round"
        strokeOpacity=".94"
        strokeWidth="2"
      />
      {[
        { cx: 54 + (value % 30), cy: 230 },
        { cx: 160, cy: 78 + (value % 50) },
        { cx: 244 - (value % 30), cy: 212 },
      ].map(({ cx, cy }, index) => (
        <g key={`${cx}-${cy}`}>
          <rect
            fill="#ffffff"
            fillOpacity=".08"
            height="52"
            rx="8"
            stroke="#ffffff"
            strokeOpacity=".9"
            strokeWidth="1.5"
            width="52"
            x={cx - 26}
            y={cy - 26}
          />
          <circle
            cx={cx}
            cy={cy}
            fill="none"
            r={index === 1 ? 11 : 9}
            stroke="#ffffff"
            strokeWidth="2"
          />
        </g>
      ))}
    </svg>
  );
}
