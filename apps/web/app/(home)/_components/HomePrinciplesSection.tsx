import { getHomeContent, getHomeMessages } from "#lib/home/content";
import type { Locale } from "#lib/site-routing";

/** `PrinciplesSection` UI 컴포넌트를 렌더링함 */
export function PrinciplesSection({ locale }: { readonly locale: Locale }) {
  const { principles } = getHomeContent(locale);
  const text = getHomeMessages(locale).principles;
  return (
    <section
      className="mx-auto grid w-full max-w-[1600px] grid-cols-[minmax(0,.9fr)_minmax(360px,1.1fr)] gap-[clamp(54px,9vw,150px)] bg-primary px-[clamp(20px,4vw,64px)] py-[clamp(82px,11vw,170px)] text-primary-foreground max-[980px]:grid-cols-1"
      id="principles"
      aria-labelledby="principles-title"
    >
      <div>
        <p className="mb-5.5 font-mono text-[11px] font-semibold tracking-[.11em] text-primary-foreground">
          README / HOW I WORK
        </p>
        <h2
          className="m-0 max-w-212.5 text-[clamp(40px,5.2vw,72px)] leading-[.96] font-semibold tracking-[-.05em]"
          id="principles-title"
        >
          {text.title}
        </h2>
        <p className="mt-8.5 mb-0 max-w-145 text-[17px] leading-[1.7] text-primary-foreground">
          {text.description}
        </p>
      </div>
      <ol className="m-0 list-none border-t border-primary-foreground/54 p-0">
        {principles.map((principle, index) => (
          <li
            className="grid grid-cols-[54px_1fr] gap-4.5 border-b border-primary-foreground/32 py-7.5"
            key={principle.key}
          >
            <span className="font-mono text-[11px] text-primary-foreground">
              0{index + 1}
            </span>
            <div>
              <h3 className="mt-0 mb-2 text-[clamp(22px,2.2vw,32px)] tracking-[-.03em]">
                {principle.title}
              </h3>
              <p className="m-0 text-[15px] leading-[1.6]">{principle.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
