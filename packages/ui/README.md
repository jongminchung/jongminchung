# @jongminchung/ui

OSS-neutral React and Tailwind design primitives based on the repository design system.

## Install

```bash
npm install @jongminchung/ui react react-dom tailwindcss
```

This package ships compiled ESM, TypeScript declarations, Tailwind v4 stylesheets, and a typed
`designSystem` token object. Import the token stylesheet from CSS that is processed by Tailwind.

## Public interface

Import React primitives from the package root:

```tsx
import { Badge, Button, Card, cn, designSystem } from "@jongminchung/ui";
```

The visual language is a single Geist-style system: near-black ink on a near-white canvas, white
hairline cards, restrained link blue, and named gradient accents for hero or launch surfaces.

Import design tokens and Tailwind theme values once from the stylesheet entry:

```css
@import "tailwindcss";
@import "@jongminchung/ui/styles.css";
```

`./tokens.css` is an alias for the same stylesheet entry when a consumer wants token-oriented
naming:

```css
@import "tailwindcss";
@import "@jongminchung/ui/tokens.css";
```

The package stylesheet declares its own component source, so consuming apps do not need to add a
package-specific `@source` path.

The app baseline is optional. Import it only when the consuming app wants the package's global
`body`, anchor, selection, and box sizing defaults:

```css
@import "@jongminchung/ui/baseline.css";
```

Primitive file paths are intentionally not exported. Keep package consumers on the root design
module so the internal shadcn layout can change without changing the public interface.

## Build and pack

```bash
bun run build
npm pack --dry-run
```

`bun run build` uses `tsdown` in unbundle mode so the published `dist` tree keeps the same public
module shape as the TypeScript source while shipping JavaScript runtime files.

The npm package includes `dist`, the source files referenced by the `source` export condition,
`LICENSE`, `README.md`, and `package.json`. Test files and shadcn generator metadata are not
published.
