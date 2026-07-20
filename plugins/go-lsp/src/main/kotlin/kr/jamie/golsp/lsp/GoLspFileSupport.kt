package kr.jamie.golsp.lsp

import com.intellij.openapi.vfs.VirtualFile

object GoLspFileSupport {
    private val workspaceFiles = setOf("go.mod", "go.sum", "go.work")

    fun isSupported(file: VirtualFile): Boolean =
        !file.isDirectory && (file.extension.equals("go", ignoreCase = true) || file.name in workspaceFiles)
}
