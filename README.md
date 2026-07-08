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
🌞 Morning                819 commits         ██░░░░░░░░░░░░░░░░░░░░░░░   09.56 % 
🌆 Daytime                1768 commits        █████░░░░░░░░░░░░░░░░░░░░   20.64 % 
🌃 Evening                3500 commits        ██████████░░░░░░░░░░░░░░░   40.86 % 
🌙 Night                  2478 commits        ███████░░░░░░░░░░░░░░░░░░   28.93 % 
```


📊 **This Week I Spent My Time On** 

```text
💬 Programming Languages: 
YAML                     15 hrs 20 mins      ██████░░░░░░░░░░░░░░░░░░░   23.52 % 
Java                     12 hrs 43 mins      █████░░░░░░░░░░░░░░░░░░░░   19.50 % 
Markdown                 11 hrs 51 mins      █████░░░░░░░░░░░░░░░░░░░░   18.17 % 
Go                       6 hrs 37 mins       ███░░░░░░░░░░░░░░░░░░░░░░   10.15 % 
Other                    6 hrs 28 mins       ██░░░░░░░░░░░░░░░░░░░░░░░   09.92 % 
```


<!--END_SECTION:waka-->
