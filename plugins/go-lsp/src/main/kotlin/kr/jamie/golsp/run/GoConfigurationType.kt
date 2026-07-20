package kr.jamie.golsp.run

import com.intellij.execution.configurations.ConfigurationFactory
import com.intellij.execution.configurations.ConfigurationTypeBase
import com.intellij.execution.configurations.RunConfigurationOptions
import com.intellij.openapi.project.Project
import kr.jamie.golsp.GoLspIcons

class GoConfigurationType : ConfigurationTypeBase(
    ID,
    "Go",
    "Run or test Go packages",
    GoLspIcons.FILE,
) {
    init {
        addFactory(GoConfigurationFactory(this))
    }

    companion object {
        const val ID = "GoLspRunConfiguration"
    }
}

class GoConfigurationFactory(type: GoConfigurationType) : ConfigurationFactory(type) {
    override fun getId(): String = GoConfigurationType.ID

    override fun createTemplateConfiguration(project: Project): GoRunConfiguration =
        GoRunConfiguration(project, this, "Go")

    override fun getOptionsClass(): Class<out RunConfigurationOptions> = GoRunConfigurationOptions::class.java
}
