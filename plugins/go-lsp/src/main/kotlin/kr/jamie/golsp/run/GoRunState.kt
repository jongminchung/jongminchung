package kr.jamie.golsp.run

import com.intellij.execution.DefaultExecutionResult
import com.intellij.execution.ExecutionResult
import com.intellij.execution.configurations.CommandLineState
import com.intellij.execution.process.KillableColoredProcessHandler
import com.intellij.execution.process.ProcessHandler
import com.intellij.execution.runners.ExecutionEnvironment
import com.intellij.execution.testframework.sm.SMTestRunnerConnectionUtil
import com.intellij.execution.testframework.sm.runner.SMTRunnerConsoleProperties
import com.intellij.execution.ui.ConsoleView
import com.intellij.execution.filters.TextConsoleBuilderFactory
import com.intellij.openapi.components.service
import kr.jamie.golsp.tools.GoToolchainService

class GoRunState(
    environment: ExecutionEnvironment,
    private val configuration: GoRunConfiguration,
) : CommandLineState(environment) {
    override fun startProcess(): ProcessHandler {
        val commandLine = GoCommandLineBuilder.build(configuration, configuration.project.service<GoToolchainService>())
        return if (configuration.kind() == GoCommandKind.TEST) {
            GoTestProcessHandler(commandLine)
        } else {
            KillableColoredProcessHandler(commandLine)
        }
    }

    override fun execute(executor: com.intellij.execution.Executor, runner: com.intellij.execution.runners.ProgramRunner<*>): ExecutionResult {
        val processHandler = startProcess()
        val console = createGoConsole(executor, processHandler)
        console.attachToProcess(processHandler)
        return DefaultExecutionResult(console, processHandler)
    }

    private fun createGoConsole(executor: com.intellij.execution.Executor, handler: ProcessHandler): ConsoleView =
        if (configuration.kind() == GoCommandKind.TEST) {
            val properties = object : SMTRunnerConsoleProperties(configuration, "Go", executor) {
                init {
                    isIdBasedTestTree = true
                }
            }
            SMTestRunnerConnectionUtil.createAndAttachConsole("Go", handler, properties)
        } else {
            TextConsoleBuilderFactory.getInstance().createBuilder(configuration.project).console
        }
}
