import { NextIntlClientProvider } from "next-intl";
import { notFound } from "next/navigation";
import { EditorialCard } from "#components/EditorialCard";
import { messagesFor } from "#lib/i18n-messages";
import { EngineeringCard } from "#tech-components/EngineeringCard";
import { PrimitiveInteractionFixture } from "./PrimitiveInteractionFixture";
import { SearchCompositionFixture } from "./SearchCompositionFixture";

/** Playwright build에서만 공용 UI interaction fixture를 제공함 */
export default function PrimitiveInteractionFixturePage(): React.JSX.Element {
  if (process.env.PLAYWRIGHT_TEST !== "1") notFound();
  const item = {
    id: "long-korean-title",
    href: "#card-composition-title",
    title:
      "긴 한국어 제목에서도 기술 문서와 투자 리서치 카드의 읽기 흐름과 줄바꿈이 유지되는지 확인합니다",
    description:
      "동일한 콘텐츠로 이미지 비율, 메타데이터와 설명의 표현을 확인합니다.",
    publishedAt: "2026-09-06",
    kind: "문서",
    mediaSeed: "composition-preview",
    tags: [],
  };
  return (
    <PrimitiveInteractionFixture>
      <NextIntlClientProvider locale="ko" messages={messagesFor("ko")}>
        <SearchCompositionFixture />
      </NextIntlClientProvider>
      <section className="grid gap-3" aria-labelledby="card-composition-title">
        <h2 className="text-lg font-medium" id="card-composition-title">
          긴 한국어 카드 제목
        </h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <EditorialCard item={item} />
          <EngineeringCard item={item} />
        </div>
      </section>
    </PrimitiveInteractionFixture>
  );
}
