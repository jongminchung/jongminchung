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
🌞 Morning                786 commits         ██░░░░░░░░░░░░░░░░░░░░░░░   09.24 % 
🌆 Daytime                1761 commits        █████░░░░░░░░░░░░░░░░░░░░   20.70 % 
🌃 Evening                3486 commits        ██████████░░░░░░░░░░░░░░░   40.97 % 
🌙 Night                  2475 commits        ███████░░░░░░░░░░░░░░░░░░   29.09 % 
```


📊 **This Week I Spent My Time On** 

```text
💬 Programming Languages: 
Java                     6 hrs 32 mins       ██████░░░░░░░░░░░░░░░░░░░   22.58 % 
YAML                     5 hrs 14 mins       █████░░░░░░░░░░░░░░░░░░░░   18.10 % 
TypeScript               4 hrs 55 mins       ████░░░░░░░░░░░░░░░░░░░░░   17.01 % 
JSON                     2 hrs 58 mins       ███░░░░░░░░░░░░░░░░░░░░░░   10.29 % 
Markdown                 2 hrs 16 mins       ██░░░░░░░░░░░░░░░░░░░░░░░   07.84 % 
```


<!--END_SECTION:waka-->
