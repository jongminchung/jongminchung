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
🌞 Morning                813 commits         ██░░░░░░░░░░░░░░░░░░░░░░░   09.61 %
🌆 Daytime                1716 commits        █████░░░░░░░░░░░░░░░░░░░░   20.29 %
🌃 Evening                3482 commits        ██████████░░░░░░░░░░░░░░░   41.16 %
🌙 Night                  2448 commits        ███████░░░░░░░░░░░░░░░░░░   28.94 %
```

📊 **This Week I Spent My Time On**

```text
💬 Programming Languages:
Markdown                 17 hrs 42 mins      ███████░░░░░░░░░░░░░░░░░░   27.91 %
YAML                     11 hrs 4 mins       ████░░░░░░░░░░░░░░░░░░░░░   17.44 %
TypeScript               9 hrs 34 mins       ████░░░░░░░░░░░░░░░░░░░░░   15.10 %
Other                    7 hrs 43 mins       ███░░░░░░░░░░░░░░░░░░░░░░   12.18 %
Go                       6 hrs 45 mins       ███░░░░░░░░░░░░░░░░░░░░░░   10.64 %
```

<!--END_SECTION:waka-->
