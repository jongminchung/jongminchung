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
