package kr.jamie.golsp.run

import com.intellij.openapi.options.SettingsEditor
import com.intellij.openapi.project.Project
import com.intellij.ui.components.JBTextField
import com.intellij.util.ui.FormBuilder
import javax.swing.JComponent
import javax.swing.JComboBox
import javax.swing.JPanel

class GoRunConfigurationEditor(private val project: Project) : SettingsEditor<GoRunConfiguration>() {
    private val kind = JComboBox(GoCommandKind.entries.toTypedArray())
    private val target = JBTextField()
    private val workingDirectory = JBTextField()
    private val goArguments = JBTextField()
    private val arguments = JBTextField()
    private val testName = JBTextField()
    private val panel: JPanel = FormBuilder.createFormBuilder()
        .addLabeledComponent("Command:", kind)
        .addLabeledComponent("Package or file:", target)
        .addLabeledComponent("Test name:", testName)
        .addLabeledComponent("Working directory:", workingDirectory)
        .addLabeledComponent("Go arguments:", goArguments)
        .addLabeledComponent("Program/test arguments:", arguments)
        .addComponentFillVertically(JPanel(), 0)
        .panel

    override fun resetEditorFrom(configuration: GoRunConfiguration) {
        val options = configuration.goOptions
        kind.selectedItem = configuration.kind()
        target.text = options.target.orEmpty()
        testName.text = options.testName.orEmpty()
        workingDirectory.text = options.workingDirectory.orEmpty().ifBlank { project.basePath.orEmpty() }
        goArguments.text = options.goArguments.orEmpty()
        arguments.text = options.arguments.orEmpty()
    }

    override fun applyEditorTo(configuration: GoRunConfiguration) {
        val options = configuration.goOptions
        options.commandKind = (kind.selectedItem as? GoCommandKind ?: GoCommandKind.RUN).name
        options.target = target.text.trim()
        options.testName = testName.text.trim()
        options.workingDirectory = workingDirectory.text.trim()
        options.goArguments = goArguments.text.trim()
        options.arguments = arguments.text.trim()
    }

    override fun createEditor(): JComponent = panel
}
