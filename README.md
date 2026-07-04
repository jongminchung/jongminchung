## Packages

This repository owns the shared `@jongminchung` packages used by downstream projects.

- `@jongminchung/tooling`: shared `oxfmt`, `oxlint`, and package-map configuration.
- `@jongminchung/remark-plantuml`: shared PlantUML rendering for Markdown and Astro docs.
- `@jongminchung/ui`: React and Tailwind design primitives.

Packages are published to GitHub Packages. Consumers need the `@jongminchung` scope mapped to
`https://npm.pkg.github.com`.

## Version Policy

`@jongminchung/tooling`, `@jongminchung/remark-plantuml`, and `@jongminchung/ui` intentionally stay
on `1.0.0`. Reuse and republish `1.0.0` when correcting package contents. Do not publish `1.0.1`,
`1.0.2`, or other replacement versions for these packages.

```bash
bun install
bun run check
bun run publish:dry-run
```

<!--START_SECTION:waka-->
**I'm a Night 🦉** 

```text
🌞 Morning                815 commits         ██░░░░░░░░░░░░░░░░░░░░░░░   09.60 % 
🌆 Daytime                1741 commits        █████░░░░░░░░░░░░░░░░░░░░   20.51 % 
🌃 Evening                3484 commits        ██████████░░░░░░░░░░░░░░░   41.05 % 
🌙 Night                  2448 commits        ███████░░░░░░░░░░░░░░░░░░   28.84 % 
```


📊 **This Week I Spent My Time On** 

```text
💬 Programming Languages: 
Markdown                 17 hrs 4 mins       ███████░░░░░░░░░░░░░░░░░░   26.39 % 
YAML                     11 hrs 45 mins      █████░░░░░░░░░░░░░░░░░░░░   18.17 % 
Go                       9 hrs 22 mins       ████░░░░░░░░░░░░░░░░░░░░░   14.48 % 
Other                    7 hrs 56 mins       ███░░░░░░░░░░░░░░░░░░░░░░   12.28 % 
TypeScript               7 hrs 26 mins       ███░░░░░░░░░░░░░░░░░░░░░░   11.49 % 
```


<!--END_SECTION:waka-->
