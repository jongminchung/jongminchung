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
pnpm install
pnpm run check
pnpm run publish:dry-run
```

<!--START_SECTION:waka-->
**I'm a Night 🦉** 

```text
🌞 Morning                773 commits         ██░░░░░░░░░░░░░░░░░░░░░░░   09.24 % 
🌆 Daytime                1715 commits        █████░░░░░░░░░░░░░░░░░░░░   20.50 % 
🌃 Evening                3418 commits        ██████████░░░░░░░░░░░░░░░   40.86 % 
🌙 Night                  2459 commits        ███████░░░░░░░░░░░░░░░░░░   29.40 % 
```


📊 **This Week I Spent My Time On** 

```text
💬 Programming Languages: 
Java                     14 hrs 22 mins      ██████░░░░░░░░░░░░░░░░░░░   23.81 % 
YAML                     14 hrs 7 mins       ██████░░░░░░░░░░░░░░░░░░░   23.38 % 
Markdown                 9 hrs 51 mins       ████░░░░░░░░░░░░░░░░░░░░░   16.31 % 
TypeScript               7 hrs 44 mins       ███░░░░░░░░░░░░░░░░░░░░░░   12.82 % 
Go                       4 hrs 9 mins        ██░░░░░░░░░░░░░░░░░░░░░░░   06.88 % 
```


<!--END_SECTION:waka-->
