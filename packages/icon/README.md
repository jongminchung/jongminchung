# @jongminchung/icon

Canonical code-based vector definition for the Jamie app icon.

## Source and generated assets

`src/index.ts` is the only source for the palette, geometry, approved variant, and preview sizes.
The tracked SVG files under registered apps are generated compatibility assets for Next.js
metadata. Do not edit those files directly.

| App                     | Variant    | Generated asset |
| ----------------------- | ---------- | --------------- |
| `apps/readme`           | `personal` | `app/icon.svg`  |
| `apps/engineering-docs` | `personal` | `app/icon.svg`  |

```sh
pnpm icon:generate
pnpm icon:check
```

`icon:generate` updates registered app assets. `icon:check` compares those outputs with the
canonical source and is safe to run in builds and CI. Apps that own a separate icon pipeline do not
need a registry entry or an exemption.

## Consuming the icon

React apps should render the data URL instead of copying SVG paths:

```tsx
import { createIconDataUrl } from "@jongminchung/icon";

<img src={createIconDataUrl("personal")} alt="" aria-hidden="true" />;
```

Keep an existing text label such as `JAMIE`, `Docs`, or the product name. Decorative icon instances
use an empty alternative text.

An app opts into generated assets by registering each required static output in `src/targets.ts`.
Declare the workspace dependency if application code imports the package, then run the generator
and drift check. The Playwright size-sheet snapshot is a visual approval record, not an asset
source.
