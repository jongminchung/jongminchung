import { Banner } from "@astryxdesign/core/Banner";
import type { Locale } from "@/lib/content-model";

export function DeprecatedBanner({ locale }: { readonly locale: Locale }) {
  return (
    <Banner
      status="warning"
      container="card"
      title={
        locale === "ko" ? "Deprecated: 신규 사용 중단" : "Deprecated: do not adopt for new work"
      }
      description={
        locale === "ko"
          ? "1.0.0 계약은 유지되지만 신규 UI는 Astryx 0.1.5를 사용하세요."
          : "The 1.0.0 contract remains available, but new UI should use Astryx 0.1.5."
      }
    />
  );
}
