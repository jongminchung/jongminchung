import Image, { type ImageProps } from "next/image";

type EditorialImageProps = Omit<
  ImageProps,
  "fetchPriority" | "loading" | "preload"
> &
  Readonly<{
    eager?: boolean;
  }>;

/** 양쪽 테마에서 공통으로 사용하는 단일 editorial 이미지를 노출함 */
export function EditorialImage({
  eager = false,
  ...props
}: EditorialImageProps): React.JSX.Element {
  return (
    <Image
      {...props}
      fetchPriority={eager ? "high" : undefined}
      loading="lazy"
    />
  );
}
