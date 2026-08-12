// Boundary exception: Electron native surfaces and standalone HTML documents require sRGB colors.
export const NATIVE_WINDOW_BACKGROUND = "#26282c";

export const EXPORTED_DOCUMENT_COLOR_VARIABLES = [
    "--document-background-dark:#1e1f22",
    "--document-foreground-dark:#bcbec4",
    "--document-header-dark:#2b2d30",
    "--document-border-dark:#393b40",
    "--document-header-foreground-dark:#dfe1e5",
    "--document-line-number-dark:#6f737a",
    "--document-background-light:#fff",
    "--document-foreground-light:#1f2328",
    "--document-header-light:#f2f3f5",
    "--document-border-light:#d8dadd",
    "--document-line-number-light:#8c8f94",
].join(";");

export const SHORTCUT_DOCUMENT_COLOR_VARIABLES = [
    "--document-foreground:#202124",
    "--document-muted-foreground:#5f6368",
    "--document-border:#dadce0",
].join(";");
