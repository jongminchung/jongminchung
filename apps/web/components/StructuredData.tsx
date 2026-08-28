/** 검증된 객체를 XSS-safe JSON-LD script로 직렬화함 */
export function StructuredData({
  value,
}: {
  readonly value: Readonly<Record<string, unknown>>;
}): React.JSX.Element {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(value).replaceAll("<", "\\u003c"),
      }}
    />
  );
}
