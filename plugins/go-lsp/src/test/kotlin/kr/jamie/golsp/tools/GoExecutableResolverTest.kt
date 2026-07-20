package kr.jamie.golsp.tools

import java.io.File
import java.nio.file.Path
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class GoExecutableResolverTest {
    @Test
    fun `uses an explicit executable before discovery`() {
        val expected = Path.of("/tools/gopls")
        val resolver = resolver(executablePaths = setOf(expected))

        assertEquals(expected, resolver.resolve(GoTool.GOPLS, expected.toString()))
    }

    @Test
    fun `discovers tools from path before Go locations`() {
        val pathCandidate = Path.of("/usr/local/dev-tools/dlv")
        val resolver = resolver(
            environment = mapOf(
                "PATH" to listOf("/usr/local/dev-tools", "/usr/bin").joinToString(File.pathSeparator),
                "GOBIN" to "/go/bin",
            ),
            executablePaths = setOf(pathCandidate, Path.of("/go/bin/dlv")),
        )

        assertEquals(pathCandidate, resolver.resolve(GoTool.DLV))
    }

    @Test
    fun `returns null for an invalid explicit path`() {
        val resolver = resolver(executablePaths = emptySet())

        assertNull(resolver.resolve(GoTool.GOPLS, "/missing/gopls"))
    }

    private fun resolver(
        environment: Map<String, String> = emptyMap(),
        executablePaths: Set<Path>,
    ) = GoExecutableResolver(
        environment = environment,
        userHome = Path.of("/home/tester"),
        isExecutable = executablePaths::contains,
        isWindows = false,
    )
}
