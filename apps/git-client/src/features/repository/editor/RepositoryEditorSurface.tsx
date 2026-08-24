import type { ReactNode } from "react";
import type { RepositoryToolWindow } from "../state/workspaceTypes";

interface RepositoryEditorSurfaceProps {
  readonly children: ReactNode;
  readonly maximizedToolWindow: RepositoryToolWindow | null;
}

export function RepositoryEditorSurface({
  children,
  maximizedToolWindow,
}: RepositoryEditorSurfaceProps) {
  return (
    <div
      className={`workbenchSurface [background:var(--background)] [display:grid] [grid-template-rows:minmax(0,_1fr)_auto] [min-height:0] [min-width:0] workbenchSurface ${maximizedToolWindow === "bottom" ? "maximizedBottomTool [grid-template-rows:minmax(0,_1fr)] [&>_.workbenchContent]:[display:none] [&>_[data-tool-window-position=bottom]]:[height:100%!important] maximizedBottomTool" : ""}`}
    >
      {children}
    </div>
  );
}
