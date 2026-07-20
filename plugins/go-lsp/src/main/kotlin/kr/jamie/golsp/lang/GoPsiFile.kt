package kr.jamie.golsp.lang

import com.intellij.extapi.psi.PsiFileBase
import com.intellij.psi.FileViewProvider

class GoPsiFile(viewProvider: FileViewProvider) : PsiFileBase(viewProvider, GoLanguage) {
    override fun getFileType() = GoFileType

    override fun toString(): String = "Go file"
}
