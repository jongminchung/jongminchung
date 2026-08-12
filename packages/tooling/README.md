# @jongminchung/tooling

Shared lint and format configuration for TypeScript workspaces.

## Install

Node.js 24 or newer is required. Configure GitHub Packages with a classic personal access token
that has `read:packages`; public package downloads still require authentication.

```ini
@jongminchung:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_PACKAGES_TOKEN}
```

Keep the token in the environment rather than committing it to `.npmrc`.

```bash
npm install --save-dev @jongminchung/tooling oxfmt oxlint
```

Install the actual formatter and linter in each consuming project. This package only centralizes the
shared settings.

The package ships ESM only. `defineOxfmtConfig` is its only JavaScript API, and CommonJS
`require()` is not part of the supported package contract.

## Version Policy

The manual package workflow always replaces the personal `1.0.0` package version. It is a mutable
snapshot channel rather than a reproducible SemVer release. Refresh the downstream resolution and
commit the changed lockfile whenever a replacement is published:

```bash
pnpm update --force @jongminchung/tooling@1.0.0
```

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

Oxlint configs can extend the shared JSON file:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "extends": ["./node_modules/@jongminchung/tooling/oxlint.json"]
}
```

## oxfmt

```js
import { defineOxfmtConfig } from "@jongminchung/tooling/oxfmt";

export default defineOxfmtConfig({
  ignorePatterns: ["dist/", "coverage/", "generated/"],
  sortImports: { order: "asc" },
});
```

The public config and override types are aliases of Oxfmt's official types. Ignore and override
arrays append to the shared defaults. Object forms of `sortImports` and `sortPackageJson` merge with
the shared nested defaults, while booleans such as `false` replace them.

## Build and pack

```bash
pnpm run build
npm pack --dry-run
```

`pnpm run build` uses TypeScript `tsc` with the shared Node library configuration. It emits only the
explicit public entry points as ESM JavaScript and declarations while preserving their source module
structure.

The npm package includes the compiled Oxfmt module, declarations, the directly exported Oxlint JSON
asset, `LICENSE`, `README.md`, and `package.json`. It does not include a bundle or a separate CommonJS
build.
