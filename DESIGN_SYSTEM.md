# Design System

The workspace uses a shared open-code primitive package and app-owned product
UI. The package is an internal shadcn source package, not a separately
distributed design system.

## Ownership

| Owner                          | Responsibilities                                                              |
| ------------------------------ | ----------------------------------------------------------------------------- |
| `@jongminchung/ui`             | shadcn primitives, `cn`, shared Tailwind entrypoint                           |
| `@jongminchung/theme-contract` | value-free semantic token and Tailwind color/radius mapping                   |
| Each app                       | `theme.css` values, product components, layouts, state, and platform behavior |

Shared primitives are imported through explicit subpaths:

```tsx
import { Button } from "@jongminchung/ui/components/button";
import { cn } from "@jongminchung/ui/lib/utils";
```

There is no root barrel. Do not import from `@jongminchung/ui`, copy primitives
into an app-local
`components/ui`, or import `@base-ui/react` directly from an app.

## Adding Components

Run shadcn from the shared package so registry files and primitive dependencies
keep one owner:

```bash
cd packages/ui
pnpm exec shadcn add <component>
```

Review generated files before committing. Preserve the `base-nova`, Base UI,
Lucide, neutral, and RSC settings in `packages/ui/components.json`. Export new
primitives through the existing
`./components/*` wildcard; do not add a root barrel.

`Alert`, `Badge`, `Button`, `Dialog`, `DropdownMenu`, `Empty`, and `Spinner` are
registry-managed shared primitives. Install or update them only through the
shadcn CLI in `packages/ui`. Apps compose these exports into product components;
they must not maintain app-local reimplementations.

An app-specific product component belongs under that app's normal component
directory. Build it by composing shared primitives instead of adding it to
`packages/ui`.

## Variants

Use the variants published by a shared primitive before adding classes. Add a
shared variant only when it represents the same reusable semantic intent in more
than one app and does not include product layout or behavior. Placement, width,
and one-off layout remain at the call site.

`Button` follows the shadcn Base UI API:

- `variant`: `default`, `outline`, `secondary`, `ghost`, `destructive`, `link`
- `size`: `default`, `xs`, `sm`, `lg`, `icon`, `icon-xs`, `icon-sm`, `icon-lg`
- Render links as anchors or Next `Link` and apply `buttonVariants`.
- Compose loading with `Spinner`, native `disabled`, and `aria-busy`; do not add
  `isLoading`.

Use dedicated `Item`, `CommandItem`, `RadioGroup`, `Checkbox`, `Select`, `Menu`,
or Button/Link semantics instead of making a single list row emulate all
interactions.

## Themes And Tailwind

`@jongminchung/ui/globals.css` imports Tailwind, `tw-animate-css`, the theme
contract, and only the shared UI source tree. Each app imports that entrypoint,
then its local `theme.css`, and registers its own source tree with `@source`.

Every app defines complete OKLCH provider values. Product roles such as terminal
colors or status panels remain local unless multiple apps share the same meaning
and consumer contract.

Use semantic variables, the shared radius scale, and `color-mix(in oklch, ...)`.
Normal UI code must not use palette utilities or hex, RGB, or HSL literals.
Renderer boundaries that cannot consume CSS variables require an exact,
documented test allowlist.

## Runtime Boundaries

Next apps default to Server Components. A shared component marked `"use client"`
creates a client boundary only when imported by rendered server output; static
shells, links, and document content stay server-rendered. Keep providers inside
the smallest interactive subtree that needs them.

`apps/engineering-docs` and `apps/readme` transpile `@jongminchung/ui`. The Vite
Git Client consumes the same source package and deduplicates `react` and
`react-dom`.

All workspaces use the same latest stable TypeScript 6 compiler. A compiler
major is adopted only after the Compiler API, framework builds, package tooling,
editor integration, and release graph work with one workspace-wide version;
split or dual-compiler production configurations are not supported.

Product behavior stays local. For example, Git Client dismissal policy,
inline/fullscreen dialog layout, navigation, and command execution belong to its
`Product*` components and controllers.

## Verification

Contract tests verify components.json routing, package exports,
token/radius/variant contracts, the absence of app-local primitive copies, and
the absence of direct Base UI imports. Behavior tests cover native Button/link
semantics, Dialog dismissal and focus, Field announcements, mixed checkboxes,
Item roles, and Command keyboard navigation. Review Playwright screenshots
instead of updating snapshots to conceal a visual change.
