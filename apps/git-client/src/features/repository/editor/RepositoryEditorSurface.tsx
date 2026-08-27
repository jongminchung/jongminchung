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
      className={`workbenchSurface workbenchSurface [display:grid] [min-height:0] [min-width:0] [grid-template-rows:minmax(0,_1fr)_auto] [background:var(--background)] ${maximizedToolWindow === "bottom" ? "maximizedBottomTool maximizedBottomTool [grid-template-rows:minmax(0,_1fr)] [&>_.workbenchContent]:[display:none] [&>_[data-tool-window-position=bottom]]:[height:100%!important]" : ""}`}
    >
      {children}
    </div>
  );
}
