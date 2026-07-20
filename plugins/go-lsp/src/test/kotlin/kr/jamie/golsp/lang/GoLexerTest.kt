package kr.jamie.golsp.lang

import com.intellij.lexer.Lexer
import com.intellij.psi.TokenType
import com.intellij.psi.tree.IElementType
import org.junit.Assert.assertEquals
import org.junit.Test

class GoLexerTest {
    @Test
    fun `tokenizes representative Go source without gaps`() {
        val source = """
            package main

            // greeting
            func main() {
                value := `hello`
                println(value, 42)
            }
        """.trimIndent()

        val tokens = lex(source)

        assertEquals(source, tokens.joinToString("") { it.text })
        assertEquals(1, tokens.count { it.type == GoTokenTypes.LINE_COMMENT })
        assertEquals(2, tokens.count { it.type == GoTokenTypes.KEYWORD })
        assertEquals(1, tokens.count { it.type == GoTokenTypes.STRING })
        assertEquals(1, tokens.count { it.type == GoTokenTypes.NUMBER })
    }

    @Test
    fun `keeps multiline comments and raw strings as single tokens`() {
        val source = "/* first\nsecond */ `line one\nline two`"

        val significant = lex(source).filter { it.type != TokenType.WHITE_SPACE }

        assertEquals(
            listOf(GoTokenTypes.BLOCK_COMMENT, GoTokenTypes.STRING),
            significant.map(Token::type),
        )
    }

    private fun lex(source: String): List<Token> {
        val lexer: Lexer = GoLexer()
        lexer.start(source)
        return buildList {
            while (lexer.tokenType != null) {
                add(Token(lexer.tokenType!!, source.substring(lexer.tokenStart, lexer.tokenEnd)))
                lexer.advance()
            }
        }
    }

    private data class Token(val type: IElementType, val text: String)
}
