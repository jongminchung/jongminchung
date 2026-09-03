# @jongminchung/ui

Internal shared UI primitives, semantic token contracts, and global Tailwind CSS infrastructure for
the applications in this repository.

## Scope

This package owns product-agnostic primitives, `cn`, the semantic token schema, neutral fallback
theme values, and the global CSS contract. Applications own their theme overrides, product tokens,
composition, state, and behavior.

Ownership follows the abstraction layer rather than the number of consumers. A generic primitive
remains here even when only one application uses it, while similar product compositions remain in
their applications when their meaning or behavior differs.

## Install

Node.js 24 or newer is required. GitHub Packages requires a classic personal access token with
`read:packages`, including for public package downloads.

```ini
@jongminchung:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_PACKAGES_TOKEN}
```

Keep the token in the environment rather than committing it to `.npmrc`, then install the package
with its peers:

```bash
npm install @jongminchung/ui react react-dom tailwindcss
```

The package ships ESM and named component exports only. Import components through explicit
subpaths:

```tsx
import { Button } from "@jongminchung/ui/components/button";
import { cn } from "@jongminchung/ui/lib/utils";
```

Accessible text stays with the consuming product and locale. Pass `label` to a standalone `Spinner`,
or mark a spinner nested inside an already labelled control with `aria-hidden`. `DialogContent` and
`SheetContent` require `closeLabel` whenever their default close button is visible. `CommandDialog`
requires callers to provide both `title` and `description`; shared primitives do not supply English
fallback copy.

## Styles and themes

Import the shared Tailwind entry point from the application's global stylesheet:

```css
@import "@jongminchung/ui/globals.css";

@source "../**/*.{ts,tsx}";
@source not "../**/*.{test,spec}.{ts,tsx}";
```

`globals.css` includes the default neutral light and dark themes and scans the shared UI package.
Automatic project scanning is disabled, so every consumer registers its own source tree explicitly.
Override any semantic token by importing application styles afterward:

```css
@import "@jongminchung/ui/globals.css";
@import "./theme.css";

@source "../**/*.{ts,tsx}";
@source not "../**/*.{test,spec}.{ts,tsx}";
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

`@jongminchung/ui/root.css` remains as a deprecated compatibility facade. New and migrated
consumers use `@jongminchung/ui/globals.css`; remove the facade only after the external consumer
inventory is empty or a breaking release is prepared.

Set `data-theme="dark"` on the root element to enable the dark theme. Product-specific tokens,
layout, state, and behavior remain the responsibility of each application.

## shadcn source workflow

`packages/ui/components.json` is the canonical shadcn configuration for shared primitives. Run the
CLI from this workspace, inspect the dry run, and review generated dependencies and source before
committing:

```bash
bunx --bun shadcn add <component> --dry-run -c packages/ui
bunx --bun shadcn add <component> -c packages/ui
bunx --bun shadcn add <component> --diff -c packages/ui
```

`apps/web/components.json` describes consumer aliases and is not the add or update entry point for
shared primitives. Registry output is repository-owned source; never accept an overwrite without
merging local accessibility, semantic token, and public API decisions.

## Build and pack

```bash
bun run build
bun publish --dry-run --access public
```

The package includes compiled ESM JavaScript, generated declarations, source components for
workspace development and Tailwind source detection, CSS assets, `LICENSE`, and this README. It
does not expose a root barrel or CommonJS build.

## Version policy

Workspace consumers use the package source-first, and compatibility is evaluated against consumers
inside this repository. The manual package workflow always replaces the fixed personal `1.0.0`
package version. This is a mutable snapshot channel, so the same version can have different API,
contents, and integrity. Force a new resolution and commit the updated downstream lockfile after a
replacement is published:

```bash
bun update --force @jongminchung/ui@1.0.0
```

This policy is limited to source-first workspace consumers and explicitly coordinated personal
consumers. Before the first independently versioned external consumer adopts the package, replace
the mutable snapshot with immutable SemVer releases, a changelog, migration notes, and a rollback
procedure. Consumers must not use a SemVer range such as `^1.0.0` while the snapshot policy remains.
