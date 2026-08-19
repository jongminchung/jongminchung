import { describe, expect, it } from "vitest";
import {
    repositoryOnboardingDismissed,
    setRepositoryOnboardingDismissed,
} from "./repositoryOnboardingPersistence";

describe("repository onboarding persistence", () => {
    it("[성공] dismiss와 reset을 repository별로 분리함", () => {
        let value: string | null = null;
        const storage = {
            getItem: () => value,
            setItem: (_key: string, next: string) => {
                value = next;
            },
        };
        setRepositoryOnboardingDismissed(storage, "repo-a", true);
        expect(repositoryOnboardingDismissed(storage, "repo-a")).toBe(true);
        expect(repositoryOnboardingDismissed(storage, "repo-b")).toBe(false);
        setRepositoryOnboardingDismissed(storage, "repo-a", false);
        expect(repositoryOnboardingDismissed(storage, "repo-a")).toBe(false);
    });
});
