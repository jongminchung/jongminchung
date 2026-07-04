# @jongminchung/remark-plantuml

Remark plugin for rendering PlantUML code fences and local `.puml` links as SVG image figures.

## Version Policy

This package intentionally stays on `1.0.0`. Consumers should reuse
`@jongminchung/remark-plantuml@1.0.0`; do not publish replacement versions such as `1.0.1` or
`1.0.2`.

## Install

```bash
npm install --save-dev @jongminchung/remark-plantuml
```

## Usage

```ts
import { unified } from "@astrojs/markdown-remark";
import remarkPlantUml from "@jongminchung/remark-plantuml";

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
