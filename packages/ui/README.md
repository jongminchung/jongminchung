# @jongminchung/ui

Shared shadcn primitives, semantic theme tokens, and Tailwind CSS styles.

## Install

Node.js 24 or newer is required. Configure the `@jongminchung` scope for GitHub Packages, then
install the package with its peers:

```bash
npm install @jongminchung/ui react react-dom tailwindcss
```

The package ships ESM and named component exports only. Import components through explicit
subpaths:

```tsx
import { Button } from "@jongminchung/ui/components/button";
import { cn } from "@jongminchung/ui/lib/utils";
```

## Styles and themes

Import the shared Tailwind entry point from the application's global stylesheet:

```css
@import "@jongminchung/ui/globals.css";
```

`globals.css` includes the default neutral light and dark themes. Override any semantic token by
importing application styles afterward:

```css
@import "@jongminchung/ui/globals.css";
@import "./theme.css";
```

```css
:root {
  --primary: oklch(0.55 0.2 265);
}

:root[data-theme="dark"] {
  --primary: oklch(0.72 0.15 265);
}
```

The default theme is also available directly from `@jongminchung/ui/theme.css`. The value-free
Tailwind token adapter is exported as `@jongminchung/ui/tokens.css`.

Set `data-theme="dark"` on the root element to enable the dark theme. Product-specific tokens,
layout, state, and behavior remain the responsibility of each application.

## Build and pack

```bash
pnpm run build
pnpm publish --dry-run --access public
```

The package includes compiled ESM JavaScript, generated declarations, source components for
workspace development and Tailwind source detection, CSS assets, `LICENSE`, and this README. It
does not expose a root barrel or CommonJS build.

## Version policy

The manual package workflow always replaces the personal `1.0.0` package version.
