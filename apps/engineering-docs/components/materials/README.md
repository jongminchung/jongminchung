# Material source ownership

`topics/` is the checked-in canonical source for Engineering Docs materials. Edit these files in
this repository, keep them compatible with the shared strict TypeScript and Oxlint configuration,
and preserve each document's `sourceUrl` as attribution rather than as a runtime dependency.

The application-owned boundary includes `topics/`, runtime adapters in `runtime/`, the public
component contract in `types.ts`, and the rendering shell. There is no sibling-repository importer,
ownership allowlist, or material-specific lint configuration.

After changing a topic export, rebuild the tracked registry and manifest:

```sh
pnpm --filter @jongminchung/engineering-docs run materials:build
pnpm --filter @jongminchung/engineering-docs run materials:check
```

`materials:check` validates the rendering policy and rejects a stale registry. The generated
registry uses static module export access and `satisfies MaterialManifestEntry`, so a renamed export
or incompatible required component prop also fails the Engineering Docs typecheck.

Rust source under `building-nes-emulator/core/` and tracked `wasm-bindgen` output under `pkg/` keep
their own toolchain boundary. The generated `pkg/` files are deployed with the app but excluded from
TypeScript, Oxlint, and Oxfmt input.
