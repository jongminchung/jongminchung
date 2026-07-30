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
```

Always include `run` for package scripts. The shorter `pnpm fmt` form can fall through to an
unrelated system command when the current package does not define `fmt`.

Each workspace owns its build, typecheck, and test commands. Select one with a filter instead of
adding a package-specific wrapper to the root manifest:

```bash
pnpm --filter @jongminchung/engineering-docs run build
```

## Version Policy

`@jongminchung/tooling` and `@jongminchung/remark-plantuml` intentionally stay on `1.0.0`. Reuse
and republish `1.0.0` when correcting package contents. Do not publish `1.0.1`, `1.0.2`, or other
replacement versions for these packages.

```bash
pnpm install
pnpm run check
pnpm run publish:dry-run
```

<!-- prettier-ignore-start -->

<!--START_SECTION:waka-->
![AI Code Time](http://img.shields.io/badge/AI%20Code%20Time-559%20hrs%204%20mins-blue?style=flat)

**I'm a Night 🦉** 

```text
🌞 Morning                827 commits         ██░░░░░░░░░░░░░░░░░░░░░░░   09.56 % 
🌆 Daytime                1797 commits        █████░░░░░░░░░░░░░░░░░░░░   20.76 % 
🌃 Evening                3543 commits        ██████████░░░░░░░░░░░░░░░   40.94 % 
🌙 Night                  2487 commits        ███████░░░░░░░░░░░░░░░░░░   28.74 % 
```


📊 **This Week I Spent My Time On** 

```text
💬 Programming Languages: 
Bash                     3 hrs 44 mins       ██████░░░░░░░░░░░░░░░░░░░   22.18 % 
TypeScript               2 hrs 59 mins       ████░░░░░░░░░░░░░░░░░░░░░   17.73 % 
YAML                     2 hrs 50 mins       ████░░░░░░░░░░░░░░░░░░░░░   16.92 % 
Java                     2 hrs 21 mins       ████░░░░░░░░░░░░░░░░░░░░░   14.02 % 
Markdown                 1 hr 52 mins        ███░░░░░░░░░░░░░░░░░░░░░░   11.14 % 
```

🤖 **AI Coding This Week** 

```text
⏱ AI Coding Time: 15 hrs 14 mins (90.55%)

✍️ 9,393 lines written by AI, 233 lines written by hand (97.58% AI-written)

🔤 777,418,474 Input Tokens, 3,475,549 Output Tokens

💵 $4074.27 Estimated AI Cost This Week

🧠 54 AI Sessions, 233 AI Prompts

GPT                      10,977 lines        █████████████████████████   100.00 % 
Vscode-Wakatime          0 lines             ░░░░░░░░░░░░░░░░░░░░░░░░░   00.00 % 
Opencode-Cli             0 lines             ░░░░░░░░░░░░░░░░░░░░░░░░░   00.00 % 

🔎 AI Coding Insights:
🤖 AI-Driven — 97.58% of written lines came from AI
📄 Detailed Prompter — average 821 characters per prompt
🔁 Iterative Prompter — average 4 prompts per session
🚀 High AI Trust — 3.4% of changed lines were hand-edited
```


<!--END_SECTION:waka-->

<!-- prettier-ignore-end -->
