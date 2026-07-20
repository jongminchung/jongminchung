package kr.jamie.golsp.run

import com.intellij.execution.configurations.LocatableRunConfigurationOptions

class GoRunConfigurationOptions : LocatableRunConfigurationOptions() {
    var commandKind by string(GoCommandKind.RUN.name)
    var workingDirectory by string("")
    var target by string(".")
    var arguments by string("")
    var goArguments by string("")
    var testName by string("")
}
