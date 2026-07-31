import type { ComponentType } from "react";

interface MdxModule {
  readonly default: ComponentType;
}

export const documentLoaders = {
  "en/overview": () => import("../content/en/overview.mdx"),
  "en/handbook/collaboration": () => import("../content/en/handbook/collaboration.mdx"),
  "en/handbook/ddd": () => import("../content/en/handbook/ddd.mdx"),
  "en/handbook/app-icons": () => import("../content/en/handbook/app-icons.mdx"),
  "en/packages/remark-plantuml": () => import("../content/en/packages/remark-plantuml.mdx"),
  "en/packages/tooling": () => import("../content/en/packages/tooling.mdx"),
  "en/deep-dive/nextjs-16": () => import("../content/en/deep-dive/nextjs-16.mdx"),
  "en/deep-dive/pnpm-11": () => import("../content/en/deep-dive/pnpm-11.mdx"),
  "en/deep-dive/node-26": () => import("../content/en/deep-dive/node-26.mdx"),
  "en/deep-dive/typescript-6": () => import("../content/en/deep-dive/typescript-6.mdx"),
  "en/deep-dive/typescript-7-compatibility": () => import("../content/en/deep-dive/typescript-7-compatibility.mdx"),
  "ko/overview": () => import("../content/ko/overview.mdx"),
  "ko/handbook/collaboration": () => import("../content/ko/handbook/collaboration.mdx"),
  "ko/handbook/ddd": () => import("../content/ko/handbook/ddd.mdx"),
  "ko/handbook/app-icons": () => import("../content/ko/handbook/app-icons.mdx"),
  "ko/packages/remark-plantuml": () => import("../content/ko/packages/remark-plantuml.mdx"),
  "ko/packages/tooling": () => import("../content/ko/packages/tooling.mdx"),
  "ko/deep-dive/nextjs-16": () => import("../content/ko/deep-dive/nextjs-16.mdx"),
  "ko/deep-dive/pnpm-11": () => import("../content/ko/deep-dive/pnpm-11.mdx"),
  "ko/deep-dive/node-26": () => import("../content/ko/deep-dive/node-26.mdx"),
  "ko/deep-dive/typescript-6": () => import("../content/ko/deep-dive/typescript-6.mdx"),
  "ko/deep-dive/typescript-7-compatibility": () => import("../content/ko/deep-dive/typescript-7-compatibility.mdx"),
} as const satisfies Readonly<Record<string, () => Promise<MdxModule>>>;

export type DocumentLoaderKey = keyof typeof documentLoaders;
