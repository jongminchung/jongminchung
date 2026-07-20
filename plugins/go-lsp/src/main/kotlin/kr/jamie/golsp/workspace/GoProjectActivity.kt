package kr.jamie.golsp.workspace

import com.intellij.notification.NotificationAction
import com.intellij.notification.NotificationGroupManager
import com.intellij.notification.NotificationType
import com.intellij.openapi.components.service
import com.intellij.openapi.project.Project
import com.intellij.openapi.startup.ProjectActivity
import kr.jamie.golsp.tools.GoTool
import kr.jamie.golsp.tools.GoToolActions
import kr.jamie.golsp.tools.GoToolchainService

class GoProjectActivity : ProjectActivity {
    override suspend fun execute(project: Project) {
        val workspace = project.service<GoWorkspaceService>()
        if (workspace.moduleRoots().isEmpty() && workspace.workspaceRoot()?.findChild("go.work") == null) return

        val tools = project.service<GoToolchainService>()
        val missing = listOf(GoTool.GOPLS, GoTool.DLV).filter { tools.resolve(it) == null }
        if (missing.isEmpty()) return

        val notification = NotificationGroupManager.getInstance()
            .getNotificationGroup("Go LSP")
            .createNotification(
                "Go tools are not fully configured",
                "Missing: ${missing.joinToString { it.executableName }}",
                NotificationType.WARNING,
            )
        missing.forEach { tool ->
            notification.addAction(NotificationAction.createSimpleExpiring("Install ${tool.executableName}") {
                GoToolActions.installOrUpdate(project, tool)
            })
        }
        notification.notify(project)
    }
}
