## Packages

This repository owns the shared `@jongminchung` packages used by downstream projects.

- `@jongminchung/tooling`: shared `oxfmt`, `oxlint`, and package-map configuration.
- `@jongminchung/remark-plantuml`: shared PlantUML rendering for Markdown and Astro docs.
- `@jongminchung/ui`: published shadcn primitives, a default neutral theme, shared Tailwind styles,
  and semantic tokens.

Public packages are published to GitHub Packages. Consumers need the `@jongminchung` scope mapped
to `https://npm.pkg.github.com`.

The UI package provides safe default theme values. Apps may override semantic tokens and continue
to own product components and behavior. See [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) for the token
contract, component ownership rules, and runtime exception policy.

## Documentation

- [Repository documentation](./docs/README.md)
- [Technology stack and official references](./docs/technology-stack.md)
- [Maintenance guide](./docs/maintenance.md)
- [Contributing guide](./CONTRIBUTING.md)

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
dependency findings. It requires network access and is run manually during maintenance and before
releases instead of being part of the offline-reproducible `check` chain.

Each workspace owns its build, typecheck, and test commands. Select one with a filter instead of
adding a package-specific wrapper to the root manifest:

```bash
pnpm --filter @jongminchung/engineering-docs run build
```

## Version Policy

The manually triggered package workflow always republishes the personal packages as `1.0.0`.
It removes an existing `1.0.0` package version immediately before uploading the replacement.
GitHub authentication is supplied only through the `GH_PAT` Actions secret.

```bash
pnpm install
pnpm run check
pnpm run publish:dry-run
```

<!-- prettier-ignore-start -->

<!--START_SECTION:waka-->
![AI Code Time](http://img.shields.io/badge/AI%20Code%20Time-611%20hrs%2039%20mins-blue?style=flat)

**I'm a Night 🦉** 

```text
🌞 Morning                842 commits         ██░░░░░░░░░░░░░░░░░░░░░░░   09.97 % 
🌆 Daytime                1736 commits        █████░░░░░░░░░░░░░░░░░░░░   20.55 % 
🌃 Evening                3409 commits        ██████████░░░░░░░░░░░░░░░   40.35 % 
🌙 Night                  2462 commits        ███████░░░░░░░░░░░░░░░░░░   29.14 % 
```


📊 **This Week I Spent My Time On** 

```text
💬 Programming Languages: 
Markdown                 8 hrs 54 mins       █████░░░░░░░░░░░░░░░░░░░░   18.86 % 
TypeScript               8 hrs 17 mins       ████░░░░░░░░░░░░░░░░░░░░░   17.54 % 
YAML                     7 hrs 52 mins       ████░░░░░░░░░░░░░░░░░░░░░   16.67 % 
Other                    6 hrs 38 mins       ████░░░░░░░░░░░░░░░░░░░░░   14.08 % 
Java                     4 hrs 22 mins       ██░░░░░░░░░░░░░░░░░░░░░░░   09.25 % 
```

🤖 **AI Coding This Week** 

```text
⏱ AI Coding Time: 40 hrs 22 mins (85.48%)

✍️ 48,336 lines written by AI, 1,607 lines written by hand (96.78% AI-written)

🔤 524,681,052 Input Tokens, 10,483,109 Output Tokens

💵 $2802.13 Estimated AI Cost This Week

🧠 131 AI Sessions, 529 AI Prompts

GPT                      52,570 lines        █████████████████████████   99.13 % 
Claude-Code              282 lines           ░░░░░░░░░░░░░░░░░░░░░░░░░   00.53 % 
Sonnet                   182 lines           ░░░░░░░░░░░░░░░░░░░░░░░░░   00.34 % 
Vscode-Wakatime          0 lines             ░░░░░░░░░░░░░░░░░░░░░░░░░   00.00 % 
Codex-Vscode             0 lines             ░░░░░░░░░░░░░░░░░░░░░░░░░   00.00 % 

🔎 AI Coding Insights:
🤖 AI-Driven — 96.78% of written lines came from AI
📄 Detailed Prompter — average 820 characters per prompt
🔁 Iterative Prompter — average 4 prompts per session
🚀 High AI Trust — 5.1% of changed lines were hand-edited
```


<!--END_SECTION:waka-->

<!-- prettier-ignore-end -->
