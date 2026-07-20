package kr.jamie.golsp.lsp

import com.intellij.execution.configurations.GeneralCommandLine
import com.intellij.openapi.components.service
import com.intellij.openapi.project.Project
import com.intellij.openapi.vfs.VirtualFile
import com.intellij.platform.lsp.api.LspServerDescriptor
import kr.jamie.golsp.settings.GoLspSettings
import kr.jamie.golsp.tools.GoTool
import kr.jamie.golsp.tools.GoToolchainService
import kr.jamie.golsp.workspace.GoWorkspaceService
import org.eclipse.lsp4j.ConfigurationItem
import java.nio.charset.StandardCharsets

class GoLspClientDescriptor(project: Project) : LspServerDescriptor(
    project,
    "gopls",
    *project.service<GoWorkspaceService>().lspRoots(),
) {
    override fun isSupportedFile(file: VirtualFile): Boolean = GoLspFileSupport.isSupported(file)

    override fun getLanguageId(file: VirtualFile): String = when (file.name) {
        "go.mod" -> "go.mod"
        "go.sum" -> "go.sum"
        "go.work" -> "go.work"
        else -> "go"
    }

    override fun createCommandLine(): GeneralCommandLine {
        val executable = project.service<GoToolchainService>().require(GoTool.GOPLS)

        return GeneralCommandLine(executable.toString(), "serve")
            .withCharset(StandardCharsets.UTF_8)
            .also { commandLine ->
                project.basePath?.let(commandLine::withWorkDirectory)
            }
    }

    override fun createInitializationOptions(): Any = goplsSettings()

    override fun getWorkspaceConfiguration(item: ConfigurationItem): Any = goplsSettings()

    private fun goplsSettings(): Map<String, Any> {
        val settings = GoLspSettings.getInstance().state
        return mapOf(
            "staticcheck" to settings.staticcheck,
            "semanticTokens" to settings.semanticTokens,
            "usePlaceholders" to true,
            "completeUnimported" to true,
            "gofumpt" to false,
        )
    }
}
