import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import { unified } from "unified";
import { afterEach, describe, expect, it } from "vitest";
import remarkPlantUml, { createPlantUmlSvgUrl, encodePlantUmlSource } from "./index.js";

const tempRoots: string[] = [];

interface RenderMarkdownOptions {
  readonly contentRoot?: string;
  readonly path?: string;
}

async function renderMarkdown(
  markdown: string,
  options: RenderMarkdownOptions = {},
): Promise<string> {
  const result = await unified()
    .use(remarkParse)
    .use(remarkPlantUml, {
      serverBaseUrl: "/assets/plantuml/svg",
      ...(options.contentRoot ? { contentRoot: options.contentRoot } : {}),
    })
    .use(remarkStringify)
    .process({ value: markdown, path: options.path });

  return String(result);
}

async function createTempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "remark-plantuml-"));
  tempRoots.push(root);
  return root;
}

function plantUmlSource(title = "PlantUML flow"): string {
  return ["@startuml", `title ${title}`, "Alice -> Bob: hello", "@enduml", ""].join("\n");
}

afterEach(async (): Promise<void> => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { force: true, recursive: true })));
});

describe("remarkPlantUml", () => {
  it("renders PlantUML code fences as SVG image URLs", async () => {
    const output = await renderMarkdown(`
\`\`\`plantuml
${plantUmlSource("Fence diagram")}
\`\`\`
`);

    expect(output).toContain('class="plantuml-diagram"');
    expect(output).toContain('<img src="/assets/plantuml/svg/');
    expect(output).toContain('alt="PlantUML diagram"');
    expect(output).not.toContain("Fence diagram");
    expect(output).not.toContain("Alice -> Bob");
  });

  it("renders local .puml links and images as SVG image URLs", async () => {
    const directory = await createTempRoot();
    const nestedDirectory = join(directory, "nested");
    await mkdir(nestedDirectory);

    await writeFile(join(directory, "diagram.puml"), plantUmlSource("Linked diagram"), "utf8");
    await writeFile(
      join(nestedDirectory, "image.plantuml"),
      plantUmlSource("Image diagram"),
      "utf8",
    );

    const output = await renderMarkdown(
      ["[Linked diagram](./diagram.puml)", "", "![Image diagram](./nested/image.plantuml)"].join(
        "\n",
      ),
      {
        contentRoot: directory,
        path: join(directory, "index.md"),
      },
    );

    expect(output.split('<img src="/assets/plantuml/svg/')).toHaveLength(3);
    expect(output).toContain("<figcaption>Linked diagram</figcaption>");
    expect(output).toContain("<figcaption>Image diagram</figcaption>");
    expect(output).not.toContain("diagram.puml");
    expect(output).not.toContain("nested/image.plantuml");
  });

  it("keeps non-PlantUML code and external links unchanged", async () => {
    const output = await renderMarkdown(`
\`\`\`text
${plantUmlSource("Plain text")}
\`\`\`

[Remote diagram](https://example.com/diagram.puml)
`);

    expect(output).toContain("Plain text");
    expect(output).toContain("https://example.com/diagram.puml");
    expect(output).not.toContain('class="plantuml-diagram"');
  });

  it("rejects local PlantUML links outside the content root", async () => {
    const directory = await createTempRoot();
    const outsideDirectory = await createTempRoot();
    await writeFile(join(outsideDirectory, "outside.puml"), plantUmlSource("Outside"), "utf8");

    await expect(
      renderMarkdown("[Outside](../outside.puml)", {
        contentRoot: directory,
        path: join(directory, "index.md"),
      }),
    ).rejects.toThrow("PlantUML link must stay inside docs content root");
  });

  it("requires an explicit PlantUML server base URL", () => {
    expect(() => remarkPlantUml({ serverBaseUrl: "" })).toThrow(
      "PlantUML serverBaseUrl is required",
    );
  });
});

describe("PlantUML URL helpers", () => {
  it("encodes sources into PlantUML server URLs", () => {
    const source = plantUmlSource("Encoded");

    expect(createPlantUmlSvgUrl(source, "https://plantuml.example.com/plantuml/svg/")).toBe(
      `https://plantuml.example.com/plantuml/svg/${encodePlantUmlSource(source)}`,
    );
  });
});
