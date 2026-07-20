package kr.jamie.golsp.lang

import com.intellij.psi.tree.IElementType

object GoTokenTypes {
    @JvmField val KEYWORD = IElementType("GO_KEYWORD", GoLanguage)
    @JvmField val IDENTIFIER = IElementType("GO_IDENTIFIER", GoLanguage)
    @JvmField val NUMBER = IElementType("GO_NUMBER", GoLanguage)
    @JvmField val STRING = IElementType("GO_STRING", GoLanguage)
    @JvmField val RUNE = IElementType("GO_RUNE", GoLanguage)
    @JvmField val LINE_COMMENT = IElementType("GO_LINE_COMMENT", GoLanguage)
    @JvmField val BLOCK_COMMENT = IElementType("GO_BLOCK_COMMENT", GoLanguage)
    @JvmField val OPERATOR = IElementType("GO_OPERATOR", GoLanguage)
}
