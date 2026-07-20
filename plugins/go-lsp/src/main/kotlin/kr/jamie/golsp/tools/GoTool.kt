package kr.jamie.golsp.tools

enum class GoTool(val executableName: String, val installPackage: String?) {
    GO("go", null),
    GOPLS("gopls", "golang.org/x/tools/gopls@latest"),
    DLV("dlv", "github.com/go-delve/delve/cmd/dlv@latest"),
}
