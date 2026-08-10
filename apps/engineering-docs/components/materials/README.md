# Material source ownership

`topics/` is a checked-in vendor snapshot imported from the sibling `kciter.github.io` source.
Files under that directory are not ordinary first-party application code: they keep the upstream
`@ts-nocheck` marker and are replaced by the import pipeline.

Do not edit vendored topic files directly. Refresh them with:

```sh
node apps/engineering-docs/scripts/import-kciter-materials.ts \
  --source=/absolute/path/to/kciter.github.io/src/materials
pnpm --filter @jongminchung/engineering-docs materials:build
```

The small allowlist in `scripts/material-ownership.ts` contains application-owned overrides. The
importer preserves these files, and they must remain type-checked and linted. Runtime adapters in
`runtime/`, the registry contract in `types.ts`, and the rendering shell are also first-party code.

`pnpm --filter @jongminchung/engineering-docs materials:check` verifies ownership markers, lints
the application-owned overrides, validates the rendering policy, and checks generated registries.
