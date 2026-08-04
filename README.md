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
![AI Code Time](http://img.shields.io/badge/AI%20Code%20Time-569%20hrs%208%20mins-blue?style=flat)

**I'm a Night 🦉** 

```text
🌞 Morning                791 commits         ██░░░░░░░░░░░░░░░░░░░░░░░   09.47 % 
🌆 Daytime                1710 commits        █████░░░░░░░░░░░░░░░░░░░░   20.48 % 
🌃 Evening                3393 commits        ██████████░░░░░░░░░░░░░░░   40.64 % 
🌙 Night                  2455 commits        ███████░░░░░░░░░░░░░░░░░░   29.40 % 
```


📊 **This Week I Spent My Time On** 

```text
💬 Programming Languages: 
Bash                     4 hrs 7 mins        ███████░░░░░░░░░░░░░░░░░░   26.22 % 
TypeScript               3 hrs 27 mins       █████░░░░░░░░░░░░░░░░░░░░   21.92 % 
YAML                     2 hrs 20 mins       ████░░░░░░░░░░░░░░░░░░░░░   14.84 % 
Markdown                 1 hr 46 mins        ███░░░░░░░░░░░░░░░░░░░░░░   11.22 % 
Java                     1 hr 6 mins         ██░░░░░░░░░░░░░░░░░░░░░░░   07.00 % 
```

🤖 **AI Coding This Week** 

```text
⏱ AI Coding Time: 15 hrs 27 mins (98.19%)

✍️ 20,864 lines written by AI, 19 lines written by hand (99.91% AI-written)

🔤 1,812,356,241 Input Tokens, 7,372,034 Output Tokens

💵 $2507.59 Estimated AI Cost This Week

🧠 76 AI Sessions, 231 AI Prompts

GPT                      22,357 lines        █████████████████████████   100.00 % 
Vscode-Wakatime          0 lines             ░░░░░░░░░░░░░░░░░░░░░░░░░   00.00 % 
Codex-Cli                0 lines             ░░░░░░░░░░░░░░░░░░░░░░░░░   00.00 % 
Opencode-Cli             0 lines             ░░░░░░░░░░░░░░░░░░░░░░░░░   00.00 % 

🔎 AI Coding Insights:
🤖 AI-Driven — 99.91% of written lines came from AI
📄 Detailed Prompter — average 1,182 characters per prompt
🔁 Iterative Prompter — average 3 prompts per session
🚀 High AI Trust — 0.08% of changed lines were hand-edited
```


<!--END_SECTION:waka-->

<!-- prettier-ignore-end -->
