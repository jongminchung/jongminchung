import { getLocalizedDocuments } from "#lib/documents";
import { getHomeMessages } from "#lib/home/content";
import { getInvestmentNotes } from "#lib/invest/notes";
import type { Locale } from "#lib/site-routing";

/** `WritingSection` UI 컴포넌트를 렌더링함 */
export async function WritingSection({ locale }: { readonly locale: Locale }) {
  const text = getHomeMessages(locale).writing;
  const [documents, notes] = await Promise.all([
    getLocalizedDocuments(locale),
    getInvestmentNotes(locale),
  ]);
  const tech = documents
    .toSorted((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .slice(0, 3);
  const invest = notes.slice(0, 3);
  return (
    <section
      className="mx-auto w-full max-w-[1600px] border-t px-[clamp(20px,4vw,64px)] py-[clamp(78px,10vw,150px)]"
      id="writing"
      aria-labelledby="writing-title"
    >
      <div className="mb-15 grid grid-cols-[minmax(0,1.3fr)_minmax(260px,.7fr)] items-end gap-15 max-[720px]:mb-9.5 max-[720px]:grid-cols-1 max-[720px]:gap-7">
        <div>
          <p className="mb-5.5 font-mono text-[11px] font-semibold tracking-[.11em] text-primary">
            LATEST WRITING
          </p>
          <h2
            className="m-0 max-w-212.5 text-[clamp(42px,6.4vw,96px)] leading-[.9] tracking-[-.07em]"
            id="writing-title"
          >
            {text.title}
          </h2>
        </div>
        <p className="m-0 text-[17px] leading-[1.7] text-muted-foreground">
          {text.description}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-[clamp(36px,7vw,110px)] max-[720px]:grid-cols-1">
        <div className="[&_a]:grid [&_a]:grid-cols-[104px_1fr_auto] [&_a]:items-baseline [&_a]:gap-[18px] [&_a]:border-b [&_a]:py-[22px] max-[720px]:[&_a]:grid-cols-[86px_1fr_auto] [&_a_span:first-child]:font-mono [&_a_span:first-child]:text-[11px] [&_a_span:first-child]:text-muted-foreground [&_a_strong]:text-lg [&_h3]:m-0 [&_h3]:border-b [&_h3]:border-foreground [&_h3]:pb-[18px] [&_h3]:font-mono [&_h3]:text-xs [&_h3]:tracking-[.08em] [&_h3]:uppercase">
          <h3>Engineering Notes</h3>
          {tech.map((article) => (
            <a key={article.id} href={`https://tech.jamie.kr${article.href}`}>
              <span>{article.publishedAt}</span>
              <strong>{article.title}</strong>
              <span aria-hidden="true">↗</span>
            </a>
          ))}
        </div>
        <div className="[&_a]:grid [&_a]:grid-cols-[104px_1fr_auto] [&_a]:items-baseline [&_a]:gap-[18px] [&_a]:border-b [&_a]:py-[22px] max-[720px]:[&_a]:grid-cols-[86px_1fr_auto] [&_a_span:first-child]:font-mono [&_a_span:first-child]:text-[11px] [&_a_span:first-child]:text-muted-foreground [&_a_strong]:text-lg [&_h3]:m-0 [&_h3]:border-b [&_h3]:border-foreground [&_h3]:pb-4.5 [&_h3]:font-mono [&_h3]:text-xs [&_h3]:tracking-[.08em] [&_h3]:uppercase">
          <h3>Investment Notes</h3>
          {invest.length === 0 ? (
            <p className="m-0 border-b py-7.5 font-mono text-[11px] text-muted-foreground">
              {text.emptyInvestment}
            </p>
          ) : (
            invest.map((note) => (
              <a key={note.id} href={`https://invest.jamie.kr${note.href}`}>
                <span>{note.publishedAt}</span>
                <strong>{note.title}</strong>
                <span aria-hidden="true">↗</span>
              </a>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
