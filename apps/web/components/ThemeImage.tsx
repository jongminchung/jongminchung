import Image, { type ImageProps } from "next/image";

type ThemeImageProps = Omit<
  ImageProps,
  "fetchPriority" | "loading" | "preload" | "src"
> &
  Readonly<{
    srcLight: ImageProps["src"];
    srcDark: ImageProps["src"];
    eager?: boolean;
  }>;

/** 동일한 시각 개념의 light·dark 이미지를 현재 테마에 맞춰 노출함 */
export function ThemeImage({
  className,
  srcLight,
  srcDark,
  eager = false,
  ...props
}: ThemeImageProps): React.JSX.Element {
  const fetchPriority = eager ? "high" : undefined;
  return (
    <>
      <Image
        {...props}
        className={className}
        data-theme-image="light"
        fetchPriority={fetchPriority}
        loading="lazy"
        src={srcLight}
      />
      <Image
        {...props}
        className={className}
        data-theme-image="dark"
        fetchPriority={fetchPriority}
        loading="lazy"
        src={srcDark}
      />
    </>
  );
}
