package kr.jamie.golsp.run

import com.intellij.execution.actions.ConfigurationContext
import com.intellij.execution.actions.LazyRunConfigurationProducer
import com.intellij.execution.configurations.ConfigurationFactory
import com.intellij.execution.configurations.ConfigurationTypeUtil
import com.intellij.openapi.util.Ref
import com.intellij.psi.PsiElement

class GoRunConfigurationProducer : LazyRunConfigurationProducer<GoRunConfiguration>() {
    override fun getConfigurationFactory(): ConfigurationFactory =
        ConfigurationTypeUtil.findConfigurationType(GoConfigurationType::class.java).configurationFactories.single()

    override fun setupConfigurationFromContext(
        configuration: GoRunConfiguration,
        context: ConfigurationContext,
        sourceElement: Ref<PsiElement>,
    ): Boolean {
        val element = context.psiLocation ?: return false
        val symbol = GoSourceSymbolDetector.at(element) ?: return false
        val options = configuration.goOptions
        options.commandKind = symbol.kind.name
        options.target = symbol.target
        options.testName = symbol.testName
        options.workingDirectory = element.project.basePath.orEmpty()
        configuration.name = if (symbol.kind == GoCommandKind.TEST) symbol.name else "Run ${element.containingFile.name}"
        sourceElement.set(element)
        return true
    }

    override fun isConfigurationFromContext(
        configuration: GoRunConfiguration,
        context: ConfigurationContext,
    ): Boolean {
        val symbol = context.psiLocation?.let(GoSourceSymbolDetector::at) ?: return false
        return configuration.kind() == symbol.kind &&
            configuration.goOptions.target == symbol.target &&
            configuration.goOptions.testName.orEmpty() == symbol.testName
    }
}
