package kr.jamie.golsp.tools

import java.io.File
import java.nio.file.Files
import java.nio.file.Path

class GoExecutableResolver(
    private val environment: Map<String, String> = System.getenv(),
    private val userHome: Path = Path.of(System.getProperty("user.home")),
    private val isExecutable: (Path) -> Boolean = { Files.isRegularFile(it) && Files.isExecutable(it) },
    private val isWindows: Boolean = System.getProperty("os.name").startsWith("Windows", ignoreCase = true),
) {
    fun resolve(tool: GoTool, configuredPath: String = ""): Path? {
        if (configuredPath.isNotBlank()) {
            return expandHome(configuredPath.trim()).takeIf(isExecutable)
        }
        return candidates(tool).firstOrNull(isExecutable)
    }

    internal fun candidates(tool: GoTool): Sequence<Path> = sequence {
        val executable = if (isWindows) "${tool.executableName}.exe" else tool.executableName

        environment["PATH"].orEmpty()
            .split(File.pathSeparatorChar)
            .filter(String::isNotBlank)
            .forEach { yield(Path.of(it).resolve(executable)) }

        if (tool != GoTool.GO) {
            environment["GOBIN"]?.takeIf(String::isNotBlank)
                ?.let { yield(Path.of(it).resolve(executable)) }

            environment["GOPATH"].orEmpty()
                .split(File.pathSeparatorChar)
                .filter(String::isNotBlank)
                .forEach { yield(Path.of(it).resolve("bin").resolve(executable)) }

            yield(userHome.resolve("go").resolve("bin").resolve(executable))
        }

        if (!isWindows) {
            yield(Path.of("/opt/homebrew/bin").resolve(executable))
            yield(Path.of("/usr/local/bin").resolve(executable))
            yield(Path.of("/usr/bin").resolve(executable))
            if (tool == GoTool.GO) {
                yield(Path.of("/usr/local/go/bin/go"))
            }
        }
    }.distinct()

    private fun expandHome(value: String): Path = when {
        value == "~" -> userHome
        value.startsWith("~/") || value.startsWith("~\\") -> userHome.resolve(value.substring(2))
        else -> Path.of(value)
    }
}
