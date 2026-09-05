import {
  ArrowUpRightIcon,
  BookOpenIcon,
  SquareTerminalIcon,
} from "lucide-react";
import { getHomeContent } from "#lib/home/content";
import type { Locale } from "#lib/site-routing";

export function WorkSection({ locale }: { readonly locale: Locale }) {
  const { destinations, destinationsLabel } = getHomeContent(locale);
  return (
    <section
      className="home-container home-spaces"
      id="work"
      aria-labelledby="spaces-title"
    >
      <h2 className="sr-only" id="spaces-title">
        {destinationsLabel}
      </h2>
      {destinations.map((destination) => {
        const Icon =
          destination.id === "tech" ? SquareTerminalIcon : BookOpenIcon;
        return (
          <a
            className="home-space"
            data-project="true"
            data-home-site={destination.id}
            href={destination.href}
            key={destination.id}
          >
            <div className="flex items-center justify-between text-muted-foreground">
              <Icon aria-hidden="true" className="size-5" />
              <span className="font-mono text-xs">
                {destination.id}.jamie.kr
              </span>
            </div>
            <h3>{destination.title}</h3>
            <p>{destination.description}</p>
            <div className="home-space-bottom">
              <ul aria-label={destination.title}>
                {destination.topics.map((topic) => (
                  <li key={topic}>{topic}</li>
                ))}
              </ul>
              <span className="home-space-action">
                {destination.action}
                <ArrowUpRightIcon aria-hidden="true" className="size-4" />
              </span>
            </div>
          </a>
        );
      })}
    </section>
  );
}
