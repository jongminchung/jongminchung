import type { ReactNode } from "react";
import { RepositoryLoadingSkeleton } from "./RepositoryChrome";

interface RepositoryToolWindowsProps {
  readonly children: ReactNode;
  readonly loading: boolean;
}

export function RepositoryToolWindows({
  children,
  loading,
}: RepositoryToolWindowsProps) {
  return (
    <main
      aria-busy={loading}
      className="workspace workspace [position:relative] [grid-row:2_/_4] [min-height:0] [html[data-navigation-bar=top]_&]:pt-[29px]!"
    >
      {loading ? (
        <RepositoryLoadingSkeleton />
      ) : (
        <div className="workbench workbench [display:grid] [height:100%] [min-height:0] [min-width:0] [grid-template-columns:39px_minmax(0,_1fr)_35px] [html[data-distraction-free-mode=true]_&]:grid-cols-[0_minmax(0,1fr)_0]! [html[data-presentation-mode=true]_&]:grid-cols-[0_minmax(0,1fr)_0]! [html[data-tool-window-bars-visible=false]_&]:grid-cols-[0_minmax(0,1fr)_0]!">
          {children}
        </div>
      )}
    </main>
  );
}
