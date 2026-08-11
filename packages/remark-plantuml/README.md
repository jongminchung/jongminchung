# @jongminchung/remark-plantuml

Remark plugin for rendering PlantUML code fences and local `.puml` links as SVG image figures.

## Version Policy

The manual package workflow always replaces the personal `1.0.0` package version.

## Install

Node.js 24 or newer is required. The package exposes ESM named exports only.

```bash
npm install --save-dev @jongminchung/remark-plantuml
```

## Usage

```ts
import { unified } from "@astrojs/markdown-remark";
import { remarkPlantUml } from "@jongminchung/remark-plantuml";

export default {
  markdown: {
    processor: unified({
      remarkPlugins: [
        [
          remarkPlantUml,
          {
            contentRoot: "./src/content/docs",
            serverBaseUrl: "https://www.plantuml.com/plantuml/svg",
          },
        ],
      ],
    }),
  },
};
```

Use ESM `import` for every JavaScript entry point. CommonJS `require()` is not part of the
supported package contract.

Astro configs can use the helper export:

```ts
import { createPlantUmlRemarkPlugin } from "@jongminchung/remark-plantuml/astro";

createPlantUmlRemarkPlugin({
  contentRoot: "./src/content/docs",
  serverBaseUrl: "https://www.plantuml.com/plantuml/svg",
});
```

`serverBaseUrl` is required. PlantUML source is encoded into the image URL, so each consuming
project must explicitly choose a public or self-hosted PlantUML server.

## CSS

Generic figure styles:

```css
@import "@jongminchung/remark-plantuml/styles.css";
```

Starlight-oriented caption color:

```css
@import "@jongminchung/remark-plantuml/starlight.css";
```

## Build and pack

```bash
pnpm run build
npm pack --dry-run
```

`pnpm run build` uses TypeScript `tsc` to emit the explicit public entry points as ESM JavaScript and
declarations. The CSS subpaths resolve directly to the source assets included in the package. The
package does not include a bundle or a separate CommonJS build.
