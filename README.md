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
![AI Code Time](http://img.shields.io/badge/AI%20Code%20Time-596%20hrs%2030%20mins-blue?style=flat)

**I'm a Night 🦉** 

```text
🌞 Morning                884 commits         ███░░░░░░░░░░░░░░░░░░░░░░   10.36 % 
🌆 Daytime                1748 commits        █████░░░░░░░░░░░░░░░░░░░░   20.48 % 
🌃 Evening                3423 commits        ██████████░░░░░░░░░░░░░░░   40.11 % 
🌙 Night                  2480 commits        ███████░░░░░░░░░░░░░░░░░░   29.06 % 
```


📊 **This Week I Spent My Time On** 

```text
💬 Programming Languages: 
YAML                     7 hrs 38 mins       ██████░░░░░░░░░░░░░░░░░░░   23.90 % 
Markdown                 5 hrs 40 mins       ████░░░░░░░░░░░░░░░░░░░░░   17.71 % 
Other                    5 hrs 24 mins       ████░░░░░░░░░░░░░░░░░░░░░   16.89 % 
Java                     3 hrs 22 mins       ███░░░░░░░░░░░░░░░░░░░░░░   10.57 % 
Python                   2 hrs 1 min         ██░░░░░░░░░░░░░░░░░░░░░░░   06.31 % 
```

🤖 **AI Coding This Week** 

```text
⏱ AI Coding Time: 27 hrs 24 mins (85.64%)

✍️ 31,012 lines written by AI, 562 lines written by hand (98.22% AI-written)

🔤 481,434,326 Input Tokens, 3,007,834 Output Tokens

💵 $2503.75 Estimated AI Cost This Week

🧠 67 AI Sessions, 379 AI Prompts

GPT                      31,781 lines        █████████████████████████   98.56 % 
Claude-Code              282 lines           ░░░░░░░░░░░░░░░░░░░░░░░░░   00.87 % 
Sonnet                   182 lines           ░░░░░░░░░░░░░░░░░░░░░░░░░   00.56 % 
Vscode-Wakatime          0 lines             ░░░░░░░░░░░░░░░░░░░░░░░░░   00.00 % 
Codex-Cli                0 lines             ░░░░░░░░░░░░░░░░░░░░░░░░░   00.00 % 

🔎 AI Coding Insights:
🤖 AI-Driven — 98.22% of written lines came from AI
📄 Detailed Prompter — average 527 characters per prompt
🔁 Iterative Prompter — average 6 prompts per session
🚀 High AI Trust — 4.42% of changed lines were hand-edited
```


<!--END_SECTION:waka-->

<!-- prettier-ignore-end -->
