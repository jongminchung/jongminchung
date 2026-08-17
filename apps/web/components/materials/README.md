# Material source ownership

`topics/` is the checked-in canonical source for Engineering Docs materials. Edit these files in
this repository, keep them compatible with the shared strict TypeScript and Oxlint configuration,
and preserve each document's `sourceUrl` as attribution rather than as a runtime dependency.

The application-owned boundary includes `topics/`, the public component contract in `types.ts`,
and the rendering shell. Topic exports are independent React components without a shared animation
or drawing runtime.

After changing a topic export, rebuild the tracked registry and manifest:

```sh
pnpm --filter @jongminchung/web run materials:build
pnpm --filter @jongminchung/web run materials:check
```

`materials:check` reads each topic index through the TypeScript AST, validates the localized MDX ID
sets, and rejects stale registry, manifest, or exact ID types. The generated registry uses static
module export access and `satisfies MaterialManifestEntry`, so a renamed export or incompatible
required component prop also fails the Engineering Docs typecheck.
