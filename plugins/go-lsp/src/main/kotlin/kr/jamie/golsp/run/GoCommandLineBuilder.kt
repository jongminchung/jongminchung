package kr.jamie.golsp.run

import com.intellij.execution.configurations.GeneralCommandLine
import com.intellij.util.execution.ParametersListUtil
import kr.jamie.golsp.tools.GoToolchainService
import kr.jamie.golsp.tools.GoTool
import java.nio.charset.StandardCharsets
import java.util.regex.Pattern

object GoCommandLineBuilder {
    fun build(configuration: GoRunConfiguration, tools: GoToolchainService): GeneralCommandLine {
        val options = configuration.goOptions
        val arguments = mutableListOf(tools.require(GoTool.GO).toString())
        when (configuration.kind()) {
            GoCommandKind.RUN -> {
                arguments += "run"
                arguments += ParametersListUtil.parse(options.goArguments.orEmpty())
                arguments += options.target.orEmpty()
                arguments += ParametersListUtil.parse(options.arguments.orEmpty())
            }
            GoCommandKind.TEST -> {
                arguments += "test"
                arguments += ParametersListUtil.parse(options.goArguments.orEmpty())
                arguments += "-json"
                arguments += options.target.orEmpty()
                if (!options.testName.isNullOrBlank()) {
                    arguments += listOf("-run", "^${Pattern.quote(options.testName)}$")
                }
                arguments += ParametersListUtil.parse(options.arguments.orEmpty())
            }
        }
        return GeneralCommandLine(arguments)
            .withCharset(StandardCharsets.UTF_8)
            .withWorkDirectory(options.workingDirectory.orEmpty().ifBlank { configuration.project.basePath })
    }
}
