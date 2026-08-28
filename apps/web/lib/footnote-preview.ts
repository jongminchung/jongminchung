/** 연결된 각주 마크업을 미리보기용으로 복제하고 정규화함 */
export function createFootnotePreviewHtml(
  href: string,
  ownerDocument: Document = document,
): string | null {
  if (!href.startsWith("#") || href.length === 1) return null;

  let targetId: string;
  try {
    targetId = decodeURIComponent(href.slice(1));
  } catch {
    return null;
  }

  const target = ownerDocument.getElementById(targetId);
  if (target === null) return null;

  const preview = target.cloneNode(true) as HTMLElement;
  preview.removeAttribute("id");
  for (const element of preview.querySelectorAll("[id]")) {
    element.removeAttribute("id");
  }
  for (const backReference of preview.querySelectorAll(
    "[data-footnote-backref]",
  )) {
    backReference.remove();
  }
  for (const link of preview.querySelectorAll<HTMLAnchorElement>("a[href]")) {
    link.target = "_blank";
    link.rel = "noopener noreferrer";
  }

  const html = preview.innerHTML.trim();
  return html.length === 0 ? null : html;
}
