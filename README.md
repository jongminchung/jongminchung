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
![AI Code Time](http://img.shields.io/badge/AI%20Code%20Time-579%20hrs%2032%20mins-blue?style=flat)

**I'm a Night 🦉** 

```text
🌞 Morning                794 commits         ██░░░░░░░░░░░░░░░░░░░░░░░   09.50 % 
🌆 Daytime                1710 commits        █████░░░░░░░░░░░░░░░░░░░░   20.46 % 
🌃 Evening                3397 commits        ██████████░░░░░░░░░░░░░░░   40.65 % 
🌙 Night                  2455 commits        ███████░░░░░░░░░░░░░░░░░░   29.38 % 
```


📊 **This Week I Spent My Time On** 

```text
💬 Programming Languages: 
Markdown                 3 hrs 42 mins       ████░░░░░░░░░░░░░░░░░░░░░   17.12 % 
YAML                     3 hrs 14 mins       ████░░░░░░░░░░░░░░░░░░░░░   14.98 % 
Bash                     3 hrs 10 mins       ████░░░░░░░░░░░░░░░░░░░░░   14.62 % 
TypeScript               2 hrs 27 mins       ███░░░░░░░░░░░░░░░░░░░░░░   11.36 % 
Other                    1 hr 43 mins        ██░░░░░░░░░░░░░░░░░░░░░░░   07.97 % 
```

🤖 **AI Coding This Week** 

```text
⏱ AI Coding Time: 20 hrs 33 mins (94.81%)

✍️ 27,514 lines written by AI, 186 lines written by hand (99.33% AI-written)

🔤 1,951,596,800 Input Tokens, 7,988,385 Output Tokens

💵 $3222.29 Estimated AI Cost This Week

🧠 80 AI Sessions, 261 AI Prompts

GPT                      29,206 lines        █████████████████████████   98.44 % 
Claude-Code              282 lines           ░░░░░░░░░░░░░░░░░░░░░░░░░   00.95 % 
Sonnet                   182 lines           ░░░░░░░░░░░░░░░░░░░░░░░░░   00.61 % 
Vscode-Wakatime          0 lines             ░░░░░░░░░░░░░░░░░░░░░░░░░   00.00 % 
Codex-Cli                0 lines             ░░░░░░░░░░░░░░░░░░░░░░░░░   00.00 % 

🔎 AI Coding Insights:
🤖 AI-Driven — 99.33% of written lines came from AI
📄 Detailed Prompter — average 1,145 characters per prompt
🔁 Iterative Prompter — average 3 prompts per session
🚀 High AI Trust — 1.42% of changed lines were hand-edited
```


<!--END_SECTION:waka-->

<!-- prettier-ignore-end -->
