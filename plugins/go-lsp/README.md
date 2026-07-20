# Go LSP for IntelliJ IDEA Free

Community-friendly Go development support for IntelliJ Platform IDEs, powered by the official
[`gopls`](https://go.dev/gopls/) language server and
[`Delve`](https://github.com/go-delve/delve). The plugin uses public IntelliJ Platform APIs and
does not copy or depend on JetBrains' proprietary Go plugin.

This release is a practical community baseline, not a claim of GoLand feature parity.

## Features

1. **gopls language support**
   - Completion, diagnostics, hover, navigation, references, rename, formatting, and code actions
   - Multi-module `go.work` and nested `go.mod` workspace roots
   - Configurable staticcheck and semantic tokens
   - Explicit restart action and automatic restart after settings/tool changes
2. **Go run and test configurations**
   - `go run` for packages or files
   - `go test -json` for packages and individual tests
   - Separate Go flags and program/test arguments
3. **Test gutter and result UI**
   - Run/debug gutter icons for `main`, `Test*`, `Benchmark*`, `Fuzz*`, and `Example*`
   - IntelliJ test tree with pass, fail, skip, duration, and captured output
4. **Delve debugging over DAP**
   - Line breakpoints
   - Continue, pause, step over, step into, and step out
   - Goroutine/thread stacks, frames, scopes, and expandable variables
5. **Go workspace files**
   - Recognition and highlighting for `go.mod`, `go.sum`, and `go.work`
   - LSP routing of workspace files to gopls
6. **Tool setup UX**
   - Discovery from configured paths, `PATH`, `GOBIN`, `GOPATH`, `~/go/bin`, Homebrew, and common locations
   - Missing-tool notification when a Go project opens
   - **Tools | Go Tools** actions to install/update gopls and Delve and restart gopls
   - Paths and gopls options under **Settings | Go LSP**

The plugin is incompatible with JetBrains' official Go plugin because both claim `.go` files.

## Supported IntelliJ IDEA releases

IntelliJ IDEA uses a unified distribution from 2025.3 onward. This plugin works in the free tier
and does not depend on the subscription-gated `com.intellij.modules.ultimate` module.

| Release | Minimum build | Support level                                   |
| ------- | ------------- | ----------------------------------------------- |
| 2026.2  | 262           | Primary development and full runtime validation |
| 2026.1  | 261           | Compatibility and runtime smoke validation      |
| 2025.3  | 253           | Compatibility and runtime smoke validation      |

IntelliJ IDEA 2025.2 Community Edition and open-source self-builds are not supported because they
do not include the JetBrains LSP implementation.

## Requirements

- IntelliJ IDEA 2025.3.5 through 2026.2
- JDK 21 for plugin development
- A local Go installation

The plugin is compiled against the oldest supported SDK, 2025.3.5, so the same Java 21 artifact
can run on all three releases. IntelliJ IDEA 2026.2 remains the primary runtime validation target.

gopls and Delve can be installed from **Tools | Go Tools**. Equivalent terminal commands are:

```shell
go install golang.org/x/tools/gopls@latest
go install github.com/go-delve/delve/cmd/dlv@latest
```

## Build and install

```shell
./gradlew test
./gradlew buildPlugin
./gradlew verifyPlugin
./gradlew verifyCompatibility
```

No paid JetBrains subscription is required. The Gradle tasks download official IntelliJ IDEA
distributions and run them in isolated sandboxes; language support uses the free LSP API available
in the unified 2025.3+ distribution.

Install `build/distributions/go-lsp-intellij-0.3.0.zip` using
**Settings | Plugins | Install Plugin from Disk**.

The release compatibility and manual runtime checklist are documented in
[`docs/compatibility-testing.md`](docs/compatibility-testing.md).

## Project structure

```text
src/main/kotlin/kr/jamie/golsp/
  debug/      Delve DAP adapter and IntelliJ debugger integration
  lang/       Go file types, lexer, parser shell, and highlighting
  lsp/        gopls lifecycle and IntelliJ LSP integration
  run/        Run/test configurations, gutter actions, and test event conversion
  settings/   Persisted tool paths and gopls options
  tools/      Tool discovery, installation, update, and restart actions
  workspace/  go.mod/go.work root discovery and project startup checks
```

## Current boundaries

- Parsing, refactoring, and inspections primarily come from gopls rather than a full native Go PSI.
- Debugging currently supports local launch/test sessions; attach, remote targets, core dumps, and advanced Delve options are not included yet.
- Build tags, environment variables, coverage UI, profiling, vendoring UI, and Go SDK management are future work.

## License

MIT
