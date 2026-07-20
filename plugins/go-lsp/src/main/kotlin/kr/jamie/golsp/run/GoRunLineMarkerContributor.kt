package kr.jamie.golsp.run

import com.intellij.execution.lineMarker.RunLineMarkerContributor
import com.intellij.psi.PsiElement

class GoRunLineMarkerContributor : RunLineMarkerContributor() {
    override fun getInfo(element: PsiElement): Info? {
        if (element.firstChild != null || element.text != "func") return null
        GoSourceSymbolDetector.at(element) ?: return null
        return withExecutorActions(kr.jamie.golsp.GoLspIcons.FILE)
    }
}
