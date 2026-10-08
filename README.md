## Packages

This repository owns the shared `@jongminchung` packages used by downstream projects.

- `@jongminchung/ui`: published UI primitives, a default neutral theme, shared Tailwind styles,
  and semantic tokens.

Public packages are published to GitHub Packages. Consumers need the `@jongminchung` scope mapped
to `https://npm.pkg.github.com` and a classic PAT with `read:packages`, including for public package
downloads. Keep the token in the environment rather than committing it to `.npmrc`.

```ini
@jongminchung:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_PACKAGES_TOKEN}
```

The UI package provides safe default theme values. Apps may override semantic tokens and continue
to own product components and behavior. See [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) for the token
contract, component ownership rules, and runtime exception policy.

## Documentation

- [Repository documentation](./docs/README.md)
- [Maintenance guide](./docs/maintenance.md)
- [Contributing guide](./docs/CONTRIBUTING.md)

## Workspace scripts

Repository-wide scripts are owned by the workspace root and are run from that directory:

```bash
bun run fmt
bun run check
bun run links:check
bun run audit
```

Always include `run` for package scripts so commands are visibly distinguished from Bun subcommands.

`audit` queries the registry advisory database and fails on high-severity dependency findings. It
requires network access and is run manually during maintenance and before releases instead of being
part of the offline-reproducible `check` chain.

`links:check` uses Podman when available, otherwise Docker, to run the pinned Lychee container
with the repository mounted read-only. It checks
local links and anchors in Markdown and HTML without making network requests.

Each workspace owns its build, typecheck, and test commands. Select one with a filter instead of
adding a package-specific wrapper to the root manifest:

```bash
bun run --filter @jongminchung/web build
```

## Version Policy

The manually triggered package workflow replaces `@jongminchung/ui` at `1.0.0`.
This is a mutable snapshot channel: the same version can have different API, contents, and
integrity, so SemVer compatibility and lockfile reproducibility are not guaranteed. Consumers must
force a new resolution, such as `bun update --force <package>@1.0.0`, and commit the resulting
lockfile whenever they adopt a replacement.

The workflow installs the shared lockfile from the repository root, then lints, typechecks, and
runs coverage and Node consumer checks for UI on Node 24 and 26. It builds the
archive before deleting the fixed version, publishes that archive, and verifies registry integrity
and consumer imports. See the [release and recovery runbook](./docs/runbooks/release.md).
GitHub authentication is supplied only through the `GH_PAT` Actions secret.

```bash
bun install --frozen-lockfile --ignore-scripts
bun run --filter @jongminchung/ui typecheck
bun run --filter @jongminchung/ui test:coverage
bun run --filter @jongminchung/ui test:node
bun run --filter @jongminchung/ui publish:dry-run
```

<!-- prettier-ignore-start -->

<!--START_SECTION:waka-->
![AI Code Time](http://img.shields.io/badge/AI%20Code%20Time-852%20hrs%2052%20mins-blue?style=flat)

**I'm a Night 🦉** 

```text
🌞 Morning                925 commits         ███░░░░░░░░░░░░░░░░░░░░░░   10.74 % 
🌆 Daytime                2068 commits        ██████░░░░░░░░░░░░░░░░░░░   24.01 % 
🌃 Evening                3257 commits        █████████░░░░░░░░░░░░░░░░   37.81 % 
🌙 Night                  2364 commits        ███████░░░░░░░░░░░░░░░░░░   27.44 % 
```


📊 **This Week I Spent My Time On** 

```text
💬 Programming Languages: 
Java                     5 hrs 9 mins        ██████░░░░░░░░░░░░░░░░░░░   25.55 % 
Markdown                 3 hrs 56 mins       █████░░░░░░░░░░░░░░░░░░░░   19.49 % 
Other                    2 hrs 54 mins       ████░░░░░░░░░░░░░░░░░░░░░   14.39 % 
YAML                     1 hr 56 mins        ██░░░░░░░░░░░░░░░░░░░░░░░   09.64 % 
Bash                     1 hr 37 mins        ██░░░░░░░░░░░░░░░░░░░░░░░   08.04 % 
```

🤖 **AI Coding This Week** 

```text
⏱ AI Coding Time: 12 hrs 44 mins (63.05%)

✍️ 1,015 lines written by AI, 1,775 lines written by hand (36.38% AI-written)

🔤 9,661,951 Input Tokens, 624,290 Output Tokens

💵 $87.64 Estimated AI Cost This Week

🧠 48 AI Sessions, 179 AI Prompts

GPT                      1,227 lines         █████████████████████████   100.00 % 
Opencode-Cli             0 lines             ░░░░░░░░░░░░░░░░░░░░░░░░░   00.00 % 
Codex-Vscode             0 lines             ░░░░░░░░░░░░░░░░░░░░░░░░░   00.00 % 
Gemini                   0 lines             ░░░░░░░░░░░░░░░░░░░░░░░░░   00.00 % 

🔎 AI Coding Insights:
⚖️ Balanced with AI — 36.38% of written lines came from AI
📚 Verbose Prompter — average 2,219 characters per prompt
🔁 Iterative Prompter — average 4 prompts per session
🔍 Hands-On Reviewer — 63.33% of changed lines were hand-edited
```


<!--END_SECTION:waka-->

<!-- prettier-ignore-end -->

- 설치와 공통 `make fmt`·`make lint` 사용법은 [기여 가이드](docs/CONTRIBUTING.md)를 참고함
