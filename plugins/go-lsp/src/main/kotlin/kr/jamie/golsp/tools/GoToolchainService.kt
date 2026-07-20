package kr.jamie.golsp.tools

import com.intellij.execution.ExecutionException
import com.intellij.execution.configurations.GeneralCommandLine
import com.intellij.execution.process.CapturingProcessHandler
import com.intellij.execution.process.ProcessOutput
import com.intellij.openapi.components.Service
import com.intellij.openapi.project.Project
import kr.jamie.golsp.settings.GoLspSettings
import java.nio.charset.StandardCharsets
import java.nio.file.Path

@Service(Service.Level.PROJECT)
class GoToolchainService(private val project: Project) {
    fun resolve(tool: GoTool): Path? {
        val settings = GoLspSettings.getInstance().state
        val configured = when (tool) {
            GoTool.GO -> settings.goPath
            GoTool.GOPLS -> settings.goplsPath
            GoTool.DLV -> settings.dlvPath
        }
        return GoExecutableResolver().resolve(tool, configured)
    }

    @Throws(ExecutionException::class)
    fun require(tool: GoTool): Path = resolve(tool)
        ?: throw ExecutionException(missingToolMessage(tool))

    fun version(tool: GoTool): String? {
        val executable = resolve(tool) ?: return null
        val output = run(executable, listOf("version"), timeoutMillis = 10_000)
        return output?.stdout?.trim()?.ifBlank { output.stderr.trim() }
    }

    fun installOrUpdate(tool: GoTool): ProcessOutput {
        val installPackage = tool.installPackage
            ?: throw ExecutionException("${tool.executableName} cannot be installed with 'go install'.")
        val go = require(GoTool.GO)
        return run(go, listOf("install", installPackage), timeoutMillis = 300_000)
            ?: throw ExecutionException("Installing ${tool.executableName} timed out.")
    }

    private fun run(executable: Path, arguments: List<String>, timeoutMillis: Int): ProcessOutput? {
        val commandLine = GeneralCommandLine(listOf(executable.toString()) + arguments)
            .withCharset(StandardCharsets.UTF_8)
        project.basePath?.let(commandLine::withWorkDirectory)
        val handler = CapturingProcessHandler(commandLine)
        return handler.runProcess(timeoutMillis).takeUnless { it.isTimeout }
    }

    private fun missingToolMessage(tool: GoTool): String = when (tool) {
        GoTool.GO -> "Go was not found. Configure it in Settings | Go LSP."
        GoTool.GOPLS -> "gopls was not found. Install it from Tools | Go Tools or configure it in Settings | Go LSP."
        GoTool.DLV -> "dlv was not found. Install it from Tools | Go Tools or configure it in Settings | Go LSP."
    }
}
