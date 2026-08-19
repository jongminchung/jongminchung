"use client";

import { useState } from "react";
import { ExcalidrawDiagram } from "./ExcalidrawDiagram";

interface ExcalidrawTransitionFixtureProps {
    readonly firstSource: string;
    readonly secondSource: string;
}

/** Playwright에서 scene identity 전환을 검증하는 격리 fixture임 */
export function ExcalidrawTransitionFixture({
    firstSource,
    secondSource,
}: ExcalidrawTransitionFixtureProps): React.JSX.Element {
    const [showSecond, setShowSecond] = useState(false);
    return (
        <main
            style={{
                display: "flex",
                flexDirection: "column",
                height: "100dvh",
            }}
        >
            <button onClick={() => setShowSecond((current) => !current)}>
                {showSecond ? "Show first scene" : "Show second scene"}
            </button>
            <ExcalidrawDiagram
                ariaLabel="Scene transition fixture"
                source={showSecond ? secondSource : firstSource}
                variant="standalone"
            />
        </main>
    );
}
