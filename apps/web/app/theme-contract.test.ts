import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/postcss";
import postcss from "postcss";
import { describe, expect, it } from "vitest";

const root = resolve(fileURLToPath(new URL("../../..", import.meta.url)));
const read = (path: string): string =>
  readFileSync(resolve(root, path), "utf8");
const readComponentStyles = (path: string): readonly string[] =>
  readdirSync(resolve(root, path), { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".module.css"))
    .map((entry) => read(`${path}/${entry.name}`));

const sharedTheme = read("packages/ui/src/styles/theme.css");
const sharedGlobals = read("packages/ui/src/styles/globals.css");
const sharedRootFacade = read("packages/ui/src/styles/root.css");
const tailwindTokens = read("packages/ui/src/styles/tokens.css");
const webTheme = read("apps/web/app/theme.css");
const dynamicFontCss = read(
  "apps/web/public/fonts/pretendard-variable/dynamic-subset.css",
);
const homeSections = [
  "HomeHeroSection.tsx",
  "HomePrinciplesSection.tsx",
  "HomeWorkSection.tsx",
  "HomeWritingSection.tsx",
]
  .map((file) => read(`apps/web/app/(home)/_components/${file}`))
  .join("\n");
const siteStylePaths = [
  "apps/web/app/(home)/home.css",
  "apps/web/app/(tech)/tech.css",
  "apps/web/app/(invest)/invest.css",
] as const;
const siteStyles = siteStylePaths.map(read);
const techStyles = siteStyles[1];
const investCodeStyles = read("apps/web/app/(invest)/invest-code.css");
const domainComponentStyles = [
  ...readComponentStyles("apps/web/app/(home)/_components"),
  ...readComponentStyles("apps/web/app/(tech)/_components"),
  ...readComponentStyles("apps/web/app/(invest)/_components"),
];

const requiredRoles = [
  "--background",
  "--foreground",
  "--card",
  "--popover",
  "--primary",
  "--secondary",
  "--muted",
  "--accent",
  "--destructive",
  "--border",
  "--input",
  "--ring",
];

const baseOnlyRoles = [
  "--font-family-body",
  "--font-family-heading",
  "--font-family-code",
  "--radius",
  "--elevation-low",
  "--elevation-medium",
  "--elevation-high",
];

const removedDomainTokens = [
  "brand-gradient-mid",
  "brand-highlight",
  "primary-emphasis",
  "inverse-",
  "syntax-background",
  "excalidraw-canvas",
  "warning",
  "duration-fast",
];

const generatedCssFrom = resolve(
  root,
  "packages/ui/src/styles/generated-css-contract.css",
);
const contractUtilities = [
  "bg-background",
  "text-background",
  "text-foreground",
  "bg-primary",
  "text-primary-foreground",
  "border-border",
  "outline-ring",
  "ring-ring",
  "bg-destructive",
  "text-destructive-foreground",
  "font-sans",
  "font-mono",
  "rounded-lg",
  "shadow-md",
];

describe("공통 디자인 토큰 계약", () => {
  it("[성공] 라이트와 다크 테마가 공용 역할을 모두 정의함", () => {
    const darkTheme = sharedTheme.split(':where(:root[data-theme="dark"])')[1];

    expect(darkTheme).toBeDefined();
    for (const role of requiredRoles) {
      expect(sharedTheme).toContain(`${role}:`);
      expect(darkTheme).toContain(`${role}:`);
      expect(tailwindTokens).toContain(`var(${role})`);
    }
    for (const role of baseOnlyRoles) {
      expect(sharedTheme).toContain(`${role}:`);
    }
  });

  it("[성공] route CSS가 제품 토큰을 중복 정의하지 않음", () => {
    for (const stylesheet of siteStyles) {
      expect(stylesheet).not.toMatch(/^\s*--[\w-]+\s*:/mu);
      expect(stylesheet).toContain('@import "@jongminchung/ui/globals.css";');
      expect(stylesheet).toContain('@import "../theme.css";');
      expect(stylesheet).toMatch(
        /@source "\.\/\*\*\/\*\.\{ts,tsx(?:,mdx)?\}";/u,
      );
      expect(stylesheet).toContain(
        '@source not "./**/*.{test,spec}.{ts,tsx}";',
      );
    }
  });

  it("[성공] Web만 site 배경과 앱 font를 소유함", () => {
    expect(sharedTheme).not.toContain("data-site");
    expect(sharedTheme).not.toContain("--font-pretendard");
    expect(webTheme).toContain('html[data-site="tech"]');
    expect(webTheme).toContain('html[data-site="invest"]');
    expect(read("apps/web/app/(home)/home/[locale]/layout.tsx")).toContain(
      'data-site="home"',
    );
    expect(webTheme).toContain("var(--font-pretendard, ui-sans-serif)");
    expect(read("apps/web/app/(tech)/tech/[locale]/layout.tsx")).toContain(
      'data-site="tech"',
    );
    expect(read("apps/web/app/(invest)/invest/[locale]/layout.tsx")).toContain(
      'data-site="invest"',
    );
  });

  it("[성공] 제거한 도메인 토큰을 다시 사용하지 않음", () => {
    const styles = [
      sharedTheme,
      webTheme,
      ...siteStyles,
      ...domainComponentStyles,
    ].join("\n");

    for (const token of removedDomainTokens) {
      expect(styles).not.toContain(`--${token}`);
    }
    expect(homeSections).not.toContain("text-inverse-foreground");
    expect(homeSections).toContain("text-background");
  });

  it("[성공] Pretendard를 next/font의 자체 호스팅 폰트로 등록함", () => {
    const fontDefinition = read("apps/web/app/fonts.ts");

    expect(fontDefinition).toContain('from "next/font/local"');
    expect(fontDefinition).toContain("PretendardStdVariable.woff2");
    expect(fontDefinition).toContain('adjustFontFallback: "Arial"');
    expect(fontDefinition).toContain("preload: false");
    expect(fontDefinition).toContain('variable: "--font-pretendard"');
    expect(fontDefinition).toContain('en: "font-pretendard-dynamic"');
    expect(fontDefinition).toContain('ko: "font-pretendard-dynamic"');
    expect(fontDefinition).toContain(
      '"/fonts/pretendard-variable/dynamic-subset.css"',
    );
    expect(dynamicFontCss.match(/@font-face/gu)).toHaveLength(93);
    expect(dynamicFontCss).toContain(".font-pretendard-dynamic");
    expect(dynamicFontCss).toContain("size-adjust: 101.55%");
    expect(webTheme).toContain("var(--font-pretendard, ui-sans-serif)");
  });

  it("[성공] Tailwind source와 public CSS entry를 하나의 계약으로 유지함", () => {
    const uiPackage = JSON.parse(read("packages/ui/package.json")) as {
      exports: Record<string, unknown>;
    };

    expect(sharedGlobals).toContain('@import "tailwindcss" source(none);');
    expect(sharedGlobals).toContain('@source "../**/*.{ts,tsx}";');
    expect(sharedGlobals).toContain(
      '@source not "../**/*.{test,spec}.{ts,tsx}";',
    );
    expect(webTheme).toContain('@source "../components/**/*.{ts,tsx}";');
    expect(webTheme).toContain('@source "../mdx-components.tsx";');
    expect(uiPackage.exports).toHaveProperty("./globals.css");
    expect(uiPackage.exports).toHaveProperty("./root.css");
    expect(sharedRootFacade).toContain("Deprecated compatibility facade");
    expect(sharedRootFacade).toContain('@import "./globals.css";');
  });

  it("[성공] Tech와 Invest가 동일한 코드블록 CSS 계약을 사용함", () => {
    for (const stylesheet of [techStyles, investCodeStyles]) {
      expect(stylesheet).toContain('@import "fumadocs-ui/css/shadcn.css";');
      expect(stylesheet).toContain('@import "fumadocs-ui/css/preset.css";');
      expect(stylesheet).toContain(
        '@source "../../node_modules/fumadocs-ui/dist/components/codeblock.js";',
      );
      expect(stylesheet).toContain(
        '@source "../../node_modules/fumadocs-ui/dist/components/ui/button.js";',
      );
      expect(stylesheet).toContain('html[data-theme="dark"]');
      expect(stylesheet).toContain("--shiki-dark");
    }
  });

  it("[성공] 승인된 semantic utility가 실제 CSS selector로 생성됨", async () => {
    const input = [
      '@import "tailwindcss" source(none);',
      '@import "./theme.css";',
      '@import "./tokens.css";',
      `@source inline("${contractUtilities.join(" ")}");`,
    ].join("\n");
    const { css } = await postcss([tailwindcss()]).process(input, {
      from: generatedCssFrom,
    });

    for (const utility of contractUtilities) {
      expect(css).toContain(`.${utility}`);
    }
    expect(css).not.toContain(".text-inverse-foreground");
  });

  it("[성공] 각 Web source에서 사용하는 semantic utility를 실제로 탐지함", async () => {
    const compiledSites = await Promise.all(
      siteStylePaths.map(async (path) => {
        const { css } = await postcss([tailwindcss()]).process(read(path), {
          from: resolve(root, path),
        });
        return css;
      }),
    );

    for (const css of compiledSites) {
      expect(css).toContain(".bg-background");
      expect(css).not.toContain(".text-inverse-foreground");
    }
    expect(compiledSites[0]).toContain(".text-background");
  });
});
