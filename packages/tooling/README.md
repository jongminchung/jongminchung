# @jongminchung/tooling

Shared lint, format, and package-map configuration for TypeScript workspaces.

## Install

Node.js 24 or newer is required.

```bash
npm install --save-dev @jongminchung/tooling
```

Install the actual formatter and linter in each consuming project. This package only centralizes the
shared settings.

The package ships ESM only and exposes every runtime API as a named export. Use ESM `import` for
every JavaScript entry point; CommonJS `require()` is not part of the supported package contract.

## Version Policy

The manual package workflow always replaces the personal `1.0.0` package version.

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
consumers use the standard `types` and `default` conditions.

## Build and pack

```bash
pnpm run build
npm pack --dry-run
```

`pnpm run build` uses TypeScript `tsc` with the shared Node library configuration. It emits only the
explicit public entry points as ESM JavaScript and declarations while preserving their source module
structure.

The npm package includes compiled ESM JavaScript, generated declarations, source config files, the
directly exported Oxlint JSON asset, `LICENSE`, `README.md`, and `package.json`. It does not include a
bundle or a separate CommonJS build.
