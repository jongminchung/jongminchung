# ADR 0001: Shared shadcn primitive source package

- Status: Accepted
- Date: 2026-07-30

## Context

The workspace previously required each app to own shadcn primitives and made Button a direct
Base UI exception. That policy duplicated the same primitive recipes across hundreds of call
sites, allowed accessibility contracts to drift, and did not match shadcn's documented monorepo
routing model.

The three applications still need independent themes and product behavior. The Electron client
also needs dismissal and virtual-anchor behavior that does not belong in a general primitive API.

## Decision

Create `@jongminchung/ui` as a private source package following the official shadcn monorepo
structure. It owns:

- shadcn Base UI primitives
- the `cn` utility
- the shared Tailwind and animation entrypoint
- explicit `components/*`, `lib/*`, and `globals.css` exports

It does not own:

- app `theme.css` values
- product components or application state
- Electron-specific dialog, menu, navigation, or command behavior

All app `components.json` files route `ui` and `utils` to the shared package while keeping
`components`, `hooks`, and `lib` local. Next apps use `rsc: true`; Git Client uses `rsc: false`.

Button uses the official variants and sizes. Anchors and Next links use `buttonVariants`; loading
is composed from `Spinner`, `disabled`, and `aria-busy`.

New registry primitives are added from `packages/ui` with
`pnpm exec shadcn add <component>`. Shared variants require cross-app semantic meaning. Product
variants and platform behavior remain app-local compositions.

## Consequences

- Primitive updates and accessibility fixes have one source.
- Apps keep visual identity through local OKLCH themes and product tokens.
- Imports are explicit and tree-shakeable because there is no root barrel.
- Next server boundaries remain visible and reviewable.
- Vite must deduplicate React, and Next must transpile the source package.
- Workspace alias tooling and tests must preserve wildcard export captures.

## References

- [shadcn monorepo documentation](https://ui.shadcn.com/docs/monorepo)
- [shadcn templates](https://github.com/shadcn-ui/ui/tree/main/templates)
- [Next.js Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components)
