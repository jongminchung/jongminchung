import { ArrowUpRightIcon } from "lucide-react";
import { getLocalizedDocuments } from "#lib/documents";
import { getHomeContent } from "#lib/home/content";
import { formatEditorialDate } from "#lib/i18n-date";
import { getInvestmentNotes } from "#lib/invest/notes";
import { siteOrigins, type Locale } from "#lib/site-routing";

export async function WritingSection({ locale }: { readonly locale: Locale }) {
  const { writing, destinations } = getHomeContent(locale);
  const entries = {
    tech: (await getLocalizedDocuments(locale)).slice(0, 3),
    invest: getInvestmentNotes(locale).slice(0, 3),
  };
  return (
    <section
      className="home-container home-section"
      id="writing"
      aria-labelledby="writing-title"
    >
      <div className="home-section-heading">
        <h2 id="writing-title">{writing.title}</h2>
        <p>{writing.description}</p>
      </div>
      <div className="home-writing-grid">
        {destinations.map((destination) => (
          <section
            className="home-writing-list"
            aria-labelledby={`writing-${destination.id}`}
            key={destination.id}
          >
            <div className="home-writing-heading">
              <h3 id={`writing-${destination.id}`}>{destination.title}</h3>
              <a
                className="home-text-link"
                href={destination.href}
                aria-label={`${destination.title} · ${writing.viewAll}`}
              >
                {writing.viewAll}
                <ArrowUpRightIcon aria-hidden="true" className="size-3.5" />
              </a>
            </div>
            {entries[destination.id].length === 0 ? (
              <p className="py-6 text-muted-foreground">{writing.empty}</p>
            ) : (
              <ul>
                {entries[destination.id].map((entry) => (
                  <li key={entry.id}>
                    <a href={`${siteOrigins[destination.id]}${entry.href}`}>
                      <div>
                        <time dateTime={entry.publishedAt}>
                          {formatEditorialDate(locale, entry.publishedAt)}
                        </time>
                        <h4>{entry.title}</h4>
                      </div>
                      <ArrowUpRightIcon
                        aria-hidden="true"
                        className="size-4 shrink-0 text-muted-foreground"
                      />
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </section>
  );
}
