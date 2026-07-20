package kr.jamie.golsp.settings

import com.intellij.openapi.components.PersistentStateComponent
import com.intellij.openapi.components.Service
import com.intellij.openapi.components.State
import com.intellij.openapi.components.Storage
import com.intellij.openapi.components.service
import com.intellij.util.xmlb.XmlSerializerUtil

@Service(Service.Level.APP)
@State(name = "GoLspSettings", storages = [Storage("goLsp.xml")])
class GoLspSettings : PersistentStateComponent<GoLspSettings.State> {
    private var state = State()

    override fun getState(): State = state

    override fun loadState(state: State) {
        XmlSerializerUtil.copyBean(state, this.state)
    }

    class State {
        var goPath: String = ""
        var goplsPath: String = ""
        var dlvPath: String = ""
        var staticcheck: Boolean = true
        var semanticTokens: Boolean = true
    }

    companion object {
        fun getInstance(): GoLspSettings = service()
    }
}
