package kr.jamie.golsp.settings

import com.intellij.openapi.options.SearchableConfigurable
import com.intellij.openapi.project.ProjectManager
import com.intellij.ui.components.JBCheckBox
import com.intellij.ui.components.JBLabel
import com.intellij.ui.components.JBTextField
import com.intellij.util.ui.FormBuilder
import kr.jamie.golsp.tools.GoToolActions
import javax.swing.JComponent
import javax.swing.JPanel

class GoLspConfigurable : SearchableConfigurable {
    private var goPathField: JBTextField? = null
    private var goplsPathField: JBTextField? = null
    private var dlvPathField: JBTextField? = null
    private var staticcheckBox: JBCheckBox? = null
    private var semanticTokensBox: JBCheckBox? = null

    override fun getId(): String = "kr.jamie.golsp.settings"

    override fun getDisplayName(): String = "Go LSP"

    override fun createComponent(): JComponent {
        goPathField = JBTextField()
        goplsPathField = JBTextField()
        dlvPathField = JBTextField()
        staticcheckBox = JBCheckBox("Enable staticcheck analyses")
        semanticTokensBox = JBCheckBox("Enable semantic tokens")

        return FormBuilder.createFormBuilder()
            .addLabeledComponent("Go executable:", goPathField!!)
            .addLabeledComponent("gopls executable:", goplsPathField!!)
            .addLabeledComponent("Delve executable:", dlvPathField!!)
            .addComponent(staticcheckBox!!)
            .addComponent(semanticTokensBox!!)
            .addComponent(JBLabel("Leave paths empty to discover tools from PATH, GOBIN, GOPATH, or ~/go/bin."))
            .addComponentFillVertically(JPanel(), 0)
            .panel
    }

    override fun isModified(): Boolean {
        val state = GoLspSettings.getInstance().state
        return goPathField?.text?.trim().orEmpty() != state.goPath ||
            goplsPathField?.text?.trim().orEmpty() != state.goplsPath ||
            dlvPathField?.text?.trim().orEmpty() != state.dlvPath ||
            staticcheckBox?.isSelected != state.staticcheck ||
            semanticTokensBox?.isSelected != state.semanticTokens
    }

    override fun apply() {
        val state = GoLspSettings.getInstance().state
        state.goPath = goPathField?.text?.trim().orEmpty()
        state.goplsPath = goplsPathField?.text?.trim().orEmpty()
        state.dlvPath = dlvPathField?.text?.trim().orEmpty()
        state.staticcheck = staticcheckBox?.isSelected ?: true
        state.semanticTokens = semanticTokensBox?.isSelected ?: true
        ProjectManager.getInstance().openProjects.forEach(GoToolActions::restartGopls)
    }

    override fun reset() {
        val state = GoLspSettings.getInstance().state
        goPathField?.text = state.goPath
        goplsPathField?.text = state.goplsPath
        dlvPathField?.text = state.dlvPath
        staticcheckBox?.isSelected = state.staticcheck
        semanticTokensBox?.isSelected = state.semanticTokens
    }

    override fun disposeUIResources() {
        goPathField = null
        goplsPathField = null
        dlvPathField = null
        staticcheckBox = null
        semanticTokensBox = null
    }
}
