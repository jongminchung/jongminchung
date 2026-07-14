import type { SVGProps } from "react";

const iconProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function RefreshIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconProps} {...props}>
      <path d="M20 11a8 8 0 1 0-2.3 5.7" />
      <path d="M20 4v7h-7" />
    </svg>
  );
}

export function TranslateIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconProps} {...props}>
      <path d="M4 5h9" />
      <path d="M8.5 3v2" />
      <path d="M6 8c1.2 2.4 3.2 4.3 5.7 5.3" />
      <path d="M11.5 5c-.7 3.1-2.7 5.8-5.5 7.4" />
      <path d="m13 20 4-10 4 10" />
      <path d="M14.5 16h5" />
    </svg>
  );
}
