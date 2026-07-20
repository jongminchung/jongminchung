package kr.jamie.golsp.debug

import com.intellij.execution.ExecutionException
import com.intellij.execution.configurations.RunProfile
import com.intellij.execution.configurations.RunProfileState
import com.intellij.execution.configurations.RunnerSettings
import com.intellij.execution.executors.DefaultDebugExecutor
import com.intellij.execution.runners.ExecutionEnvironment
import com.intellij.execution.runners.GenericProgramRunner
import com.intellij.execution.ui.RunContentDescriptor
import com.intellij.xdebugger.XDebugProcessStarter
import com.intellij.xdebugger.XDebugSession
import com.intellij.xdebugger.XDebuggerManager
import kr.jamie.golsp.run.GoRunConfiguration

class GoDebugRunner : GenericProgramRunner<RunnerSettings>() {
    override fun getRunnerId(): String = "GoLspDebugRunner"

    override fun canRun(executorId: String, profile: RunProfile): Boolean =
        executorId == DefaultDebugExecutor.EXECUTOR_ID && profile is GoRunConfiguration

    override fun doExecute(state: RunProfileState, environment: ExecutionEnvironment): RunContentDescriptor {
        val configuration = environment.runProfile as? GoRunConfiguration
            ?: throw ExecutionException("A Go run configuration is required.")
        @Suppress("DEPRECATION")
        val session = XDebuggerManager.getInstance(environment.project).startSession(
            environment,
            object : XDebugProcessStarter() {
                override fun start(session: XDebugSession) = GoDapDebugProcess(session, configuration)
            },
        )
        @Suppress("DEPRECATION")
        return session.runContentDescriptor
    }
}
