## Packages

This repository owns the shared `@jongminchung` packages used by downstream projects.

- `@jongminchung/tooling`: shared `oxfmt`, `oxlint`, and package-map configuration.
- `@jongminchung/remark-plantuml`: shared PlantUML rendering for Markdown and Astro docs.

Packages are published to GitHub Packages. Consumers need the `@jongminchung` scope mapped to
`https://npm.pkg.github.com`.

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
🌞 Morning                819 commits         ██░░░░░░░░░░░░░░░░░░░░░░░   09.55 % 
🌆 Daytime                1770 commits        █████░░░░░░░░░░░░░░░░░░░░   20.65 % 
🌃 Evening                3505 commits        ██████████░░░░░░░░░░░░░░░   40.89 % 
🌙 Night                  2478 commits        ███████░░░░░░░░░░░░░░░░░░   28.91 % 
```


📊 **This Week I Spent My Time On** 

```text
💬 Programming Languages: 
Java                     11 hrs 42 mins      ███████░░░░░░░░░░░░░░░░░░   28.64 % 
YAML                     8 hrs 20 mins       █████░░░░░░░░░░░░░░░░░░░░   20.38 % 
TypeScript               7 hrs 57 mins       █████░░░░░░░░░░░░░░░░░░░░   19.47 % 
Markdown                 6 hrs 11 mins       ████░░░░░░░░░░░░░░░░░░░░░   15.15 % 
Other                    3 hrs 3 mins        ██░░░░░░░░░░░░░░░░░░░░░░░   07.48 % 
```


<!--END_SECTION:waka-->
