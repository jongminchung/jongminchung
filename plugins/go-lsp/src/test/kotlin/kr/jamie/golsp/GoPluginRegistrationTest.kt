package kr.jamie.golsp

import com.intellij.openapi.fileTypes.FileTypeManager
import com.intellij.execution.configurations.ConfigurationTypeUtil
import com.intellij.testFramework.fixtures.BasePlatformTestCase
import kr.jamie.golsp.lang.GoFileType
import kr.jamie.golsp.lang.GoWorkspaceFileType
import kr.jamie.golsp.run.GoConfigurationType
import kr.jamie.golsp.run.GoRunConfiguration

class GoPluginRegistrationTest : BasePlatformTestCase() {
    fun testGoFileTypeIsRegistered() {
        assertSame(GoFileType, FileTypeManager.getInstance().getFileTypeByFileName("main.go"))
    }

    fun testGoWorkspaceFilesAreRegistered() {
        assertSame(GoWorkspaceFileType, FileTypeManager.getInstance().getFileTypeByFileName("go.mod"))
        assertSame(GoWorkspaceFileType, FileTypeManager.getInstance().getFileTypeByFileName("go.work"))
        assertSame(GoWorkspaceFileType, FileTypeManager.getInstance().getFileTypeByFileName("go.sum"))
    }

    fun testGoRunConfigurationIsRegistered() {
        val type = ConfigurationTypeUtil.findConfigurationType(GoConfigurationType::class.java)
        val configuration = type.configurationFactories.single().createTemplateConfiguration(project)

        assertInstanceOf(configuration, GoRunConfiguration::class.java)
        assertEquals(".", (configuration as GoRunConfiguration).goOptions.target)
    }
}
