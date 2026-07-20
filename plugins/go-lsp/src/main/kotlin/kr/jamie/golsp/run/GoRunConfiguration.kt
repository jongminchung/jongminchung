package kr.jamie.golsp.run

import com.intellij.execution.ExecutionException
import com.intellij.execution.Executor
import com.intellij.execution.configurations.ConfigurationFactory
import com.intellij.execution.configurations.LocatableConfigurationBase
import com.intellij.execution.configurations.RunProfileState
import com.intellij.execution.runners.ExecutionEnvironment
import com.intellij.openapi.options.SettingsEditor
import com.intellij.openapi.project.Project
import java.nio.file.Files
import java.nio.file.Path

class GoRunConfiguration(
    project: Project,
    factory: ConfigurationFactory,
    name: String,
) : LocatableConfigurationBase<GoRunConfigurationOptions>(project, factory, name) {
    val goOptions: GoRunConfigurationOptions
        get() = options as GoRunConfigurationOptions

    override fun getConfigurationEditor(): SettingsEditor<out GoRunConfiguration> = GoRunConfigurationEditor(project)

    override fun getState(executor: Executor, environment: ExecutionEnvironment): RunProfileState =
        GoRunState(environment, this)

    override fun checkConfiguration() {
        val options = goOptions
        if (options.target.isNullOrBlank()) throw ExecutionException("A package, directory, or Go file is required.")
        if (!options.workingDirectory.isNullOrBlank() && !Files.isDirectory(Path.of(options.workingDirectory!!))) {
            throw ExecutionException("Working directory does not exist: ${options.workingDirectory}")
        }
    }

    fun kind(): GoCommandKind = runCatching { GoCommandKind.valueOf(goOptions.commandKind.orEmpty()) }
        .getOrDefault(GoCommandKind.RUN)
}
