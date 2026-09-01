import { getHomeContent, getHomeMessages } from "#lib/home/content";
import type { Locale } from "#lib/site-routing";

/** `WorkSection` UI 컴포넌트를 렌더링함 */
export function WorkSection({ locale }: { readonly locale: Locale }) {
  const { projects } = getHomeContent(locale);
  const text = getHomeMessages(locale);
  return (
    <section
      className="mx-auto w-full max-w-[1600px] border-t bg-card px-[clamp(20px,4vw,64px)] py-[clamp(78px,10vw,150px)]"
      id="work"
      aria-labelledby="work-title"
    >
      <div className="mb-15 grid grid-cols-[minmax(0,1.3fr)_minmax(260px,.7fr)] items-end gap-15 max-[720px]:mb-9.5 max-[720px]:grid-cols-1 max-[720px]:gap-7">
        <div>
          <p className="mb-5.5 font-mono text-[11px] font-semibold tracking-[.11em] text-primary">
            SELECTED WORK / 2026
          </p>
          <h2
            className="m-0 max-w-212.5 text-[clamp(40px,5.2vw,72px)] leading-[.96] font-semibold tracking-[-.05em]"
            id="work-title"
          >
            {text.workTitle}
          </h2>
        </div>
      </div>
      <div className="border-t border-foreground">
        {projects.map((project) => (
          <a
            className="grid grid-cols-[minmax(250px,.9fr)_minmax(300px,1.1fr)_minmax(250px,.8fr)] items-center gap-[clamp(24px,4vw,70px)] border-b py-[38px] transition-[padding,background] hover:bg-background/70 hover:px-[18px] max-[980px]:grid-cols-[minmax(220px,.8fr)_minmax(0,1.2fr)] max-[720px]:grid-cols-1 max-[720px]:gap-[22px] max-[720px]:py-[30px] max-[720px]:hover:px-2.5"
            data-project="true"
            href={project.href}
            key={project.index}
          >
            <div className="grid grid-cols-[42px_1fr] items-baseline">
              <span className="font-mono text-[10px] tracking-[.08em] text-primary uppercase">
                {project.index}
              </span>
              <span className="font-mono text-[10px] tracking-[.08em] text-muted-foreground uppercase">
                {project.category}
              </span>
              <h3 className="col-start-2 mt-2 mb-0 text-[clamp(25px,2.7vw,42px)] leading-none tracking-[-.055em] break-words">
                {project.title}
              </h3>
            </div>
            <p className="m-0 text-[15px] leading-[1.65] text-muted-foreground">
              {project.description}
            </p>
            <div className="flex items-center justify-between gap-5 max-[980px]:col-start-2 max-[720px]:col-auto">
              <ul
                className="m-0 flex list-none flex-wrap gap-2 p-0"
                aria-label={`${project.title} technologies`}
              >
                {project.tags.map((tag) => (
                  <li
                    className="rounded-full border px-2.5 py-1.5 font-mono text-[9px] tracking-[.04em]"
                    key={tag}
                  >
                    {tag}
                  </li>
                ))}
              </ul>
              <span
                className="grid size-11 shrink-0 place-items-center rounded-full border border-foreground text-xl transition-transform group-hover:rotate-[8deg]"
                aria-hidden="true"
              >
                ↗
              </span>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}
