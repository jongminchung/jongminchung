# Compatibility testing

## Supported matrix

| IntelliJ IDEA | Validation                                                                        |
| ------------- | --------------------------------------------------------------------------------- |
| 2026.2        | Unit tests, integration tests, Plugin Verifier, and full manual runtime checklist |
| 2026.1.4      | Plugin Verifier and runtime smoke checklist                                       |
| 2025.3.5      | Plugin Verifier and runtime smoke checklist                                       |

All three releases use the official unified IntelliJ IDEA distribution in its free tier. Do not
add a dependency on `com.intellij.modules.ultimate`.

## Automated checks

```shell
./gradlew clean test buildPlugin verifyPluginProjectConfiguration verifyPluginStructure
./gradlew verifyPlugin
./gradlew verifyCompatibility
```

All Plugin Verifier reports must say `Compatible`. Warnings about compatibility-only deprecated
LSP or XDebugger entry points are acceptable only when the same API is present in every supported
release.

The production artifact is compiled against IntelliJ IDEA 2025.3.5 and Java 21. Compiling against
2026.2 would require Java 25 bytecode, which cannot be loaded by the older supported releases.
Compatibility is therefore validated forward with Plugin Verifier and the runtime sandboxes below.

## Free-tier runtime sandboxes

```shell
./gradlew runIde2025_3
./gradlew runIde2026_1
./gradlew runIde2026_2
```

These tasks launch official IntelliJ IDEA builds with the plugin installed in separate development
sandboxes. They do not require a paid subscription. Use `runIde2026_2` for the full checklist and
the other two tasks for startup and gopls connection smoke checks.

## Runtime fixture

Open `src/test/resources/fixtures/go-workspace`, which contains:

- a root `go.work`;
- two modules with their own `go.mod` files;
- a `main.go` that prints a deterministic value;
- passing, failing, and skipped tests;
- a function with a local variable suitable for a debugger breakpoint.

Install current `gopls` and Delve versions through **Tools | Go Tools**, or configure explicit
binary paths under **Settings | Go LSP**. Disable JetBrains' official Go plugin before opening the
fixture.

## 2026.2 full checklist

- The plugin loads as `kr.jamie.golsp` without missing-module errors.
- Completion, diagnostics, hover, navigation, references, rename, and formatting work.
- `go.mod`, `go.sum`, and `go.work` are recognized; navigation works across workspace modules.
- Main and test gutter actions create the correct run configurations.
- `go run` output is correct and the test tree shows pass, fail, skip, duration, and output.
- Delve stops at a line breakpoint and supports continue, pause, step over, step into, step out,
  stack frames, scopes, and expandable variables.
- Installing or updating gopls and restarting it restores language features.
- `idea.log` contains no unhandled exception with the `kr.jamie.golsp` prefix.

## 2026.1.4 and 2025.3.5 smoke checklist

- The plugin installs and remains enabled in the free tier.
- A Go file starts gopls and receives completion and diagnostics.
- Main and test gutter actions work.
- A test result tree is shown.
- A Delve session connects and stops at a breakpoint.
- Version-specific LSP features absent from the older IDE are not treated as failures.
