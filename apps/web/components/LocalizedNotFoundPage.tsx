import { NotFoundPage } from "#components/NotFoundPage";

/** `LocalizedNotFoundPage` 페이지 UI를 렌더링함 */
export function LocalizedNotFoundPage(): React.JSX.Element {
  return (
    <>
      <div
        className="hidden [html:lang(en)_&]:block"
        data-locale-option="en"
        lang="en"
      >
        <NotFoundPage locale="en" />
      </div>
      <div
        className="hidden [html:lang(ko)_&]:block"
        data-locale-option="ko"
        lang="ko"
      >
        <NotFoundPage locale="ko" />
      </div>
    </>
  );
}
