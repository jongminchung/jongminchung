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
npm install --save-dev @jongminchung/tooling oxfmt oxlint oxlint-tsgolint
```

Install the actual formatter and linter in each consuming project. This package only centralizes the
shared settings. `oxlint-tsgolint` is required because the shared Oxlint config enables type-aware
rules.

The package ships ESM only. `defineOxfmtConfig` and `defineOxlintConfig` are its JavaScript APIs,
and CommonJS `require()` is not part of the supported package contract.

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
    "lint": "oxlint --config oxlint.config.ts .",
    "fmt": "oxfmt --config .oxfmtrc.ts",
    "fmt:check": "oxfmt --config .oxfmtrc.ts --check"
  }
}
```

## oxlint

Oxlint configs extend the shared TypeScript config without adding workspace-local rule sets:

```ts
import { defineOxlintConfig } from "@jongminchung/tooling/oxlint";

export default defineOxlintConfig({
  ignorePatterns: ["generated/**"],
});
```

The shared config enables Oxlint's official `correctness` category at error level and activates the
TypeScript, Unicorn, Oxc, React, and JSX accessibility plugins. Recommended rules supplied by that
category and those plugins—including Hooks, ARIA, Promise handling, and unused-code checks—are not
listed a second time.

Only repository policy outside the recommended set is explicit. Every explicit rule and exception
has a reason plus an executable bad/good example immediately above it:

```ts
defineOxlintConfig({
  rules: {
    // any removes checking from every later property access, so narrow an external boundary instead
    // Bad: (window as any).desktopApi
    // Good: extend Window and access window.desktopApi through the declared contract
    "typescript/no-explicit-any": "error",

    // role=group does not always mean fieldset, which could change non-form UI semantics
    // Allowed: <div role="group" aria-label="Editor tools">...</div>
    // Rejected elsewhere: <div role="button">...</div> remains covered by recommended a11y rules
    "jsx-a11y/prefer-tag-over-role": "off",
  },
});
```

The other explicit policies are `prefer-const`, type-aware `no-misused-promises`, shared control
names for `label-has-associated-control`, and named scroll regions for
`no-noninteractive-tabindex`.

## oxfmt

```js
import { defineOxfmtConfig } from "@jongminchung/tooling/oxfmt";

export default defineOxfmtConfig({
  // Source: content/topic files; generated counterpart: tracked manifests and search indexes.
  ignorePatterns: ["generated/", "public/search/"],
});
```

Formatting style stays on Oxfmt's zero-config defaults: width, quotes, semicolons, trailing commas,
and indentation are not copied into this package. The shared implementation adds only two
repository decisions: imports use Oxfmt's default group ordering without blank lines between groups,
and `package.json` sorting remains disabled unless a consumer enables it explicitly.

For example, mixed local/external imports become one ordered block. Ignore and override arrays
append to shared output exclusions. Object forms of `sortImports` merge with the repository
decision, while `sortPackageJson` accepts Oxfmt's native `true`, `false`, and object forms without
a shared default.

## Build and pack

```bash
pnpm run build
npm pack --dry-run
```

`pnpm run build` uses TypeScript `tsc` with the shared Node library configuration. It emits only the
explicit public entry points as ESM JavaScript and declarations while preserving their source module
structure.

The npm package includes the compiled Oxfmt and Oxlint modules, declarations, `LICENSE`, `README.md`,
and `package.json`. It does not include a bundle or a separate CommonJS build.
