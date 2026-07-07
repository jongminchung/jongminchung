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
🌞 Morning                773 commits         ██░░░░░░░░░░░░░░░░░░░░░░░   09.26 % 
🌆 Daytime                1711 commits        █████░░░░░░░░░░░░░░░░░░░░   20.49 % 
🌃 Evening                3411 commits        ██████████░░░░░░░░░░░░░░░   40.85 % 
🌙 Night                  2456 commits        ███████░░░░░░░░░░░░░░░░░░   29.41 % 
```


📊 **This Week I Spent My Time On** 

```text
💬 Programming Languages: 
YAML                     16 hrs 22 mins      ██████░░░░░░░░░░░░░░░░░░░   24.88 % 
Markdown                 13 hrs 49 mins      █████░░░░░░░░░░░░░░░░░░░░   21.01 % 
Java                     10 hrs 6 mins       ████░░░░░░░░░░░░░░░░░░░░░   15.35 % 
Go                       8 hrs 34 mins       ███░░░░░░░░░░░░░░░░░░░░░░   13.02 % 
Other                    7 hrs 37 mins       ███░░░░░░░░░░░░░░░░░░░░░░   11.58 % 
```


<!--END_SECTION:waka-->
