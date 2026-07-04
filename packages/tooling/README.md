# @jongminchung/tooling

Shared lint and format tooling for TypeScript workspaces.

## Install

```bash
npm install --save-dev @jongminchung/tooling
```

The binaries load a project-local config first. If no local config exists, they use this package's
generic defaults.

The maintained source is TypeScript. Published package entrypoints and CLI binaries run from built
JavaScript under `dist`, with declarations generated from the same source.

## Package scripts

```json
{
  "scripts": {
    "lint": "jongminchung-oxlint",
    "fmt": "jongminchung-oxfmt",
    "fmt:check": "jongminchung-oxfmt --check",
    "check:package-boundaries": "jongminchung-eslint packages website"
  }
}
```

Config files that take priority:

- ESLint: `eslint.config.{js,mjs,cjs,ts,mts,cts}`
- oxlint: `.oxlintrc.{json,jsonc}` or `oxlint.config.{js,mjs,cjs,ts}`
- oxfmt: `.oxfmtrc.{json,jsonc,js,mjs,cjs,ts}` or `oxfmt.config.{js,mjs,cjs,ts}`

## ESLint package boundaries

Project-specific package tags stay in the consuming repo:

```js
import { createPackageBoundaryEslintConfig } from "@jongminchung/tooling/eslint";

export default createPackageBoundaryEslintConfig({
  depConstraints: [
    {
      sourceTag: "pkg:web",
      onlyDependOnLibsWithTags: ["pkg:web", "pkg:ui"],
    },
    {
      sourceTag: "pkg:ui",
      onlyDependOnLibsWithTags: ["pkg:ui"],
    },
  ],
});
```

## oxlint

```js
import { defineOxlintConfig } from "@jongminchung/tooling/oxlint";

export default defineOxlintConfig({
  rules: {
    "typescript/no-explicit-any": "error",
  },
});
```

JSON configs can extend the default file:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "extends": ["./node_modules/@jongminchung/tooling/src/oxlint/base.json"]
}
```

## oxfmt

```js
import { defineOxfmtConfig } from "@jongminchung/tooling/oxfmt";

export default defineOxfmtConfig({
  ignorePatterns: ["dist/", "coverage/", "generated/"],
});
```

## Package map aliases

Monorepos can derive TypeScript and Vite aliases from workspace package manifests:

```js
import {
  createTsconfigAliasConfig,
  createViteResolveAliases,
} from "@jongminchung/tooling/package-map";

export default {
  resolve: {
    alias: createViteResolveAliases(),
  },
};
```

By default, package-map reads the consuming repo at `process.cwd()` and only derives aliases from
workspace package `exports`. Repo-local aliases are opt-in:

```js
import { createViteResolveAliases } from "@jongminchung/tooling/package-map";

export default {
  resolve: {
    alias: createViteResolveAliases({
      rootDir: import.meta.dirname,
      localSourceAliases: [
        {
          find: /^@\//,
          replacementPath: "src",
          tsconfigKey: "@/*",
          tsconfigTarget: "./src/*",
        },
      ],
    }),
  },
};
```

If a package export has a `source` condition, local aliases prefer that source file. Published npm
consumers use the standard `types`, `import`, and `default` conditions.

## Build and pack

```bash
bun run build
npm pack --dry-run
```

`bun run build` uses `tsdown` in unbundle mode so the published `dist` tree mirrors the
TypeScript source module structure while still shipping JavaScript runtime files.

The npm package includes built CLI bins, compiled ESM JavaScript, generated declarations,
`LICENSE`, `README.md`, and `package.json`.
