package kr.jamie.golsp.run

import com.google.gson.JsonParser
import com.intellij.execution.configurations.GeneralCommandLine
import com.intellij.execution.process.KillableColoredProcessHandler
import com.intellij.openapi.util.Key

class GoTestProcessHandler(commandLine: GeneralCommandLine) : KillableColoredProcessHandler(commandLine) {
    private val pending = StringBuilder()
    private val converter = GoTestEventConverter()

    override fun coloredTextAvailable(text: String, attributes: Key<*>) {
        pending.append(text)
        while (true) {
            val end = pending.indexOf("\n")
            if (end < 0) break
            val line = pending.substring(0, end)
            pending.delete(0, end + 1)
            super.coloredTextAvailable(converter.convert(line), attributes)
        }
    }
}

internal class GoTestEventConverter {
    private val startedTests = mutableSetOf<String>()
    private val startedPackages = mutableSetOf<String>()

    fun convert(line: String): String {
        val event = runCatching { JsonParser.parseString(line).asJsonObject }.getOrNull()
            ?: return "$line\n"
        val action = event.get("Action")?.asString ?: return "$line\n"
        val pkg = event.get("Package")?.asString.orEmpty()
        val test = event.get("Test")?.asString
        val output = event.get("Output")?.asString.orEmpty()
        val elapsed = ((event.get("Elapsed")?.asDouble ?: 0.0) * 1_000).toLong()
        val messages = StringBuilder()

        if (pkg.isNotBlank() && startedPackages.add(pkg)) {
            messages.append(service("testSuiteStarted", "name" to pkg, "nodeId" to "pkg:$pkg"))
        }
        if (test != null) {
            val id = "$pkg/$test"
            when (action) {
                "run" -> if (startedTests.add(id)) {
                    messages.append(service("testStarted", "name" to test, "nodeId" to id, "parentNodeId" to "pkg:$pkg"))
                }
                "pass" -> messages.append(service("testFinished", "name" to test, "nodeId" to id, "duration" to elapsed.toString()))
                "fail" -> {
                    messages.append(service("testFailed", "name" to test, "nodeId" to id, "message" to "Go test failed", "details" to output))
                    messages.append(service("testFinished", "name" to test, "nodeId" to id, "duration" to elapsed.toString()))
                }
                "skip" -> {
                    messages.append(service("testIgnored", "name" to test, "nodeId" to id, "message" to output.ifBlank { "Skipped" }))
                    messages.append(service("testFinished", "name" to test, "nodeId" to id, "duration" to elapsed.toString()))
                }
                "output" -> messages.append(service("testStdOut", "name" to test, "nodeId" to id, "out" to output))
            }
        } else {
            when (action) {
                "output" -> messages.append(service("testStdOut", "name" to pkg, "nodeId" to "pkg:$pkg", "out" to output))
                "pass", "fail", "skip" -> if (pkg.isNotBlank()) {
                    messages.append(service("testSuiteFinished", "name" to pkg, "nodeId" to "pkg:$pkg"))
                }
            }
        }
        return messages.toString()
    }

    private fun service(name: String, vararg attributes: Pair<String, String>): String = buildString {
        append("##teamcity[").append(name)
        attributes.forEach { (key, value) -> append(' ').append(key).append("='").append(escape(value)).append('\'') }
        append("]\n")
    }

    private fun escape(value: String): String = value
        .replace("|", "||")
        .replace("'", "|'")
        .replace("\n", "|n")
        .replace("\r", "|r")
        .replace("[", "|[")
        .replace("]", "|]")
}
