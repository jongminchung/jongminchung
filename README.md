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
🌞 Morning                777 commits         ██░░░░░░░░░░░░░░░░░░░░░░░   09.23 % 
🌆 Daytime                1741 commits        █████░░░░░░░░░░░░░░░░░░░░   20.68 % 
🌃 Evening                3439 commits        ██████████░░░░░░░░░░░░░░░   40.85 % 
🌙 Night                  2462 commits        ███████░░░░░░░░░░░░░░░░░░   29.24 % 
```


📊 **This Week I Spent My Time On** 

```text
💬 Programming Languages: 
TypeScript               17 hrs 2 mins       ████████░░░░░░░░░░░░░░░░░   30.78 % 
YAML                     9 hrs 14 mins       ████░░░░░░░░░░░░░░░░░░░░░   16.70 % 
Java                     5 hrs 31 mins       ██░░░░░░░░░░░░░░░░░░░░░░░   09.97 % 
JSON                     4 hrs 11 mins       ██░░░░░░░░░░░░░░░░░░░░░░░   07.59 % 
Other                    3 hrs 46 mins       ██░░░░░░░░░░░░░░░░░░░░░░░   06.83 % 
```


<!--END_SECTION:waka-->

<!-- prettier-ignore-end -->
