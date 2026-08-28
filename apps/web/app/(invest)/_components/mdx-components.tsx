import type { MDXComponents } from "mdx/types";
import Image from "next/image";

function ArticleFigure({
  src,
  alt,
  caption,
  width = 1536,
  height = 1024,
  eager = false,
}: {
  readonly src: string;
  readonly alt: string;
  readonly caption: string;
  readonly width?: number;
  readonly height?: number;
  readonly eager?: boolean;
}) {
  return (
    <figure className="my-10">
      <Image
        alt={alt}
        className="h-auto w-full border object-cover"
        height={height}
        loading={eager ? "eager" : "lazy"}
        sizes="(max-width: 600px) calc(100vw - 32px), (max-width: 824px) calc(100vw - 64px), 760px"
        src={src}
        width={width}
      />
      <figcaption className="mt-3 text-xs leading-5 text-muted-foreground">
        {caption}
      </figcaption>
    </figure>
  );
}

function KeyPoints({
  title,
  items,
}: {
  readonly title: string;
  readonly items: readonly string[];
}) {
  return (
    <section className="my-10 border-y py-6" aria-label={title}>
      <p className="m-0 font-mono text-[11px] font-semibold tracking-[.1em] text-primary uppercase">
        {title}
      </p>
      <ul className="mt-5 mb-0 grid list-none gap-4 p-0">
        {items.map((item, index) => (
          <li className="grid grid-cols-[28px_1fr] gap-3" key={item}>
            <span className="font-mono text-xs text-primary">
              {String(index + 1).padStart(2, "0")}
            </span>
            <span className="leading-[1.65]">{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ComparisonTable({
  caption,
  headers,
  rows,
  note,
}: {
  readonly caption: string;
  readonly headers: readonly string[];
  readonly rows: readonly (readonly string[])[];
  readonly note?: string;
}) {
  return (
    <figure className="my-8">
      <div className="overflow-x-auto border">
        <table className="w-full min-w-[620px] border-collapse text-left text-sm">
          <caption className="border-b bg-muted/45 px-4 py-3 text-left font-medium">
            {caption}
          </caption>
          <thead>
            <tr className="border-b">
              {headers.map((header) => (
                <th
                  className="px-4 py-3 font-mono text-[11px] font-semibold tracking-[.04em] text-muted-foreground uppercase"
                  key={header}
                  scope="col"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr className="border-b last:border-0" key={row.join(":")}>
                {row.map((cell, index) => (
                  <td
                    className="px-4 py-3 align-top first:font-medium"
                    key={`${String(index)}:${cell}`}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {note === undefined ? null : (
        <figcaption className="mt-3 text-xs leading-5 text-muted-foreground">
          {note}
        </figcaption>
      )}
    </figure>
  );
}

function VideoEmbed({
  id,
  title,
}: {
  readonly id: string;
  readonly title: string;
}) {
  return (
    <figure className="my-10">
      <div className="aspect-video overflow-hidden border bg-black">
        <iframe
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          className="h-full w-full"
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          src={`https://www.youtube-nocookie.com/embed/${id}`}
          title={title}
        />
      </div>
    </figure>
  );
}

export const investmentMdxComponents = {
  ArticleFigure,
  ComparisonTable,
  KeyPoints,
  VideoEmbed,
} satisfies MDXComponents;
