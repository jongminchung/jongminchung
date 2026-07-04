# @jongminchung/tooling

Shared lint, format, and package-map configuration for TypeScript workspaces.

## Install

```bash
npm install --save-dev @jongminchung/tooling
```

Install the actual formatter and linter in each consuming project. This package only centralizes the
shared settings.

## Package scripts

```json
{
  "scripts": {
    "lint": "oxlint",
    "fmt": "oxfmt --config .oxfmtrc.mjs",
    "fmt:check": "oxfmt --config .oxfmtrc.mjs --check"
  }
}
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

`bun run build` uses `tsdown` in unbundle mode so the published `dist` tree mirrors the TypeScript
source module structure while still shipping JavaScript runtime files.

The npm package includes compiled ESM JavaScript, generated declarations, source config files,
`LICENSE`, `README.md`, and `package.json`.
