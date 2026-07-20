package kr.jamie.golsp.lang

import com.intellij.lang.Language
import com.intellij.openapi.fileTypes.LanguageFileType
import kr.jamie.golsp.GoLspIcons
import javax.swing.Icon

object GoWorkspaceLanguage : Language("GoWorkspaceLsp")

object GoWorkspaceFileType : LanguageFileType(GoWorkspaceLanguage) {
    override fun getName(): String = "Go Workspace"

    override fun getDescription(): String = "Go module or workspace file"

    override fun getDefaultExtension(): String = "mod"

    override fun getIcon(): Icon = GoLspIcons.FILE
}
