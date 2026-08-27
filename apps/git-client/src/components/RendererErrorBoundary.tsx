import { Button } from "@jongminchung/ui/components/button";
import { Component, type ReactNode } from "react";
import { electronApi } from "../platform/electron";

interface RendererErrorBoundaryProps {
  readonly children: ReactNode;
}

interface RendererErrorBoundaryState {
  readonly error: Error | null;
}

export class RendererErrorBoundary extends Component<
  RendererErrorBoundaryProps,
  RendererErrorBoundaryState
> {
  override state: RendererErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: unknown): RendererErrorBoundaryState {
    return {
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }

  override componentDidCatch(error: Error): void {
    console.error("[git-client] renderer component failed", error.name);
  }

  override render(): ReactNode {
    if (this.state.error === null) return this.props.children;
    const api = electronApi();
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-8 text-foreground">
        <section
          aria-labelledby="renderer-failure-title"
          className="w-full max-w-xl border border-border bg-card p-6 shadow-sm"
        >
          <h1 className="text-lg font-semibold" id="renderer-failure-title">
            Git Client could not render this window
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your pending Git operation was not retried. Reload this window, or
            restart the application explicitly.
          </p>
          <p
            className="mt-3 font-mono text-xs break-words text-destructive"
            role="alert"
          >
            {this.state.error.message}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button
              onClick={() => window.location.reload()}
              size="sm"
              variant="outline"
            >
              Reload window
            </Button>
            {api !== null && (
              <Button
                onClick={() => void api.maintenance.relaunch(false)}
                size="sm"
                variant="default"
              >
                Restart Git Client
              </Button>
            )}
          </div>
        </section>
      </main>
    );
  }
}
