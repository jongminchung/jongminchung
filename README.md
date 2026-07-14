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

<!--START_SECTION:waka-->
**I'm a Night 🦉** 

```text
🌞 Morning                785 commits         ██░░░░░░░░░░░░░░░░░░░░░░░   09.23 % 
🌆 Daytime                1757 commits        █████░░░░░░░░░░░░░░░░░░░░   20.66 % 
🌃 Evening                3486 commits        ██████████░░░░░░░░░░░░░░░   41.00 % 
🌙 Night                  2475 commits        ███████░░░░░░░░░░░░░░░░░░   29.11 % 
```


📊 **This Week I Spent My Time On** 

```text
💬 Programming Languages: 
YAML                     6 hrs 34 mins       ██████░░░░░░░░░░░░░░░░░░░   23.54 % 
TypeScript               6 hrs 26 mins       ██████░░░░░░░░░░░░░░░░░░░   23.09 % 
Java                     6 hrs 16 mins       ██████░░░░░░░░░░░░░░░░░░░   22.47 % 
Markdown                 4 hrs 5 mins        ████░░░░░░░░░░░░░░░░░░░░░   14.67 % 
Other                    1 hr 42 mins        ██░░░░░░░░░░░░░░░░░░░░░░░   06.09 % 
```


<!--END_SECTION:waka-->
