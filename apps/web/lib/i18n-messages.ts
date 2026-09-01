import type { AbstractIntlMessages } from "next-intl";
import en from "../messages/en.json";
import ko from "../messages/ko.json";
import type { Locale } from "./content-contracts.ts";

const messages = { en, ko } as const satisfies Record<
  Locale,
  AbstractIntlMessages
>;

/** route locale에 맞는 직렬화 가능한 공용 UI 메시지를 반환함 */
export function messagesFor(locale: Locale): AbstractIntlMessages {
  return messages[locale];
}

/** 클라이언트 테마 제어에 필요한 접근성 라벨 템플릿만 반환함 */
export function themeLabelTemplateFor(locale: Locale): string {
  return messages[locale].shared.theme.label;
}

/** 공용 문서 목차에 필요한 라벨만 반환함 */
export function documentOutlineLabelsFor(locale: Locale) {
  return messages[locale].tech.outline;
}
