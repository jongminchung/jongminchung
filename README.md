## Packages

This repository owns the shared `@jongminchung` packages used by downstream projects.

- `@jongminchung/tooling`: shared `oxfmt`, `oxlint`, and package-map configuration.
- `@jongminchung/remark-plantuml`: shared PlantUML rendering for Markdown and Astro docs.
- `@jongminchung/theme-contract`: private CSS-only adapter for the apps' shared semantic vocabulary.

Public packages are published to GitHub Packages. Consumers need the `@jongminchung` scope mapped
to `https://npm.pkg.github.com`.

The apps own their theme values and components. See [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) for the
token contract, component ownership rules, and runtime exception policy.

## Workspace scripts

Repository-wide scripts are owned by the workspace root. Use `-w` so they resolve to the root even
when the current directory is inside an app or package:

```bash
pnpm -w run fmt
pnpm -w run check
```

Always include `run` for package scripts. The shorter `pnpm fmt` form can fall through to an
unrelated system command when the current package does not define `fmt`.

Each workspace owns its build, typecheck, and test commands. Select one with a filter instead of
adding a package-specific wrapper to the root manifest:

```bash
pnpm --filter @jongminchung/engineering-docs run build
```

## Version Policy

`@jongminchung/tooling` and `@jongminchung/remark-plantuml` intentionally stay on `1.0.0`. Reuse
and republish `1.0.0` when correcting package contents. Do not publish `1.0.1`, `1.0.2`, or other
replacement versions for these packages.

```bash
pnpm install
pnpm run check
pnpm run publish:dry-run
```

<!-- prettier-ignore-start -->

<!--START_SECTION:waka-->
**I'm a Night 🦉** 

```text
🌞 Morning                823 commits         ██░░░░░░░░░░░░░░░░░░░░░░░   09.53 % 
🌆 Daytime                1796 commits        █████░░░░░░░░░░░░░░░░░░░░   20.80 % 
🌃 Evening                3529 commits        ██████████░░░░░░░░░░░░░░░   40.87 % 
🌙 Night                  2487 commits        ███████░░░░░░░░░░░░░░░░░░   28.80 % 
```


📊 **This Week I Spent My Time On** 

```text
💬 Programming Languages: 
TypeScript               13 hrs 17 mins      ███████░░░░░░░░░░░░░░░░░░   29.07 % 
YAML                     8 hrs 24 mins       █████░░░░░░░░░░░░░░░░░░░░   18.39 % 
Java                     4 hrs 54 mins       ███░░░░░░░░░░░░░░░░░░░░░░   10.75 % 
Bash                     3 hrs 57 mins       ██░░░░░░░░░░░░░░░░░░░░░░░   08.67 % 
Other                    2 hrs 41 mins       █░░░░░░░░░░░░░░░░░░░░░░░░   05.88 % 
```


<!--END_SECTION:waka-->

<!-- prettier-ignore-end -->
