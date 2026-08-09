## Packages

This repository owns the shared `@jongminchung` packages used by downstream projects.

- `@jongminchung/tooling`: shared `oxfmt`, `oxlint`, and package-map configuration.
- `@jongminchung/remark-plantuml`: shared PlantUML rendering for Markdown and Astro docs.
- `@jongminchung/theme-contract`: private CSS-only adapter for the apps' shared semantic vocabulary.

Public packages are published to GitHub Packages. Consumers need the `@jongminchung` scope mapped
to `https://npm.pkg.github.com`.

The apps own their theme values and components. See [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) for the
token contract, component ownership rules, and runtime exception policy.

## Workspace scripts

Repository-wide scripts are owned by the workspace root. Use `-w` so they resolve to the root even
when the current directory is inside an app or package:

```bash
pnpm -w run fmt
pnpm -w run check
pnpm -w run audit:prod
```

Always include `run` for package scripts. The shorter `pnpm fmt` form can fall through to an
unrelated system command when the current package does not define `fmt`.

`audit:prod` queries the registry advisory database and fails on high-severity production
dependency findings. It runs in the scheduled security workflow instead of the offline-reproducible
`check` chain.

Each workspace owns its build, typecheck, and test commands. Select one with a filter instead of
adding a package-specific wrapper to the root manifest:

```bash
pnpm --filter @jongminchung/engineering-docs run build
```

## Version Policy

Published package versions are immutable. Increment the stable SemVer version before publishing
changed contents: patch for compatible fixes, minor for compatible features, and major for breaking
contracts. Never delete and republish an existing version.

```bash
pnpm install
pnpm run check
pnpm run publish:dry-run
```

<!-- prettier-ignore-start -->

<!--START_SECTION:waka-->
![AI Code Time](http://img.shields.io/badge/AI%20Code%20Time-599%20hrs%2042%20mins-blue?style=flat)

**I'm a Night 🦉** 

```text
🌞 Morning                864 commits         ███░░░░░░░░░░░░░░░░░░░░░░   10.06 % 
🌆 Daytime                1767 commits        █████░░░░░░░░░░░░░░░░░░░░   20.58 % 
🌃 Evening                3482 commits        ██████████░░░░░░░░░░░░░░░   40.55 % 
🌙 Night                  2474 commits        ███████░░░░░░░░░░░░░░░░░░   28.81 % 
```


📊 **This Week I Spent My Time On** 

```text
💬 Programming Languages: 
YAML                     7 hrs 39 mins       █████░░░░░░░░░░░░░░░░░░░░   21.78 % 
Markdown                 6 hrs 49 mins       █████░░░░░░░░░░░░░░░░░░░░   19.41 % 
Other                    5 hrs 25 mins       ████░░░░░░░░░░░░░░░░░░░░░   15.40 % 
Java                     3 hrs 22 mins       ██░░░░░░░░░░░░░░░░░░░░░░░   09.61 % 
TypeScript               2 hrs 41 mins       ██░░░░░░░░░░░░░░░░░░░░░░░   07.65 % 
```

🤖 **AI Coding This Week** 

```text
⏱ AI Coding Time: 30 hrs 35 mins (86.94%)

✍️ 36,045 lines written by AI, 566 lines written by hand (98.45% AI-written)

🔤 498,646,478 Input Tokens, 4,568,475 Output Tokens

💵 $2608.20 Estimated AI Cost This Week

🧠 89 AI Sessions, 420 AI Prompts

GPT                      36,984 lines        █████████████████████████   98.76 % 
Claude-Code              282 lines           ░░░░░░░░░░░░░░░░░░░░░░░░░   00.75 % 
Sonnet                   182 lines           ░░░░░░░░░░░░░░░░░░░░░░░░░   00.49 % 
Vscode-Wakatime          0 lines             ░░░░░░░░░░░░░░░░░░░░░░░░░   00.00 % 
Codex-Cli                0 lines             ░░░░░░░░░░░░░░░░░░░░░░░░░   00.00 % 

🔎 AI Coding Insights:
🤖 AI-Driven — 98.45% of written lines came from AI
📄 Detailed Prompter — average 685 characters per prompt
🔁 Iterative Prompter — average 5 prompts per session
🚀 High AI Trust — 3.84% of changed lines were hand-edited
```


<!--END_SECTION:waka-->

<!-- prettier-ignore-end -->
