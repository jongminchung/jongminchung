import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { notFound } from "next/navigation";
import { ExcalidrawTransitionFixture } from "#tech-components/ExcalidrawTransitionFixture";

function createSecondScene(source: string): string {
    const scene = JSON.parse(source) as {
        readonly elements: readonly Readonly<Record<string, unknown>>[];
    };
    return JSON.stringify({
        ...scene,
        elements: scene.elements.map((element) => {
            if (typeof element.text !== "string") return element;
            const text = element.text.toUpperCase();
            return { ...element, text, originalText: text, rawText: text };
        }),
    });
}

/** Playwright build에서만 scene 전환 fixture를 제공함 */
export default async function ExcalidrawTransitionFixturePage(): Promise<React.JSX.Element> {
    if (process.env.PLAYWRIGHT_TEST !== "1") notFound();
    const firstSource = await readFile(
        resolve(process.cwd(), "public/diagrams/operating-system.excalidraw"),
        "utf8",
    );
    return (
        <ExcalidrawTransitionFixture
            firstSource={firstSource}
            secondSource={createSecondScene(firstSource)}
        />
    );
}
