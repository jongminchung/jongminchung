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
🌞 Morning                817 commits         ██░░░░░░░░░░░░░░░░░░░░░░░   09.56 % 
🌆 Daytime                1765 commits        █████░░░░░░░░░░░░░░░░░░░░   20.65 % 
🌃 Evening                3492 commits        ██████████░░░░░░░░░░░░░░░   40.86 % 
🌙 Night                  2472 commits        ███████░░░░░░░░░░░░░░░░░░   28.93 % 
```


📊 **This Week I Spent My Time On** 

```text
💬 Programming Languages: 
Markdown                 15 hrs 43 mins      ██████░░░░░░░░░░░░░░░░░░░   24.25 % 
YAML                     14 hrs 29 mins      ██████░░░░░░░░░░░░░░░░░░░   22.36 % 
Go                       8 hrs 48 mins       ███░░░░░░░░░░░░░░░░░░░░░░   13.58 % 
Other                    7 hrs 42 mins       ███░░░░░░░░░░░░░░░░░░░░░░   11.89 % 
TypeScript               6 hrs 50 mins       ███░░░░░░░░░░░░░░░░░░░░░░   10.57 % 
```


<!--END_SECTION:waka-->
