import type { CSSProperties, ComponentProps } from "react";
import styles from "./MaterialMedia.module.css";

interface MaterialMediaProps {
  readonly caption?: string;
  readonly maxWidth?: string | number;
  readonly width?: string | number;
}

function cssSize(value: string | number | undefined): string | undefined {
  if (value === undefined) return undefined;
  return typeof value === "number" ? `${value}px` : value;
}

function mediaStyle({ width, maxWidth }: MaterialMediaProps): CSSProperties {
  return {
    "--material-media-width": cssSize(width) ?? "100%",
    "--material-media-max-width": cssSize(maxWidth) ?? "100%",
  } as CSSProperties;
}

export function MaterialImage({
  caption,
  expandable: _expandable,
  maxWidth,
  width,
  alt,
  ...props
}: MaterialMediaProps & ComponentProps<"img"> & { readonly expandable?: boolean }) {
  return (
    <figure className={styles.media} style={mediaStyle({ width, maxWidth })}>
      {/* The source material controls dimensions; these assets are copied and immutable. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img {...props} alt={alt ?? caption ?? ""} loading="lazy" />
      {caption === undefined ? null : <figcaption>{caption}</figcaption>}
    </figure>
  );
}

export function MaterialVideo({
  caption,
  maxWidth,
  width,
  ...props
}: MaterialMediaProps & ComponentProps<"video">) {
  return (
    <figure className={styles.media} style={mediaStyle({ width, maxWidth })}>
      <video {...props} controls={!props.autoPlay} preload="metadata" />
      {caption === undefined ? null : <figcaption>{caption}</figcaption>}
    </figure>
  );
}
