package kr.jamie.golsp.workspace

import com.intellij.openapi.components.Service
import com.intellij.openapi.project.Project
import com.intellij.openapi.vfs.LocalFileSystem
import com.intellij.openapi.vfs.VirtualFile
import java.nio.file.Files
import java.nio.file.Path

@Service(Service.Level.PROJECT)
class GoWorkspaceService(private val project: Project) {
    fun workspaceRoot(file: VirtualFile? = null): VirtualFile? {
        val projectRoot = project.basePath?.let(LocalFileSystem.getInstance()::findFileByPath)
        val start = file?.takeUnless { it.isDirectory }?.parent ?: file ?: projectRoot
        return generateSequence(start) { it.parent }
            .firstOrNull { it.findChild("go.work") != null }
            ?: generateSequence(start) { it.parent }
                .firstOrNull { it.findChild("go.mod") != null }
            ?: projectRoot
    }

    fun moduleRoots(): List<VirtualFile> {
        val basePath = project.basePath?.let(Path::of) ?: return emptyList()
        if (!Files.isDirectory(basePath)) return emptyList()

        val roots = mutableListOf<VirtualFile>()
        Files.walk(basePath, 5).use { paths ->
            paths.filter { it.fileName?.toString() == "go.mod" }
                .forEach { moduleFile ->
                    LocalFileSystem.getInstance().findFileByNioFile(moduleFile.parent)?.let(roots::add)
                }
        }
        return roots.distinctBy(VirtualFile::getPath)
    }

    fun lspRoots(): Array<VirtualFile> {
        val workspace = workspaceRoot()
        if (workspace?.findChild("go.work") != null) {
            return arrayOf(workspace)
        }
        val modules = moduleRoots()
        return (modules.ifEmpty { listOfNotNull(workspace) }).toTypedArray()
    }
}
