import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceArgument = process.argv.find((argument) => argument.startsWith("--source="));
if (sourceArgument === undefined) {
  throw new Error(
    "Usage: node scripts/import-kciter-documents.ts --source=/path/to/kciter.github.io",
  );
}
const sourceRoot = resolve(sourceArgument.slice("--source=".length));

interface DocumentDefinition {
  readonly date: string;
  readonly descriptionEn: string;
  readonly descriptionKo: string;
  readonly englishSource?: string;
  readonly koreanSource?: string;
  readonly order: number;
  readonly sourceUrl: string;
  readonly stable: boolean;
  readonly tags: readonly string[];
  readonly titleEn: string;
  readonly titleKo: string;
  readonly topic: string;
}

const publicPost = (topic: string): string => `https://kciter.so/posts/${topic}/`;
const draftSource = (file: string): string =>
  `https://github.com/kciter/kciter.github.io/blob/develop/src/drafts/2026/${file}`;
const materialSource = (topic: string): string =>
  `https://github.com/kciter/kciter.github.io/blob/develop/src/materials/${topic}/index.ts`;

const documents: readonly DocumentDefinition[] = [
  {
    topic: "server-monitoring-analysis-guide",
    titleKo: "서버 모니터링 분석 가이드",
    titleEn: "Server Monitoring Analysis Guide",
    descriptionKo:
      "핵심 서버 지표의 패턴을 읽고 증상에서 원인으로 좁혀 가는 모니터링 분석 방법을 설명합니다.",
    descriptionEn:
      "Learn to read core server metrics and narrow incidents from symptoms to root causes.",
    date: "2026-07-20",
    order: 5,
    stable: true,
    tags: ["backend", "monitoring", "devops", "software-engineering"],
    koreanSource: "src/posts/2026/2026-07-20-server-monitoring-analysis-guide.mdx",
    sourceUrl: publicPost("server-monitoring-analysis-guide"),
  },
  {
    topic: "the-expensive-main-thread",
    titleKo: "브라우저의 메인 스레드는 비싸다",
    titleEn: "The Browser's Main Thread Is Expensive",
    descriptionKo:
      "브라우저 메인 스레드의 프레임 예산, 작업 분할, 우선순위, 렌더링 비용을 인터랙티브하게 분석합니다.",
    descriptionEn:
      "Explore frame budgets, task chunking, priorities, and rendering costs on the browser main thread.",
    date: "2026-07-12",
    order: 6,
    stable: true,
    tags: ["frontend", "performance", "browser", "animation"],
    koreanSource: "src/posts/2026/2026-07-12-the-expensive-main-thread.mdx",
    englishSource: "src/posts/2026/2026-07-12-the-expensive-main-thread.en.mdx",
    sourceUrl: publicPost("the-expensive-main-thread"),
  },
  {
    topic: "feeling-claude-blue",
    titleKo: "만약 당신이 클로드 블루 때문에 힘들다면",
    titleEn: "If You're Struggling with Claude Blue",
    descriptionKo:
      "LLM API, 도구 사용, 컨텍스트, 스킬과 하네스를 분해해 코딩 에이전트의 동작을 이해합니다.",
    descriptionEn:
      "Understand coding agents by decomposing LLM APIs, tool use, context, skills, and harnesses.",
    date: "2026-04-03",
    order: 7,
    stable: true,
    tags: ["ai", "llm", "agent", "software-engineering"],
    koreanSource: "src/posts/2026/2026-04-03-feeling-claude-blue.mdx",
    sourceUrl: publicPost("feeling-claude-blue"),
  },
  {
    topic: "it-is-the-boundary-stupid",
    titleKo: "바보야, 문제는 경계야!",
    titleEn: "It's the Boundary, Stupid!",
    descriptionKo:
      "호출자와 피호출자, 데이터, 신뢰, 시간과 조직의 경계가 설계를 어떻게 바꾸는지 살펴봅니다.",
    descriptionEn:
      "See how caller, data, trust, time, scale, and organizational boundaries shape software design.",
    date: "2026-03-20",
    order: 8,
    stable: true,
    tags: ["architecture", "design", "boundaries", "software-engineering"],
    koreanSource: "src/posts/2026/2026-03-20-it-is-the-boundary-stupid.mdx",
    sourceUrl: publicPost("it-is-the-boundary-stupid"),
  },
  {
    topic: "how-to-design-animation",
    titleKo: "애니메이션을 설계하는 방법",
    titleEn: "How to Design an Animation",
    descriptionKo:
      "그래프, 이징, 스프링, 파이프라인과 결정적 랜덤을 이용해 애니메이션을 설계합니다.",
    descriptionEn:
      "Design animation with graphs, easing, springs, pipelines, and deterministic randomness.",
    date: "2026-02-18",
    order: 9,
    stable: true,
    tags: ["frontend", "animation", "design", "math"],
    koreanSource: "src/posts/2026/2026-02-18-how-to-design-animation.mdx",
    englishSource: "src/posts/2026/2026-02-18-how-to-design-animation.en.mdx",
    sourceUrl: publicPost("how-to-design-animation"),
  },
  {
    topic: "modeling-series-view-model",
    titleKo: "모델링 시리즈: 뷰모델",
    titleEn: "Modeling Series: View Models",
    descriptionKo:
      "테이블 예제로 화면의 요구사항을 명시적인 뷰모델로 모델링하는 방법을 설명합니다.",
    descriptionEn: "Model presentation requirements explicitly with a table-oriented view model.",
    date: "2025-04-18",
    order: 10,
    stable: true,
    tags: ["modeling", "frontend", "view-model", "architecture"],
    koreanSource: "src/posts/2025/2025-04-18-modeling-series-view-model.mdx",
    sourceUrl: publicPost("modeling-series-view-model"),
  },
  {
    topic: "ascii-3d-renderer",
    titleKo: "ASCII 3D 렌더러 만들기",
    titleEn: "Building an ASCII 3D Renderer",
    descriptionKo: "좌표 변환, 투영, 래스터라이즈와 명암을 구현해 ASCII 3D 렌더러를 만듭니다.",
    descriptionEn:
      "Build an ASCII 3D renderer from coordinate transforms, projection, rasterization, and shading.",
    date: "2024-03-03",
    order: 11,
    stable: true,
    tags: ["graphics", "3d", "ascii", "math"],
    koreanSource: "src/posts/2024/2024-03-03-ascii-3d-renderer.mdx",
    sourceUrl: publicPost("ascii-3d-renderer"),
  },
  {
    topic: "building-3d-illusion-game",
    titleKo: "3D 착시현상 게임 만들어보기",
    titleEn: "Building a 3D Illusion Game",
    descriptionKo: "투영, 인접성, 강제 원근법을 조합해 3D 착시 퍼즐의 규칙을 구현합니다.",
    descriptionEn:
      "Combine projection, adjacency, and forced perspective to implement a 3D illusion puzzle.",
    date: "2026-07-10",
    order: 12,
    stable: false,
    tags: ["graphics", "game", "3d", "geometry"],
    koreanSource: "src/drafts/2026/2026-07-10-building-3d-illusion-game.mdx",
    sourceUrl: draftSource("2026-07-10-building-3d-illusion-game.mdx"),
  },
  {
    topic: "building-coding-agent",
    titleKo: "코딩 에이전트 만들어보기",
    titleEn: "Building a Coding Agent",
    descriptionKo:
      "에이전트 루프, 도구 호출, 컨텍스트 성장과 ablation을 통해 작은 코딩 에이전트를 만듭니다.",
    descriptionEn:
      "Build a small coding agent through its loop, tool calls, context growth, and ablation tests.",
    date: "2026-07-10",
    order: 13,
    stable: false,
    tags: ["ai", "agent", "llm", "tools"],
    koreanSource: "src/drafts/2026/2026-07-10-building-coding-agent.mdx",
    sourceUrl: draftSource("2026-07-10-building-coding-agent.mdx"),
  },
  {
    topic: "building-email-relay-system",
    titleKo: "이메일 릴레이 시스템 만들어보기",
    titleEn: "Building an Email Relay System",
    descriptionKo: "SMTP 세션, 주소 토큰과 회신 파서를 연결해 이메일 릴레이 시스템을 설계합니다.",
    descriptionEn:
      "Design an email relay system from SMTP sessions, address tokens, and reply parsing.",
    date: "2026-07-10",
    order: 14,
    stable: false,
    tags: ["backend", "email", "smtp", "system-design"],
    koreanSource: "src/drafts/2026/2026-07-10-building-email-relay-system.mdx",
    sourceUrl: draftSource("2026-07-10-building-email-relay-system.mdx"),
  },
  {
    topic: "frontend-caching-strategies",
    titleKo: "프론트엔드 캐싱 전략",
    titleEn: "Frontend Caching Strategies",
    descriptionKo:
      "캐시 계층, freshness, stampede, 키와 태그 무효화를 프런트엔드 관점에서 정리합니다.",
    descriptionEn:
      "Study cache layers, freshness, stampedes, keys, and tag invalidation on the frontend.",
    date: "2026-07-10",
    order: 15,
    stable: false,
    tags: ["frontend", "cache", "performance", "architecture"],
    koreanSource: "src/drafts/2026/2026-07-10-frontend-caching-strategies.mdx",
    sourceUrl: draftSource("2026-07-10-frontend-caching-strategies.mdx"),
  },
  {
    topic: "hamssun-python-lisp",
    titleKo: "함수썬: Python Lisp 만들어보기",
    titleEn: "Hamssun: Building a Python Lisp",
    descriptionKo: "S-expression, 평가 과정과 REPL을 구현하며 작은 Lisp 인터프리터를 만듭니다.",
    descriptionEn:
      "Build a small Lisp interpreter through S-expressions, evaluation traces, and a REPL.",
    date: "2026-07-10",
    order: 16,
    stable: false,
    tags: ["language", "interpreter", "python", "lisp"],
    koreanSource: "src/drafts/2026/2026-07-10-hamssun-python-lisp.mdx",
    sourceUrl: draftSource("2026-07-10-hamssun-python-lisp.mdx"),
  },
  {
    topic: "headless-react-component",
    titleKo: "Headless한 React 컴포넌트 만들기",
    titleEn: "Building Headless React Components",
    descriptionKo: "동작과 표현을 분리하고 합성 가능한 Headless React 컴포넌트를 설계합니다.",
    descriptionEn:
      "Separate behavior from presentation to design composable headless React components.",
    date: "2026-07-10",
    order: 17,
    stable: false,
    tags: ["react", "frontend", "components", "accessibility"],
    koreanSource: "src/drafts/2026/2026-07-10-headless-react-component.mdx",
    sourceUrl: draftSource("2026-07-10-headless-react-component.mdx"),
  },
  {
    topic: "react-component-based-thinking",
    titleKo: "React 컴포넌트 기반 사고",
    titleEn: "Thinking in React Components",
    descriptionKo:
      "상태, 데이터 흐름, 컴포넌트 경계와 긴장을 통해 React 컴포넌트 모델을 이해합니다.",
    descriptionEn:
      "Understand React's component model through state, data flow, boundaries, and design tensions.",
    date: "2026-07-10",
    order: 18,
    stable: false,
    tags: ["react", "frontend", "components", "modeling"],
    koreanSource: "src/drafts/2026/2026-07-10-react-component-based-thinking.mdx",
    sourceUrl: draftSource("2026-07-10-react-component-based-thinking.mdx"),
  },
  {
    topic: "beyond-beautiful-code",
    titleKo: "아름다운 코드를 넘어서",
    titleEn: "Beyond Beautiful Code",
    descriptionKo: "코드 미학의 여러 관점과 시스템 변화에 따른 미학의 이동을 살펴봅니다.",
    descriptionEn:
      "Compare perspectives on code aesthetics and how those aesthetics move as systems evolve.",
    date: "2026-07-07",
    order: 19,
    stable: false,
    tags: ["code-quality", "design", "architecture", "maintenance"],
    koreanSource: "src/drafts/2026/2026-07-07-beyond-beautiful-code.mdx",
    sourceUrl: draftSource("2026-07-07-beyond-beautiful-code.mdx"),
  },
  {
    topic: "building-calculator-engine",
    titleKo: "계산기 엔진 만들기",
    titleEn: "Building a Calculator Engine",
    descriptionKo: "토큰화, AST, 부동소수점과 자연스러운 입력을 다루는 계산기 엔진을 구현합니다.",
    descriptionEn:
      "Implement a calculator engine with tokenization, ASTs, floating-point details, and natural input.",
    date: "2026-07-07",
    order: 20,
    stable: false,
    tags: ["parser", "language", "math", "typescript"],
    koreanSource: "src/drafts/2026/2026-07-07-building-calculator-engine.mdx",
    sourceUrl: draftSource("2026-07-07-building-calculator-engine.mdx"),
  },
  {
    topic: "building-nes-emulator",
    titleKo: "NES 에뮬레이터 만들기",
    titleEn: "Building an NES Emulator",
    descriptionKo:
      "6502 CPU, PPU, 타일, 오디오와 WASM을 연결해 브라우저에서 NES를 에뮬레이션합니다.",
    descriptionEn:
      "Connect a 6502 CPU, PPU, tiles, audio, and WebAssembly to emulate the NES in a browser.",
    date: "2026-07-07",
    order: 21,
    stable: false,
    tags: ["emulator", "wasm", "rust", "game"],
    koreanSource: "src/drafts/2026/2026-07-07-building-nes-emulator.mdx",
    sourceUrl: draftSource("2026-07-07-building-nes-emulator.mdx"),
  },
  {
    topic: "encrypted-share-vault-system",
    titleKo: "비밀 공유를 위한 금고 시스템 만들기",
    titleEn: "Building an Encrypted Sharing Vault",
    descriptionKo: "키 계층, 영지식 경계와 공유 흐름을 이용해 암호화 금고 시스템을 설계합니다.",
    descriptionEn:
      "Design an encrypted sharing vault with key hierarchies, zero-knowledge boundaries, and share flows.",
    date: "2026-07-07",
    order: 22,
    stable: false,
    tags: ["security", "cryptography", "system-design", "privacy"],
    koreanSource: "src/drafts/2026/2026-07-07-encrypted-share-vault-system.mdx",
    sourceUrl: draftSource("2026-07-07-encrypted-share-vault-system.mdx"),
  },
  {
    topic: "how-to-whittle-a-skill",
    titleKo: "스킬 깎는 노인이 되는 법",
    titleEn: "How to Whittle a Skill",
    descriptionKo: "progressive disclosure, 분류 사다리와 평가를 통해 에이전트 스킬을 개선합니다.",
    descriptionEn:
      "Improve agent skills through progressive disclosure, classification ladders, and evaluation.",
    date: "2026-07-07",
    order: 23,
    stable: false,
    tags: ["ai", "agent", "skills", "evaluation"],
    koreanSource: "src/drafts/2026/2026-07-07-how-to-whittle-a-skill.mdx",
    sourceUrl: draftSource("2026-07-07-how-to-whittle-a-skill.mdx"),
  },
  {
    topic: "implementing-genetic-algorithm",
    titleKo: "유전 알고리즘 구현해보기",
    titleEn: "Implementing a Genetic Algorithm",
    descriptionKo: "게놈, 선택, 교차와 돌연변이를 구현하고 세대별 진화를 관찰합니다.",
    descriptionEn:
      "Implement genomes, selection, crossover, and mutation, then observe evolution across generations.",
    date: "2026-07-07",
    order: 24,
    stable: false,
    tags: ["algorithm", "genetic-algorithm", "optimization", "visualization"],
    koreanSource: "src/drafts/2026/2026-07-07-implementing-genetic-algorithm.mdx",
    sourceUrl: draftSource("2026-07-07-implementing-genetic-algorithm.mdx"),
  },
  {
    topic: "building-llm",
    titleKo: "나만의 작은 언어 모델 만들어보기",
    titleEn: "Building a Small Language Model",
    descriptionKo: "임베딩, 어텐션, Transformer와 샘플링을 연결해 작은 언어 모델을 이해합니다.",
    descriptionEn:
      "Connect embeddings, attention, transformers, and sampling to understand a small language model.",
    date: "2026-07-05",
    order: 25,
    stable: false,
    tags: ["ai", "llm", "transformer", "machine-learning"],
    koreanSource: "src/drafts/2026/2026-07-05-building-llm.mdx",
    sourceUrl: draftSource("2026-07-05-building-llm.mdx"),
  },
  {
    topic: "do-we-really-know-pagination",
    titleKo: "우리는 정말 페이지네이션을 잘 알고 있을까?",
    titleEn: "Do We Really Understand Pagination?",
    descriptionKo:
      "offset, cursor, tombstone, scatter-gather와 fanout 관점에서 페이지네이션을 분석합니다.",
    descriptionEn:
      "Analyze pagination through offsets, cursors, tombstones, scatter-gather, and fanout.",
    date: "2026-07-05",
    order: 26,
    stable: false,
    tags: ["database", "pagination", "distributed-systems", "backend"],
    koreanSource: "src/drafts/2026/2026-07-05-do-we-really-know-pagination.mdx",
    sourceUrl: draftSource("2026-07-05-do-we-really-know-pagination.mdx"),
  },
  {
    topic: "the-weight-of-trivial-code",
    titleKo: "사소한 코드의 무게",
    titleEn: "The Weight of Trivial Code",
    descriptionKo:
      "await 없는 반환, 가변 기본 인자와 삼값 논리처럼 사소해 보이는 코드의 계약 비용을 분석합니다.",
    descriptionEn:
      "Analyze the contract cost of seemingly trivial choices such as awaitless returns, mutable defaults, and three-valued logic.",
    date: "2026-07-04",
    order: 27,
    stable: false,
    tags: ["code-quality", "types", "contracts", "software-engineering"],
    sourceUrl: materialSource("the-weight-of-trivial-code"),
  },
  {
    topic: "throughput-and-latency",
    titleKo: "처리량과 지연 시간",
    titleEn: "Throughput and Latency",
    descriptionKo:
      "Little의 법칙, 동시성과 병렬성, 실행 모델과 사용률 곡선으로 처리량과 지연의 관계를 설명합니다.",
    descriptionEn:
      "Explain throughput and latency with Little's Law, concurrency, execution models, and utilization curves.",
    date: "2026-07-04",
    order: 28,
    stable: false,
    tags: ["performance", "concurrency", "latency", "system-design"],
    sourceUrl: materialSource("throughput-and-latency"),
  },
];

interface ManifestEntry {
  readonly id: string;
  readonly name: string;
  readonly topic: string;
}

const manifest = JSON.parse(
  await readFile(resolve(appRoot, "generated/materials-manifest.json"), "utf8"),
) as readonly ManifestEntry[];

function transformOutsideCode(source: string, transform: (chunk: string) => string): string {
  const lines = source.split("\n");
  let inFence = false;
  return lines
    .map((line) => {
      if (/^\s*```/u.test(line)) {
        inFence = !inFence;
        return line;
      }
      return inFence ? line : transform(line);
    })
    .join("\n");
}

function shiftHeading(line: string): string {
  const heading = /^(#{1,5})(\s+)/u.exec(line);
  return heading === null ? line : `#${line}`;
}

function transformBody(source: string, topic: string): string {
  const demoNames = manifest.filter((entry) => entry.topic === topic).map((entry) => entry.name);
  let body = matter(source).content;
  body = transformOutsideCode(body, (line) => {
    if (/^\s*import\s/u.test(line)) return "";
    let transformed = shiftHeading(line)
      .replaceAll("client:visible", "")
      .replaceAll("client:load", "")
      .replaceAll("<Image", "<MaterialImage")
      .replaceAll("<Video", "<MaterialVideo")
      .replaceAll('src="/images/', 'src="/materials/images/');
    for (const name of demoNames) {
      const selfClosing = new RegExp(`<${name}\\b[^>]*\\/>`, "gu");
      const opening = new RegExp(`<${name}\\b[^>]*>`, "gu");
      const closing = new RegExp(`</${name}>`, "gu");
      transformed = transformed
        .replace(selfClosing, `<MaterialDemo id="${topic}/${name}" />`)
        .replace(opening, `<MaterialDemo id="${topic}/${name}" />`)
        .replace(closing, "");
    }
    return transformed;
  });

  const referencedIds = new Set(
    [...body.matchAll(/<MaterialDemo\s+id="([^"]+)"\s*\/>/gu)]
      .map((match) => match[1])
      .filter((id): id is string => id !== undefined),
  );
  const missing = manifest.filter((entry) => entry.topic === topic && !referencedIds.has(entry.id));
  if (missing.length > 0) {
    body += "\n\n## 추가 인터랙티브 자료\n\n";
    for (const entry of missing) {
      body += `### ${entry.name}\n\n원문 주제에 포함된 보조 시각 자료다.\n\n<MaterialDemo id="${entry.id}" />\n\n`;
    }
  }
  return body.trim();
}

function generatedBody(definition: DocumentDefinition, locale: "ko" | "en"): string {
  const entries = manifest.filter((entry) => entry.topic === definition.topic);
  const intro =
    locale === "ko"
      ? `${definition.descriptionKo}\n\n이 문서는 원본 자료의 시각적 순서와 상호작용을 보존해 각 개념을 단계별로 살펴본다.`
      : `${definition.descriptionEn}\n\nThis deep dive preserves the source material's visual sequence and interaction model while presenting each concept as an isolated, reproducible demo.`;
  const materialsTitle = locale === "ko" ? "인터랙티브 자료" : "Interactive materials";
  const explanation =
    locale === "ko"
      ? "아래 자료를 직접 조작하며 상태 변화와 경계 조건을 확인한다."
      : "Use each material to inspect state transitions, tradeoffs, and boundary conditions directly.";
  const sections = entries
    .map((entry) => `### ${entry.name}\n\n${explanation}\n\n<MaterialDemo id="${entry.id}" />`)
    .join("\n\n");
  const sourceTitle = locale === "ko" ? "출처와 범위" : "Source and scope";
  const sourceText =
    locale === "ko"
      ? "문서와 데모는 kciter 원본의 기술 용어, 코드 링크, 팔레트와 반응형 배치를 기준으로 이관했다."
      : "The document and demos retain the source terminology, code links, palette, responsive layout, and interaction order.";
  return `## ${locale === "ko" ? "개요" : "Overview"}\n\n${intro}\n\n## ${materialsTitle}\n\n${sections}\n\n## ${sourceTitle}\n\n${sourceText}`;
}

function frontmatter(definition: DocumentDefinition, locale: "ko" | "en"): string {
  const title = locale === "ko" ? definition.titleKo : definition.titleEn;
  const description = locale === "ko" ? definition.descriptionKo : definition.descriptionEn;
  return [
    "---",
    `id: deep-dive/${definition.topic}`,
    `locale: ${locale}`,
    "section: deep-dive",
    `title: ${JSON.stringify(title)}`,
    `description: ${JSON.stringify(description)}`,
    `order: ${definition.order}`,
    `updatedAt: ${JSON.stringify(definition.date)}`,
    'verifiedAt: "2026-08-06"',
    `tags: [${definition.tags.join(", ")}]`,
    `status: ${definition.stable ? "stable" : "experimental"}`,
    `sourceUrl: ${definition.sourceUrl}`,
    "---",
    "",
  ].join("\n");
}

const referencedAssets = new Set<string>();
for (const definition of documents) {
  for (const locale of ["ko", "en"] as const) {
    const sourcePath = locale === "ko" ? definition.koreanSource : definition.englishSource;
    const body =
      sourcePath === undefined
        ? generatedBody(definition, locale)
        : transformBody(await readFile(resolve(sourceRoot, sourcePath), "utf8"), definition.topic);
    for (const match of body.matchAll(/\/materials\/images\/([^"')\s]+)/gu)) {
      if (match[1] !== undefined) referencedAssets.add(match[1]);
    }
    const destinationPath = resolve(appRoot, `content/${locale}/deep-dive/${definition.topic}.mdx`);
    await mkdir(dirname(destinationPath), { recursive: true });
    await writeFile(destinationPath, `${frontmatter(definition, locale)}${body}\n`);
  }
}

for (const assetPath of referencedAssets) {
  const sourcePath = resolve(sourceRoot, "public/images", assetPath);
  const destinationPath = resolve(appRoot, "public/materials/images", assetPath);
  await mkdir(dirname(destinationPath), { recursive: true });
  await copyFile(sourcePath, destinationPath);
}

console.log(
  `Imported ${documents.length} bilingual deep dives and ${referencedAssets.size} referenced media assets.`,
);
