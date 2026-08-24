import { ExcalidrawDiagram } from "./ExcalidrawDiagram";

interface ExcalidrawTransitionFixtureProps {
  readonly firstSource: string;
}

/** Playwright에서 scene identity 전환을 검증하는 격리 fixture임 */
export function ExcalidrawTransitionFixture({
  firstSource,
}: ExcalidrawTransitionFixtureProps): React.JSX.Element {
  return (
    <main
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100dvh",
      }}
    >
      <ExcalidrawDiagram
        ariaLabel="Scene transition fixture"
        source={firstSource}
        variant="standalone"
      />
    </main>
  );
}
