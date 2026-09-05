import { getHomeContent } from "#lib/home/content";
import type { Locale } from "#lib/site-routing";

export function PrinciplesSection({ locale }: { readonly locale: Locale }) {
  const { principles } = getHomeContent(locale);
  return (
    <section
      className="home-container home-section"
      id="principles"
      aria-labelledby="principles-title"
    >
      <div className="home-section-heading">
        <h2 id="principles-title">{principles.title}</h2>
        <p>{principles.description}</p>
      </div>
      <ol className="home-principles">
        {principles.items.map((principle, index) => (
          <li key={principle.key}>
            <span className="home-eyebrow" aria-hidden="true">
              0{index + 1}
            </span>
            <h3>{principle.title}</h3>
            <p>{principle.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
