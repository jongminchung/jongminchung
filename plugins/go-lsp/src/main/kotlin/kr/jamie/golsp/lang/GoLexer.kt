package kr.jamie.golsp.lang

import com.intellij.lexer.LexerBase
import com.intellij.psi.TokenType
import com.intellij.psi.tree.IElementType

class GoLexer : LexerBase() {
    private var buffer: CharSequence = ""
    private var bufferEnd = 0
    private var tokenStart = 0
    private var tokenEnd = 0
    private var tokenType: IElementType? = null
    private var currentState = DEFAULT
    private var tokenState = DEFAULT

    override fun start(buffer: CharSequence, startOffset: Int, endOffset: Int, initialState: Int) {
        this.buffer = buffer
        bufferEnd = endOffset
        tokenStart = startOffset
        tokenEnd = startOffset
        currentState = initialState
        locateToken()
    }

    override fun getState(): Int = tokenState

    override fun getTokenType(): IElementType? = tokenType

    override fun getTokenStart(): Int = tokenStart

    override fun getTokenEnd(): Int = tokenEnd

    override fun advance() {
        tokenStart = tokenEnd
        locateToken()
    }

    override fun getBufferSequence(): CharSequence = buffer

    override fun getBufferEnd(): Int = bufferEnd

    private fun locateToken() {
        if (tokenStart >= bufferEnd) {
            tokenType = null
            tokenEnd = bufferEnd
            return
        }

        tokenState = currentState
        when (currentState) {
            BLOCK_COMMENT -> scanBlockComment()
            RAW_STRING -> scanRawString()
            else -> scanDefault()
        }
    }

    private fun scanDefault() {
        val first = buffer[tokenStart]
        when {
            first.isWhitespace() -> scanWhile(TokenType.WHITE_SPACE) { it.isWhitespace() }
            startsWith("//") -> scanLineComment()
            startsWith("/*") -> {
                currentState = BLOCK_COMMENT
                scanBlockComment()
            }
            first == '`' -> {
                currentState = RAW_STRING
                scanRawString()
            }
            first == '"' -> scanQuoted(GoTokenTypes.STRING, '"')
            first == '\'' -> scanQuoted(GoTokenTypes.RUNE, '\'')
            first.isDigit() -> scanWhile(GoTokenTypes.NUMBER) {
                it.isLetterOrDigit() || it == '.' || it == '_'
            }
            isIdentifierStart(first) -> scanIdentifier()
            else -> finish(GoTokenTypes.OPERATOR, tokenStart + 1)
        }
    }

    private fun scanLineComment() {
        var offset = tokenStart + 2
        while (offset < bufferEnd && buffer[offset] != '\n' && buffer[offset] != '\r') {
            offset++
        }
        finish(GoTokenTypes.LINE_COMMENT, offset)
    }

    private fun scanBlockComment() {
        var offset = tokenStart
        while (offset + 1 < bufferEnd) {
            if (buffer[offset] == '*' && buffer[offset + 1] == '/') {
                currentState = DEFAULT
                finish(GoTokenTypes.BLOCK_COMMENT, offset + 2)
                return
            }
            offset++
        }
        finish(GoTokenTypes.BLOCK_COMMENT, bufferEnd)
    }

    private fun scanRawString() {
        var offset = if (buffer[tokenStart] == '`') tokenStart + 1 else tokenStart
        while (offset < bufferEnd) {
            if (buffer[offset] == '`') {
                currentState = DEFAULT
                finish(GoTokenTypes.STRING, offset + 1)
                return
            }
            offset++
        }
        finish(GoTokenTypes.STRING, bufferEnd)
    }

    private fun scanQuoted(type: IElementType, quote: Char) {
        var offset = tokenStart + 1
        var escaped = false
        while (offset < bufferEnd) {
            val current = buffer[offset]
            if (!escaped && current == quote) {
                finish(type, offset + 1)
                return
            }
            if (!escaped && (current == '\n' || current == '\r')) {
                finish(type, offset)
                return
            }
            escaped = !escaped && current == '\\'
            offset++
        }
        finish(type, bufferEnd)
    }

    private fun scanIdentifier() {
        var offset = tokenStart + 1
        while (offset < bufferEnd && isIdentifierPart(buffer[offset])) {
            offset++
        }
        val text = buffer.subSequence(tokenStart, offset).toString()
        finish(if (text in KEYWORDS) GoTokenTypes.KEYWORD else GoTokenTypes.IDENTIFIER, offset)
    }

    private inline fun scanWhile(type: IElementType, predicate: (Char) -> Boolean) {
        var offset = tokenStart + 1
        while (offset < bufferEnd && predicate(buffer[offset])) {
            offset++
        }
        finish(type, offset)
    }

    private fun finish(type: IElementType, end: Int) {
        tokenType = type
        tokenEnd = end
    }

    private fun startsWith(value: String): Boolean {
        if (tokenStart + value.length > bufferEnd) return false
        return value.indices.all { buffer[tokenStart + it] == value[it] }
    }

    private fun isIdentifierStart(char: Char): Boolean = char == '_' || Character.isUnicodeIdentifierStart(char)

    private fun isIdentifierPart(char: Char): Boolean = char == '_' || Character.isUnicodeIdentifierPart(char)

    private companion object {
        const val DEFAULT = 0
        const val BLOCK_COMMENT = 1
        const val RAW_STRING = 2

        val KEYWORDS = setOf(
            "break", "case", "chan", "const", "continue", "default", "defer", "else",
            "fallthrough", "for", "func", "go", "goto", "if", "import", "interface",
            "map", "package", "range", "return", "select", "struct", "switch", "type", "var",
        )
    }
}
