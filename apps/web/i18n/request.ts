import { getRequestConfig } from "next-intl/server";
import { messagesFor } from "#lib/i18n-messages";

// 모든 locale route가 명시적 provider를 사용하므로 request config는
// global-not-found 같은 locale 외부 경계의 정적 fallback만 제공함
export default getRequestConfig(() => ({
  locale: "en",
  messages: messagesFor("en"),
}));
