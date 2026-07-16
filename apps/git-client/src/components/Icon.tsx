import type { SVGProps } from "react";

type IconName =
  | "branch"
  | "tag"
  | "remote"
  | "folder"
  | "file"
  | "search"
  | "filter"
  | "refresh"
  | "fetch"
  | "pull"
  | "push"
  | "commit"
  | "history"
  | "console"
  | "changes"
  | "stash"
  | "shelf"
  | "chevron"
  | "star"
  | "more"
  | "copy"
  | "patch"
  | "cherry"
  | "compare"
  | "undo"
  | "trash"
  | "globe"
  | "plus"
  | "minus"
  | "close"
  | "check"
  | "warning"
  | "split"
  | "moon"
  | "sun"
  | "settings"
  | "worktree"
  | "external";

const paths: Record<IconName, readonly string[]> = {
  branch: ["M6 3v12a3 3 0 0 0 3 3h3", "M15 6V3", "M12 6l3-3 3 3", "M12 18h6"],
  tag: ["M4 4h6l9 9-6 6-9-9V4Z", "M8 8h.01"],
  remote: [
    "M4 12a8 8 0 1 0 16 0 8 8 0 0 0-16 0Z",
    "M12 4c2.2 2.2 3.2 4.9 3.2 8S14.2 17.8 12 20",
    "M4 12h16",
  ],
  folder: ["M3 6h7l2 2h9v11H3V6Z"],
  file: ["M6 3h8l4 4v14H6V3Z", "M14 3v5h5"],
  search: ["M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z", "m16 16 5 5"],
  filter: ["M3 5h18l-7 8v6l-4 2v-8L3 5Z"],
  refresh: ["M20 7v5h-5", "M4 17v-5h5", "M18.5 9A7 7 0 0 0 6 7", "M5.5 15A7 7 0 0 0 18 17"],
  fetch: ["M12 3v12", "m7 10 5 5 5-5", "M5 20h14"],
  pull: ["M7 3v10", "m3 10-3 3-3-3", "M17 21V11", "m-3-5 3-3 3 3"],
  push: ["M12 21V9", "m7 14 5-5 5 5", "M5 4h14"],
  commit: ["M3 12h6", "M15 12h6", "M9 12a3 3 0 1 0 6 0 3 3 0 0 0-6 0Z"],
  history: ["M3 12a9 9 0 1 0 3-6.7L3 8", "M3 3v5h5", "M12 7v5l3 2"],
  console: ["M4 5h16v14H4V5Z", "m7 9 3 3-3 3", "M13 16h4"],
  changes: ["M6 3h12v18H6V3Z", "M9 8h6", "M9 12h6", "M9 16h4"],
  stash: ["M4 8h16v12H4V8Z", "M7 4h10v4", "M9 12h6"],
  shelf: ["M4 4v16", "M20 4v16", "M4 16h16", "M7 7h10v6H7V7Z"],
  chevron: ["m9 6 6 6-6 6"],
  star: ["m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z"],
  more: ["M5 12h.01", "M12 12h.01", "M19 12h.01"],
  copy: ["M8 8h12v12H8V8Z", "M4 16V4h12"],
  patch: ["M12 3v18", "M3 12h18"],
  cherry: [
    "M12 13c-5-1-7 2-6 6 4 2 7 0 6-6Z",
    "M12 13c5-1 7 2 6 6-4 2-7 0-6-6Z",
    "M12 13c0-5 2-8 6-10",
  ],
  compare: ["M7 4v14", "m4 14-4 4-4-4", "M17 20V6", "m-4 0 4-4 4 4"],
  undo: ["M9 7 4 3 4-3", "M4 17a8 8 0 0 1 13-7"],
  trash: ["M4 7h16", "M9 7V4h6v3", "m7 10 1 14", "m14 10-1 14", "M6 7l1 14h10l1-14"],
  globe: ["M4 12a8 8 0 1 0 16 0 8 8 0 0 0-16 0Z", "M4 12h16", "M12 4c4 4 4 12 0 16"],
  plus: ["M12 5v14", "M5 12h14"],
  minus: ["M5 12h14"],
  close: ["m6 6 12 12", "m18 6-12 12"],
  check: ["m5 12 4 4L19 6"],
  warning: ["M12 3 2 15h-4l2-15Z", "M12 9v4", "M12 16h.01"],
  split: ["M8 3v18", "M16 3v18"],
  moon: ["M20 15a8 8 0 0 1-11-11 8 8 0 1 0 11 11Z"],
  sun: [
    "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z",
    "M12 2v2",
    "M12 20v2",
    "M4.9 4.9l1.4 1.4",
    "m17.7 17.7-1.4-1.4",
    "M2 12h2",
    "M20 12h2",
    "m4.9 19.1 1.4-1.4",
    "m17.7 6.3-1.4 1.4",
  ],
  settings: [
    "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z",
    "M4 12H2",
    "M22 12h-2",
    "M12 4V2",
    "M12 22v-2",
    "m6.3 6.3-1.4-1.4",
    "m19.1 19.1-1.4-1.4",
    "m17.7 6.3 1.4-1.4",
    "m4.9 19.1 1.4-1.4",
  ],
  worktree: ["M5 4v16", "M5 8h8", "M13 8v5h6", "M13 8l4-4", "M13 8l4 4"],
  external: ["M14 4h6v6", "m20 4-9 9", "M18 13v7H4V6h7"],
};

export function Icon({
  name,
  size = 16,
  ...props
}: { readonly name: IconName; readonly size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg aria-hidden="true" fill="none" height={size} viewBox="0 0 24 24" width={size} {...props}>
      {paths[name].map((path, index) => (
        <path
          d={path}
          key={index}
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.65"
        />
      ))}
    </svg>
  );
}
