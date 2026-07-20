package kr.jamie.golsp.tools

import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent

class InstallGoplsAction : AnAction() {
    override fun actionPerformed(event: AnActionEvent) {
        event.project?.let { GoToolActions.installOrUpdate(it, GoTool.GOPLS) }
    }
}

class InstallDelveAction : AnAction() {
    override fun actionPerformed(event: AnActionEvent) {
        event.project?.let { GoToolActions.installOrUpdate(it, GoTool.DLV) }
    }
}

class RestartGoplsAction : AnAction() {
    override fun actionPerformed(event: AnActionEvent) {
        event.project?.let(GoToolActions::restartGopls)
    }
}
