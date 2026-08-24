import { createContext, useContext, type Context, type ReactNode } from "react";
import type { RepositoryWorkspaceFeatureModel } from "./useRepositoryWorkspaceFeature";

const EditorCapabilityContext = createContext<
  RepositoryWorkspaceFeatureModel["editor"] | null
>(null);
const ReviewCapabilityContext = createContext<
  RepositoryWorkspaceFeatureModel["review"] | null
>(null);
const VcsCapabilityContext = createContext<
  RepositoryWorkspaceFeatureModel["vcs"] | null
>(null);
const ToolWindowCapabilityContext = createContext<
  RepositoryWorkspaceFeatureModel["toolWindows"] | null
>(null);
const OverlayCapabilityContext = createContext<
  RepositoryWorkspaceFeatureModel["overlays"] | null
>(null);

export function RepositoryWorkspaceFeatureProvider({
  children,
  model,
}: {
  readonly children: ReactNode;
  readonly model: RepositoryWorkspaceFeatureModel;
}) {
  return (
    <EditorCapabilityContext.Provider value={model.editor}>
      <ReviewCapabilityContext.Provider value={model.review}>
        <VcsCapabilityContext.Provider value={model.vcs}>
          <ToolWindowCapabilityContext.Provider value={model.toolWindows}>
            <OverlayCapabilityContext.Provider value={model.overlays}>
              {children}
            </OverlayCapabilityContext.Provider>
          </ToolWindowCapabilityContext.Provider>
        </VcsCapabilityContext.Provider>
      </ReviewCapabilityContext.Provider>
    </EditorCapabilityContext.Provider>
  );
}

function useCapability<Capability>(
  context: Context<Capability | null>,
): Capability {
  const capability = useContext(context);
  if (!capability) {
    throw new Error(
      "Repository workspace features require their composition provider",
    );
  }
  return capability;
}

export const useRepositoryEditorCapability = () =>
  useCapability(EditorCapabilityContext);
export const useRepositoryReviewCapability = () =>
  useCapability(ReviewCapabilityContext);
export const useRepositoryVcsCapability = () =>
  useCapability(VcsCapabilityContext);
export const useRepositoryToolWindowCapability = () =>
  useCapability(ToolWindowCapabilityContext);
export const useRepositoryOverlayCapability = () =>
  useCapability(OverlayCapabilityContext);
