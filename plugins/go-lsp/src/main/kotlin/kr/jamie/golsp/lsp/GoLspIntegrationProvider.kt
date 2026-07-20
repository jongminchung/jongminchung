package kr.jamie.golsp.lsp

import com.intellij.openapi.components.Service
import com.intellij.openapi.components.service
import com.intellij.openapi.project.Project
import com.intellij.openapi.vfs.VirtualFile
import com.intellij.platform.lsp.api.LspIntegrationProvider

class GoLspIntegrationProvider : LspIntegrationProvider {
    override fun fileOpened(
        project: Project,
        file: VirtualFile,
        clientStarter: LspIntegrationProvider.LspClientStarter,
    ) {
        if (GoLspFileSupport.isSupported(file)) {
            clientStarter.ensureClientStarted(project.service<GoLspDescriptorService>().descriptor)
        }
    }
}

@Service(Service.Level.PROJECT)
internal class GoLspDescriptorService(project: Project) {
    val descriptor = GoLspClientDescriptor(project)
}
