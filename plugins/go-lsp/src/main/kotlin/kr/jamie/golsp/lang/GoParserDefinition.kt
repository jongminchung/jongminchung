package kr.jamie.golsp.lang

import com.intellij.lang.ASTNode
import com.intellij.lang.ParserDefinition
import com.intellij.lang.PsiBuilder
import com.intellij.lang.PsiParser
import com.intellij.lexer.Lexer
import com.intellij.openapi.project.Project
import com.intellij.psi.FileViewProvider
import com.intellij.psi.PsiElement
import com.intellij.psi.PsiFile
import com.intellij.psi.TokenType
import com.intellij.extapi.psi.ASTWrapperPsiElement
import com.intellij.psi.tree.IFileElementType
import com.intellij.psi.tree.TokenSet

class GoParserDefinition : ParserDefinition {
    override fun createLexer(project: Project?): Lexer = GoLexer()

    override fun createParser(project: Project?): PsiParser = PsiParser { root, builder ->
        parseFile(root, builder)
    }

    override fun getFileNodeType(): IFileElementType = FILE

    override fun getWhitespaceTokens(): TokenSet = TokenSet.create(TokenType.WHITE_SPACE)

    override fun getCommentTokens(): TokenSet = TokenSet.create(
        GoTokenTypes.LINE_COMMENT,
        GoTokenTypes.BLOCK_COMMENT,
    )

    override fun getStringLiteralElements(): TokenSet = TokenSet.create(
        GoTokenTypes.STRING,
        GoTokenTypes.RUNE,
    )

    override fun createElement(node: ASTNode): PsiElement = ASTWrapperPsiElement(node)

    override fun createFile(viewProvider: FileViewProvider): PsiFile = GoPsiFile(viewProvider)

    private fun parseFile(root: com.intellij.psi.tree.IElementType, builder: PsiBuilder): ASTNode {
        val file = builder.mark()
        while (!builder.eof()) {
            builder.advanceLexer()
        }
        file.done(root)
        return builder.treeBuilt
    }

    private companion object {
        val FILE = IFileElementType("GO_FILE", GoLanguage)
    }
}
