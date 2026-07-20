package kr.jamie.golsp.run

import org.junit.Assert.assertTrue
import org.junit.Test

class GoTestEventConverterTest {
    @Test
    fun `creates a test tree from go test json`() {
        val converter = GoTestEventConverter()

        val started = converter.convert("""{"Action":"run","Package":"example.dev/app","Test":"TestWorks"}""")
        val passed = converter.convert("""{"Action":"pass","Package":"example.dev/app","Test":"TestWorks","Elapsed":0.125}""")

        assertTrue(started.contains("testSuiteStarted"))
        assertTrue(started.contains("testStarted"))
        assertTrue(passed.contains("testFinished"))
        assertTrue(passed.contains("duration='125'"))
    }

    @Test
    fun `escapes test output for service messages`() {
        val output = GoTestEventConverter().convert(
            """{"Action":"output","Package":"example.dev/app","Test":"TestWorks","Output":"a|'[b]\n"}""",
        )

        assertTrue(output.contains("a|||'|[b|]|n"))
    }
}
