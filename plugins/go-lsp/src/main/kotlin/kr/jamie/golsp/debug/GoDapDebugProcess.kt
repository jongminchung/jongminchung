package kr.jamie.golsp.debug

import com.intellij.execution.ExecutionException
import com.intellij.execution.configurations.GeneralCommandLine
import com.intellij.execution.process.KillableColoredProcessHandler
import com.intellij.execution.process.ProcessHandler
import com.intellij.execution.ui.ConsoleViewContentType
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.components.service
import com.intellij.openapi.vfs.LocalFileSystem
import com.intellij.openapi.vfs.VirtualFileManager
import com.intellij.util.execution.ParametersListUtil
import com.intellij.xdebugger.XDebugProcess
import com.intellij.xdebugger.XDebugSession
import com.intellij.xdebugger.XSourcePosition
import com.intellij.xdebugger.breakpoints.XBreakpointHandler
import com.intellij.xdebugger.breakpoints.XLineBreakpoint
import com.intellij.xdebugger.evaluation.XDebuggerEditorsProvider
import com.intellij.xdebugger.frame.XCompositeNode
import com.intellij.xdebugger.frame.XExecutionStack
import com.intellij.xdebugger.frame.XStackFrame
import com.intellij.xdebugger.frame.XSuspendContext
import com.intellij.xdebugger.frame.XValue
import com.intellij.xdebugger.frame.XValueChildrenList
import com.intellij.xdebugger.frame.XValueNode
import com.intellij.xdebugger.frame.XValuePlace
import com.intellij.xdebugger.impl.XSourcePositionImpl
import kr.jamie.golsp.lang.GoFileType
import kr.jamie.golsp.run.GoCommandKind
import kr.jamie.golsp.run.GoRunConfiguration
import kr.jamie.golsp.tools.GoTool
import kr.jamie.golsp.tools.GoToolchainService
import org.eclipse.lsp4j.debug.ConfigurationDoneArguments
import org.eclipse.lsp4j.debug.ContinueArguments
import org.eclipse.lsp4j.debug.DisconnectArguments
import org.eclipse.lsp4j.debug.InitializeRequestArguments
import org.eclipse.lsp4j.debug.NextArguments
import org.eclipse.lsp4j.debug.OutputEventArguments
import org.eclipse.lsp4j.debug.PauseArguments
import org.eclipse.lsp4j.debug.ScopesArguments
import org.eclipse.lsp4j.debug.SetBreakpointsArguments
import org.eclipse.lsp4j.debug.Source
import org.eclipse.lsp4j.debug.SourceBreakpoint
import org.eclipse.lsp4j.debug.StackFrame
import org.eclipse.lsp4j.debug.StackTraceArguments
import org.eclipse.lsp4j.debug.StepInArguments
import org.eclipse.lsp4j.debug.StepOutArguments
import org.eclipse.lsp4j.debug.StoppedEventArguments
import org.eclipse.lsp4j.debug.Variable
import org.eclipse.lsp4j.debug.VariablesArguments
import org.eclipse.lsp4j.debug.launch.DSPLauncher
import org.eclipse.lsp4j.debug.services.IDebugProtocolClient
import org.eclipse.lsp4j.debug.services.IDebugProtocolServer
import java.net.ConnectException
import java.net.InetSocketAddress
import java.net.ServerSocket
import java.net.Socket
import java.nio.charset.StandardCharsets
import java.util.concurrent.CompletableFuture
import java.util.concurrent.TimeUnit

class GoDapDebugProcess(
    session: XDebugSession,
    private val configuration: GoRunConfiguration,
) : XDebugProcess(session) {
    private val port = ServerSocket(0).use { it.localPort }
    private val processHandler: KillableColoredProcessHandler
    private val breakpoints = linkedMapOf<String, MutableSet<XLineBreakpoint<GoLineBreakpointProperties>>>()
    private val breakpointHandler = GoBreakpointHandler()
    @Volatile private var server: IDebugProtocolServer? = null
    @Volatile private var dapInitialized: Boolean = false
    @Volatile private var activeThreadId: Int = 1
    private lateinit var socket: Socket

    init {
        val dlv = configuration.project.service<GoToolchainService>().require(GoTool.DLV)
        val commandLine = GeneralCommandLine(dlv.toString(), "dap", "--listen=127.0.0.1:$port", "--log")
            .withCharset(StandardCharsets.UTF_8)
            .withWorkDirectory(workingDirectory())
        processHandler = KillableColoredProcessHandler(commandLine)
        connectAndInitialize()
    }

    override fun doGetProcessHandler(): ProcessHandler = processHandler

    override fun getEditorsProvider(): XDebuggerEditorsProvider = object : XDebuggerEditorsProvider() {
        override fun getFileType() = GoFileType
    }

    override fun getBreakpointHandlers(): Array<XBreakpointHandler<*>> = arrayOf(breakpointHandler)

    override fun resume(context: XSuspendContext?) {
        server?.continue_(ContinueArguments().apply { threadId = activeThreadId })
    }

    override fun startPausing() {
        server?.pause(PauseArguments().apply { threadId = activeThreadId })
    }

    override fun startStepOver(context: XSuspendContext?) {
        server?.next(NextArguments().apply { threadId = activeThreadId })
    }

    override fun startStepInto(context: XSuspendContext?) {
        server?.stepIn(StepInArguments().apply { threadId = activeThreadId })
    }

    override fun startStepOut(context: XSuspendContext?) {
        server?.stepOut(StepOutArguments().apply { threadId = activeThreadId })
    }

    override fun stop() {
        server?.disconnect(DisconnectArguments().apply { terminateDebuggee = true })
        if (::socket.isInitialized) runCatching { socket.close() }
        processHandler.destroyProcess()
    }

    private fun connectAndInitialize() {
        socket = connectWithRetry()
        val client = GoDapClient()
        val launcher = DSPLauncher.createClientLauncher(client, socket.getInputStream(), socket.getOutputStream())
        server = launcher.remoteProxy
        launcher.startListening()

        val initialize = InitializeRequestArguments().apply {
            clientID = "intellij-go-lsp"
            clientName = "IntelliJ Go LSP"
            adapterID = "go"
            linesStartAt1 = true
            columnsStartAt1 = true
            pathFormat = "path"
            supportsVariableType = true
            supportsVariablePaging = true
        }
        server!!.initialize(initialize).thenCompose {
            server!!.launch(launchArguments())
        }.exceptionally { error ->
            session.reportError("Delve could not start: ${error.cause?.message ?: error.message}")
            null
        }
    }

    private fun launchArguments(): Map<String, Any> {
        val options = configuration.goOptions
        val debugArguments = ParametersListUtil.parse(options.arguments.orEmpty()).toMutableList()
        if (configuration.kind() == GoCommandKind.TEST && !options.testName.isNullOrBlank()) {
            debugArguments.addAll(0, listOf("-test.run", "^${java.util.regex.Pattern.quote(options.testName)}$"))
        }
        return mapOf(
            "name" to configuration.name,
            "type" to "go",
            "request" to "launch",
            "mode" to if (configuration.kind() == GoCommandKind.TEST) "test" else "debug",
            "program" to resolveProgram(options.target.orEmpty()),
            "cwd" to workingDirectory(),
            "args" to debugArguments,
            "stopOnEntry" to false,
        )
    }

    private fun workingDirectory(): String = configuration.goOptions.workingDirectory.orEmpty()
        .ifBlank { configuration.project.basePath.orEmpty() }

    private fun resolveProgram(target: String): String = when {
        target.isBlank() || target == "." -> workingDirectory()
        java.nio.file.Path.of(target).isAbsolute -> target
        else -> java.nio.file.Path.of(workingDirectory()).resolve(target).normalize().toString()
    }

    private fun connectWithRetry(): Socket {
        val deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(10)
        var lastError: Exception? = null
        while (System.nanoTime() < deadline) {
            try {
                return Socket().apply { connect(InetSocketAddress("127.0.0.1", port), 500) }
            } catch (error: ConnectException) {
                lastError = error
                Thread.sleep(100)
            }
        }
        throw ExecutionException("Timed out while connecting to Delve.", lastError)
    }

    private fun syncBreakpoints() {
        breakpoints.keys.toList().forEach(::syncBreakpointsForFile)
    }

    private fun syncBreakpointsForFile(fileUrl: String) {
        if (!dapInitialized) return
        val dap = server ?: return
        val file = VirtualFileManager.getInstance().findFileByUrl(fileUrl) ?: return
        val registered = breakpoints[fileUrl].orEmpty().sortedBy { it.line }
        val arguments = SetBreakpointsArguments().apply {
            source = Source().apply {
                name = file.name
                path = file.path
            }
            breakpoints = registered.map { breakpoint ->
                SourceBreakpoint().apply { line = breakpoint.line + 1 }
            }.toTypedArray()
        }
        dap.setBreakpoints(arguments).thenAccept { response ->
            response.breakpoints.orEmpty().forEachIndexed { index, result ->
                registered.getOrNull(index)?.let { breakpoint ->
                    ApplicationManager.getApplication().invokeLater {
                        if (result.isVerified) session.setBreakpointVerified(breakpoint)
                        else session.setBreakpointInvalid(breakpoint, result.message ?: "Delve rejected this breakpoint.")
                    }
                }
            }
        }
    }

    private fun handleStopped(event: StoppedEventArguments) {
        activeThreadId = event.threadId ?: 1
        val dap = server ?: return
        dap.threads().thenCompose { threadResponse ->
            val threads = threadResponse.threads.orEmpty()
            val stackFutures = threads.associateWith { thread ->
                dap.stackTrace(StackTraceArguments().apply { threadId = thread.id })
            }
            CompletableFuture.allOf(*stackFutures.values.toTypedArray()).thenApply {
                threads.map { thread ->
                    val frames = stackFutures.getValue(thread).join().stackFrames.orEmpty()
                    GoDapExecutionStack(thread.id, thread.name, frames.toList())
                }
            }
        }.thenAccept { stacks ->
            val context = GoDapSuspendContext(stacks, stacks.firstOrNull { it.threadId == activeThreadId })
            ApplicationManager.getApplication().invokeLater { session.positionReached(context) }
        }.exceptionally { error ->
            session.reportError("Could not read Delve stack: ${error.cause?.message ?: error.message}")
            null
        }
    }

    private inner class GoDapClient : IDebugProtocolClient {
        override fun initialized() {
            dapInitialized = true
            syncBreakpoints()
            server?.configurationDone(ConfigurationDoneArguments())
        }

        override fun stopped(args: StoppedEventArguments) = handleStopped(args)

        override fun continued(args: org.eclipse.lsp4j.debug.ContinuedEventArguments) {
            ApplicationManager.getApplication().invokeLater(session::sessionResumed)
        }

        override fun terminated(args: org.eclipse.lsp4j.debug.TerminatedEventArguments) {
            ApplicationManager.getApplication().invokeLater(session::stop)
        }

        override fun output(args: OutputEventArguments) {
            val type = if (args.category == "stderr") ConsoleViewContentType.ERROR_OUTPUT else ConsoleViewContentType.NORMAL_OUTPUT
            ApplicationManager.getApplication().invokeLater { session.consoleView.print(args.output.orEmpty(), type) }
        }
    }

    private inner class GoBreakpointHandler :
        XBreakpointHandler<XLineBreakpoint<GoLineBreakpointProperties>>(GoLineBreakpointType::class.java) {
        override fun registerBreakpoint(breakpoint: XLineBreakpoint<GoLineBreakpointProperties>) {
            breakpoints.getOrPut(breakpoint.fileUrl) { linkedSetOf() }.add(breakpoint)
            syncBreakpointsForFile(breakpoint.fileUrl)
        }

        override fun unregisterBreakpoint(breakpoint: XLineBreakpoint<GoLineBreakpointProperties>, temporary: Boolean) {
            breakpoints[breakpoint.fileUrl]?.remove(breakpoint)
            syncBreakpointsForFile(breakpoint.fileUrl)
        }
    }

    private inner class GoDapSuspendContext(
        private val stacks: List<GoDapExecutionStack>,
        private val active: GoDapExecutionStack?,
    ) : XSuspendContext() {
        override fun getActiveExecutionStack(): XExecutionStack? = active ?: stacks.firstOrNull()
        override fun getExecutionStacks(): Array<XExecutionStack> = stacks.toTypedArray()
    }

    private inner class GoDapExecutionStack(
        val threadId: Int,
        name: String,
        frames: List<StackFrame>,
    ) : XExecutionStack(name) {
        private val stackFrames = frames.map(::GoDapStackFrame)
        override fun getTopFrame(): XStackFrame? = stackFrames.firstOrNull()
        override fun computeStackFrames(firstFrameIndex: Int, container: XStackFrameContainer) {
            container.addStackFrames(stackFrames.drop(firstFrameIndex), true)
        }
    }

    private inner class GoDapStackFrame(private val frame: StackFrame) : XStackFrame() {
        override fun getSourcePosition(): XSourcePosition? {
            val path = frame.source?.path ?: return null
            val file = LocalFileSystem.getInstance().findFileByPath(path) ?: return null
            return XSourcePositionImpl.create(file, (frame.line - 1).coerceAtLeast(0))
        }

        override fun customizePresentation(component: com.intellij.ui.ColoredTextContainer) {
            component.append(frame.name, com.intellij.ui.SimpleTextAttributes.REGULAR_ATTRIBUTES)
        }

        override fun computeChildren(node: XCompositeNode) {
            val dap = server ?: return node.setErrorMessage("Delve is not connected.")
            dap.scopes(ScopesArguments().apply { frameId = frame.id }).thenAccept { response ->
                val children = XValueChildrenList()
                response.scopes.orEmpty().forEach { scope ->
                    children.add(scope.name, GoDapValue(scope.name, "", scope.variablesReference))
                }
                node.addChildren(children, true)
            }.exceptionally { error ->
                node.setErrorMessage(error.cause?.message ?: error.message.orEmpty())
                null
            }
        }
    }

    private inner class GoDapValue(
        private val name: String,
        private val displayValue: String,
        private val variablesReference: Int,
        private val type: String = "",
    ) : XValue() {
        override fun computePresentation(node: XValueNode, place: XValuePlace) {
            node.setPresentation(null, type, displayValue, variablesReference > 0)
        }

        override fun computeChildren(node: XCompositeNode) {
            if (variablesReference <= 0) return node.addChildren(XValueChildrenList.EMPTY, true)
            val dap = server ?: return node.setErrorMessage("Delve is not connected.")
            dap.variables(VariablesArguments().apply { this.variablesReference = this@GoDapValue.variablesReference })
                .thenAccept { response ->
                    val children = XValueChildrenList()
                    response.variables.orEmpty().forEach { variable: Variable ->
                        children.add(variable.name, GoDapValue(variable.name, variable.value, variable.variablesReference, variable.type.orEmpty()))
                    }
                    node.addChildren(children, true)
                }.exceptionally { error ->
                    node.setErrorMessage(error.cause?.message ?: error.message.orEmpty())
                    null
                }
        }
    }
}
