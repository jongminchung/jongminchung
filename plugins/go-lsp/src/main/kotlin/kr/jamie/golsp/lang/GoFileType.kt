package kr.jamie.golsp.lang

import com.intellij.openapi.fileTypes.LanguageFileType
import kr.jamie.golsp.GoLspIcons
import javax.swing.Icon

object GoFileType : LanguageFileType(GoLanguage) {
    override fun getName(): String = "Go LSP"

    override fun getDescription(): String = "Go source file"

    override fun getDefaultExtension(): String = "go"

    override fun getIcon(): Icon = GoLspIcons.FILE
}
