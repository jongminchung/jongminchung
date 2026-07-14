# @jongminchung/icon

Canonical code-based vector definitions for the Jamie app icon family.

## Source and generated assets

`src/index.ts` is the only source for palette, geometry, variants, and preview sizes. The tracked SVG
and PNG files under `apps/` are generated compatibility assets for Next.js metadata and the Chrome
extension. Do not edit those files directly.

| App                        | Variant               | Generated assets                          |
| -------------------------- | --------------------- | ----------------------------------------- |
| `apps/readme`              | `personal`            | `app/icon.svg`                            |
| `apps/docs`                | `personal`            | `app/icon.svg`                            |
| `apps/immersive-translate` | `immersive-translate` | master SVG and 16, 32, 48, 96, 128px PNGs |

```sh
pnpm icon:generate
pnpm icon:check
```

`icon:generate` updates tracked app assets. `icon:check` compares them with the canonical source
and is safe to run in builds and CI. The check discovers every `apps/*/package.json` and fails when
an app has no registered icon target.

## Consuming the icon

React apps should render the data URL instead of copying SVG paths:

```tsx
import { createIconDataUrl } from "@jongminchung/icon";

<img src={createIconDataUrl("personal")} alt="" aria-hidden="true" />;
```

Keep an existing text label such as `JAMIE`, `Docs`, or the product name. Decorative icon instances
use an empty alternative text.

When adding an app, choose an existing approved variant, register every required static output in
`src/targets.ts`, declare the workspace dependency if application code imports the package, then run
the generator and the drift check. The Playwright size-sheet snapshot is a visual approval record,
not an asset source.
