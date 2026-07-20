package kr.jamie.golsp.run

import com.intellij.openapi.editor.Document
import com.intellij.openapi.vfs.VirtualFile
import com.intellij.psi.PsiElement
import com.intellij.psi.PsiFile
import com.intellij.psi.PsiDocumentManager

data class GoSourceSymbol(
    val name: String,
    val kind: GoCommandKind,
    val target: String,
    val testName: String = "",
)

object GoSourceSymbolDetector {
    private val functionPattern = Regex("^\\s*func\\s+(?:\\([^)]*\\)\\s*)?([A-Za-z_][A-Za-z0-9_]*)\\s*\\(")

    fun at(element: PsiElement): GoSourceSymbol? {
        val file = element.containingFile ?: return null
        val virtualFile = file.virtualFile ?: return null
        if (virtualFile.extension != "go") return null
        val document = PsiDocumentManager.getInstance(element.project).getDocument(file) ?: return null
        return at(document, file, virtualFile, element.textOffset)
    }

    internal fun at(document: Document, file: PsiFile, virtualFile: VirtualFile, offset: Int): GoSourceSymbol? {
        val line = document.getLineNumber(offset.coerceIn(0, document.textLength))
        val lineText = document.getText(com.intellij.openapi.util.TextRange(document.getLineStartOffset(line), document.getLineEndOffset(line)))
        val match = functionPattern.find(lineText) ?: return null
        val name = match.groupValues[1]
        val packageTarget = virtualFile.parent?.path ?: "."
        return when {
            name == "main" && Regex("(?m)^\\s*package\\s+main\\b").containsMatchIn(file.text) ->
                GoSourceSymbol(name, GoCommandKind.RUN, packageTarget)
            virtualFile.name.endsWith("_test.go") && isTestFunction(name) ->
                GoSourceSymbol(name, GoCommandKind.TEST, packageTarget, name)
            else -> null
        }
    }

    private fun isTestFunction(name: String): Boolean =
        listOf("Test", "Benchmark", "Example", "Fuzz").any { prefix ->
            name.startsWith(prefix) && name.getOrNull(prefix.length)?.let { !it.isLowerCase() } != false
        }
}
