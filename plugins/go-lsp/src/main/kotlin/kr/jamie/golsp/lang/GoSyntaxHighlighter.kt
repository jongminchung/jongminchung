package kr.jamie.golsp.lang

import com.intellij.lexer.Lexer
import com.intellij.openapi.editor.DefaultLanguageHighlighterColors
import com.intellij.openapi.editor.HighlighterColors
import com.intellij.openapi.editor.colors.TextAttributesKey
import com.intellij.openapi.fileTypes.SyntaxHighlighterBase
import com.intellij.psi.TokenType
import com.intellij.psi.tree.IElementType

class GoSyntaxHighlighter : SyntaxHighlighterBase() {
    override fun getHighlightingLexer(): Lexer = GoLexer()

    override fun getTokenHighlights(tokenType: IElementType): Array<TextAttributesKey> = when (tokenType) {
        GoTokenTypes.KEYWORD -> pack(KEYWORD)
        GoTokenTypes.NUMBER -> pack(NUMBER)
        GoTokenTypes.STRING -> pack(STRING)
        GoTokenTypes.RUNE -> pack(RUNE)
        GoTokenTypes.LINE_COMMENT -> pack(LINE_COMMENT)
        GoTokenTypes.BLOCK_COMMENT -> pack(BLOCK_COMMENT)
        GoTokenTypes.OPERATOR -> pack(OPERATOR)
        TokenType.BAD_CHARACTER -> pack(BAD_CHARACTER)
        else -> TextAttributesKey.EMPTY_ARRAY
    }

    private companion object {
        val KEYWORD = TextAttributesKey.createTextAttributesKey("GO_KEYWORD", DefaultLanguageHighlighterColors.KEYWORD)
        val NUMBER = TextAttributesKey.createTextAttributesKey("GO_NUMBER", DefaultLanguageHighlighterColors.NUMBER)
        val STRING = TextAttributesKey.createTextAttributesKey("GO_STRING", DefaultLanguageHighlighterColors.STRING)
        val RUNE = TextAttributesKey.createTextAttributesKey("GO_RUNE", DefaultLanguageHighlighterColors.STRING)
        val LINE_COMMENT = TextAttributesKey.createTextAttributesKey("GO_LINE_COMMENT", DefaultLanguageHighlighterColors.LINE_COMMENT)
        val BLOCK_COMMENT = TextAttributesKey.createTextAttributesKey("GO_BLOCK_COMMENT", DefaultLanguageHighlighterColors.BLOCK_COMMENT)
        val OPERATOR = TextAttributesKey.createTextAttributesKey("GO_OPERATOR", DefaultLanguageHighlighterColors.OPERATION_SIGN)
        val BAD_CHARACTER = TextAttributesKey.createTextAttributesKey("GO_BAD_CHARACTER", HighlighterColors.BAD_CHARACTER)
    }
}
