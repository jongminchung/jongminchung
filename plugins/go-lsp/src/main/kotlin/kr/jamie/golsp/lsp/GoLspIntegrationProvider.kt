package kr.jamie.golsp.lsp

import com.intellij.openapi.components.Service
import com.intellij.openapi.components.service
import com.intellij.openapi.project.Project
import com.intellij.openapi.vfs.VirtualFile
import com.intellij.platform.lsp.api.LspServerSupportProvider

class GoLspIntegrationProvider : LspServerSupportProvider {
    override fun fileOpened(
        project: Project,
        file: VirtualFile,
        serverStarter: LspServerSupportProvider.LspServerStarter,
    ) {
        if (GoLspFileSupport.isSupported(file)) {
            serverStarter.ensureServerStarted(project.service<GoLspDescriptorService>().descriptor)
        }
    }
}

@Service(Service.Level.PROJECT)
internal class GoLspDescriptorService(project: Project) {
    val descriptor = GoLspClientDescriptor(project)
}
