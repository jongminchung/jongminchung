## Packages

This repository owns the shared `@jongminchung` packages used by downstream projects.

- `@jongminchung/tooling`: shared `oxfmt`, `oxlint`, and package-map configuration.
- `@jongminchung/remark-plantuml`: shared PlantUML rendering for Markdown and Astro docs.

Packages are published to GitHub Packages. Consumers need the `@jongminchung` scope mapped to
`https://npm.pkg.github.com`.

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
pnpm --filter @jongminchung/docs run build
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
🌞 Morning                787 commits         ██░░░░░░░░░░░░░░░░░░░░░░░   09.20 % 
🌆 Daytime                1796 commits        █████░░░░░░░░░░░░░░░░░░░░   21.00 % 
🌃 Evening                3492 commits        ██████████░░░░░░░░░░░░░░░   40.83 % 
🌙 Night                  2477 commits        ███████░░░░░░░░░░░░░░░░░░   28.96 % 
```


📊 **This Week I Spent My Time On** 

```text
💬 Programming Languages: 
TypeScript               14 hrs 5 mins       ███████░░░░░░░░░░░░░░░░░░   29.50 % 
YAML                     7 hrs 26 mins       ████░░░░░░░░░░░░░░░░░░░░░   15.59 % 
Java                     6 hrs 32 mins       ███░░░░░░░░░░░░░░░░░░░░░░   13.70 % 
JSON                     4 hrs 9 mins        ██░░░░░░░░░░░░░░░░░░░░░░░   08.73 % 
Bash                     3 hrs 12 mins       ██░░░░░░░░░░░░░░░░░░░░░░░   06.72 % 
```


<!--END_SECTION:waka-->

<!-- prettier-ignore-end -->
