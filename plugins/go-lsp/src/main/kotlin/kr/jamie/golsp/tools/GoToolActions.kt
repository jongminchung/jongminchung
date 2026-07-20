package kr.jamie.golsp.tools

import com.intellij.notification.NotificationGroupManager
import com.intellij.notification.NotificationType
import com.intellij.openapi.components.service
import com.intellij.openapi.progress.ProgressIndicator
import com.intellij.openapi.progress.Task
import com.intellij.openapi.project.Project
import com.intellij.platform.lsp.api.LspServerManager
import kr.jamie.golsp.lsp.GoLspIntegrationProvider

object GoToolActions {
    fun installOrUpdate(project: Project, tool: GoTool) {
        object : Task.Backgroundable(project, "Installing ${tool.executableName}", true) {
            override fun run(indicator: ProgressIndicator) {
                indicator.text = "Running go install ${tool.installPackage}"
                val result = runCatching { project.service<GoToolchainService>().installOrUpdate(tool) }
                result.onSuccess { output ->
                    if (output.exitCode == 0) {
                        notify(project, "${tool.executableName} is ready", toolVersion(project, tool), NotificationType.INFORMATION)
                        if (tool == GoTool.GOPLS) restartGopls(project)
                    } else {
                        notify(project, "Could not install ${tool.executableName}", output.stderr.ifBlank { output.stdout }, NotificationType.ERROR)
                    }
                }.onFailure { error ->
                    notify(project, "Could not install ${tool.executableName}", error.message.orEmpty(), NotificationType.ERROR)
                }
            }
        }.queue()
    }

    fun restartGopls(project: Project) {
        LspServerManager.getInstance(project).stopAndRestartIfNeeded(GoLspIntegrationProvider::class.java)
    }

    private fun toolVersion(project: Project, tool: GoTool): String =
        project.service<GoToolchainService>().version(tool) ?: "Installation completed."

    private fun notify(project: Project, title: String, content: String, type: NotificationType) {
        NotificationGroupManager.getInstance().getNotificationGroup("Go LSP")
            .createNotification(title, content.take(2_000), type)
            .notify(project)
    }
}
