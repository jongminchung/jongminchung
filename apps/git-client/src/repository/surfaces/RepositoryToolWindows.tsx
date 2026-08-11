import type { ReactNode } from "react";
import { RepositoryLoadingSkeleton } from "../RepositoryChrome";

interface RepositoryToolWindowsProps {
  readonly children: ReactNode;
  readonly loading: boolean;
}

export function RepositoryToolWindows({ children, loading }: RepositoryToolWindowsProps) {
  return (
    <main
      aria-busy={loading}
      className="workspace [grid-row:2_/_4] [min-height:0] [position:relative] [html[data-navigation-bar=top]_&]:pt-[29px]! workspace"
    >
      {loading ? (
        <RepositoryLoadingSkeleton />
      ) : (
        <div className="workbench [display:grid] [grid-template-columns:39px_minmax(0,_1fr)_35px] [height:100%] [min-height:0] [min-width:0] [html[data-tool-window-bars-visible=false]_&]:grid-cols-[0_minmax(0,1fr)_0]! [html[data-distraction-free-mode=true]_&]:grid-cols-[0_minmax(0,1fr)_0]! [html[data-presentation-mode=true]_&]:grid-cols-[0_minmax(0,1fr)_0]! workbench">
          {children}
        </div>
      )}
    </main>
  );
}
