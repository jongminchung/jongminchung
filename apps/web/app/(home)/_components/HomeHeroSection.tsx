import { ArrowDownIcon } from "lucide-react";
import { getHomeContent } from "#lib/home/content";
import type { Locale } from "#lib/site-routing";

export function HeroSection({ locale }: { readonly locale: Locale }) {
  const { hero } = getHomeContent(locale);
  return (
    <section
      className="home-container home-hero"
      id="top"
      aria-labelledby="hero-title"
    >
      <p className="home-eyebrow">
        Jongmin Chung <span aria-hidden="true">/</span> Personal space
      </p>
      <h1 id="hero-title">
        {hero.title.map((line) => (
          <span className="block" key={line}>
            {line}
          </span>
        ))}
      </h1>
      <p className="home-hero-description">{hero.description}</p>
      <a className="home-action bg-foreground text-background" href="#writing">
        {hero.readLatest}
        <ArrowDownIcon aria-hidden="true" className="size-4" />
      </a>
    </section>
  );
}
