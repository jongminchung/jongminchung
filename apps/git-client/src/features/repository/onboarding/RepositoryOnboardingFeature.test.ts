import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { RepositoryOnboardingTask } from "../../../domain/repositoryOnboarding";
import { RepositoryOnboardingPanel } from "./RepositoryOnboardingFeature";

const tasks: readonly RepositoryOnboardingTask[] = [
    {
        id: "review-changes",
        title: "Review local changes",
        description: "2 changed files ready to inspect.",
        commandId: "view.changes",
        complete: false,
    },
    {
        id: "publish-commits",
        title: "Push unpublished commits",
        description: "1 local commit not published yet.",
        commandId: "repository.push",
        complete: false,
        disabledReason: "Reconnect to the network before running this action.",
    },
];

describe("RepositoryOnboardingPanel", () => {
    it("[성공] command ID, 진행도와 비활성 사유를 표시함", () => {
        const markup = renderToStaticMarkup(
            createElement(RepositoryOnboardingPanel, {
                dismissed: false,
                onDismiss: vi.fn(),
                onExecute: vi.fn(),
                onReset: vi.fn(),
                tasks,
            }),
        );
        expect(markup).toContain('aria-label="Git workflow guide"');
        expect(markup).toContain("0 of 2 steps complete");
        expect(markup).toContain("Review local changes: view.changes");
        expect(markup).toContain("Reconnect to the network");
        expect(markup).toMatch(
            /Push unpublished commits: repository\.push[^>]*disabled/,
        );
    });

    it("[성공] dismiss 뒤 repository guide reset 진입점을 유지함", () => {
        const markup = renderToStaticMarkup(
            createElement(RepositoryOnboardingPanel, {
                dismissed: true,
                onDismiss: vi.fn(),
                onExecute: vi.fn(),
                onReset: vi.fn(),
                tasks,
            }),
        );
        expect(markup).toContain('aria-label="Show Git workflow guide"');
        expect(markup).not.toContain("First repository workflow");
    });
});
