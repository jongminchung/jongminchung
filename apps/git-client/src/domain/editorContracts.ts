export type EditorSearchAction =
    | "find"
    | "replace"
    | "next"
    | "previous"
    | "nextWord"
    | "previousWord"
    | "selectionScope";

export type EditorAction =
    | "selectAllOccurrences"
    | "selectNextOccurrence"
    | "unselectOccurrence"
    | "addCaretsToLineEnds"
    | "extendSelection"
    | "shrinkSelection"
    | "toggleCase"
    | "joinLines"
    | "duplicate"
    | "fillParagraph"
    | "sortLines"
    | "reverseLines"
    | "transpose"
    | "indent"
    | "unindent"
    | "convertIndentsToSpaces"
    | "convertIndentsToTabs"
    | "expandFold"
    | "expandAllFolds"
    | "collapseFold"
    | "collapseAllFolds"
    | "toggleFold"
    | "lineComment"
    | "blockComment"
    | "moveStatementDown"
    | "moveStatementUp"
    | "moveLineDown"
    | "moveLineUp"
    | "nextMethod"
    | "previousMethod"
    | "matchingBrace"
    | "undo"
    | "redo";

export interface EditorStatus {
    readonly path: string;
    readonly line: number;
    readonly column: number;
    readonly readOnly: boolean;
    readonly language: string;
    readonly lineSeparator: "LF" | "CRLF";
    readonly indentation: string;
    readonly columnSelection: boolean;
    readonly symbol?: string;
    readonly selectedText?: string;
}
