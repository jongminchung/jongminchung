package kr.jamie.golsp.debug

import com.intellij.openapi.project.Project
import com.intellij.openapi.vfs.VirtualFile
import com.intellij.util.xmlb.XmlSerializerUtil
import com.intellij.xdebugger.breakpoints.XBreakpointProperties
import com.intellij.xdebugger.breakpoints.XLineBreakpointType

class GoLineBreakpointProperties : XBreakpointProperties<GoLineBreakpointProperties>() {
    override fun getState(): GoLineBreakpointProperties = this

    override fun loadState(state: GoLineBreakpointProperties) {
        XmlSerializerUtil.copyBean(state, this)
    }
}

class GoLineBreakpointType : XLineBreakpointType<GoLineBreakpointProperties>(
    "go-lsp-line",
    "Go line breakpoints",
) {
    override fun canPutAt(file: VirtualFile, line: Int, project: Project): Boolean = file.extension == "go"

    override fun createBreakpointProperties(file: VirtualFile, line: Int): GoLineBreakpointProperties =
        GoLineBreakpointProperties()
}
