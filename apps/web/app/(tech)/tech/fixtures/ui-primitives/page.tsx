import { notFound } from "next/navigation";
import { PrimitiveInteractionFixture } from "./PrimitiveInteractionFixture";

/** Playwright build에서만 공용 UI interaction fixture를 제공함 */
export default function PrimitiveInteractionFixturePage(): React.JSX.Element {
  if (process.env.PLAYWRIGHT_TEST !== "1") notFound();
  return <PrimitiveInteractionFixture />;
}
