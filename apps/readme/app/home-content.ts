export interface Project {
    readonly category: string;
    readonly description: string;
    readonly href: string;
    readonly index: string;
    readonly tags: readonly string[];
    readonly title: string;
}

export interface Principle {
    readonly body: string;
    readonly key: string;
    readonly title: string;
}

export const projects = [
    {
        index: "01",
        category: "Knowledge system",
        title: "Jongmin Chung Engineering Docs",
        description:
            "A bilingual path through collaboration rules, public package contracts, and the platform failures behind them.",
        tags: ["Next.js", "MDX", "shadcn/ui"],
        href: "https://jongminchung.dev/en/overview",
    },
    {
        index: "02",
        category: "Developer tooling",
        title: "@jongminchung/tooling",
        description:
            "Shared lint and format contracts that keep a workspace consistent without copying configuration.",
        tags: ["oxlint", "oxfmt", "pnpm"],
        href: "https://github.com/jongminchung/jongminchung/tree/main/packages/tooling",
    },
] as const satisfies readonly Project[];

export const principles = [
    {
        key: "language",
        title: "Language is architecture.",
        body: "Meetings, issues, APIs, and tests should use the same words.",
    },
    {
        key: "boundaries",
        title: "Boundaries earn their keep.",
        body: "External values are translated before an internal model trusts them.",
    },
    {
        key: "evidence",
        title: "Evidence ships with change.",
        body: "Tests make intent observable and keep the cost of change inside its boundary.",
    },
] as const satisfies readonly Principle[];

export const personSchema = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: "Jongmin Chung",
    alternateName: "Jamie",
    url: "https://jamie.kr",
    sameAs: ["https://github.com/jongminchung"],
    knowsAbout: [
        "Domain-Driven Design",
        "TypeScript",
        "Next.js",
        "Developer tooling",
    ],
} as const;
