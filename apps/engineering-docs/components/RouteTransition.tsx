"use client";

import NextLink from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  forwardRef,
  type ReactNode,
  startTransition,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Locale } from "@/lib/content-model";
import styles from "./RouteTransition.module.css";

const PROGRESS_DELAY_MS = 30;
const NAVIGATION_TIMEOUT_MS = 4_000;

interface NavigationOptions {
  readonly replace?: boolean;
  readonly scroll?: boolean;
}

interface DocsNavigationValue {
  readonly navigate: (href: string, options?: NavigationOptions) => void;
}

const DocsNavigationContext = createContext<DocsNavigationValue | null>(null);

function shouldAnimateNavigation(href: string): boolean {
  const target = new URL(href, window.location.href);
  if (target.origin !== window.location.origin) return false;
  if (target.pathname === window.location.pathname && target.search === window.location.search) {
    return false;
  }
  return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function RouteTransitionProvider({
  locale,
  children,
}: {
  readonly locale: Locale;
  readonly children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [isProgressVisible, setIsProgressVisible] = useState(false);
  const progressDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resolveCommitRef = useRef<(() => void) | null>(null);

  const clearTimers = useCallback((): void => {
    if (progressDelayRef.current !== null) clearTimeout(progressDelayRef.current);
    if (navigationTimeoutRef.current !== null) clearTimeout(navigationTimeoutRef.current);
    progressDelayRef.current = null;
    navigationTimeoutRef.current = null;
  }, []);

  const completeNavigation = useCallback((): void => {
    clearTimers();
    resolveCommitRef.current?.();
    resolveCommitRef.current = null;
    setIsProgressVisible(false);
  }, [clearTimers]);

  const beginNavigation = useCallback((): Promise<void> => {
    completeNavigation();
    progressDelayRef.current = setTimeout(() => setIsProgressVisible(true), PROGRESS_DELAY_MS);
    return new Promise((resolve) => {
      resolveCommitRef.current = resolve;
      navigationTimeoutRef.current = setTimeout(completeNavigation, NAVIGATION_TIMEOUT_MS);
    });
  }, [completeNavigation]);

  const finishViewTransition = useCallback(async (transition: ViewTransition): Promise<void> => {
    try {
      await transition.finished;
    } finally {
      setIsProgressVisible(false);
    }
  }, []);

  const navigate = useCallback(
    (href: string, options: NavigationOptions = {}): void => {
      const commit = beginNavigation();
      const performNavigation = (): void => {
        startTransition(() => {
          if (options.replace === true) router.replace(href, { scroll: options.scroll });
          else router.push(href, { scroll: options.scroll });
        });
      };

      if (typeof document.startViewTransition !== "function" || !shouldAnimateNavigation(href)) {
        performNavigation();
        return;
      }

      const transition = document.startViewTransition(async () => {
        performNavigation();
        await commit;
      });
      void finishViewTransition(transition);
    },
    [beginNavigation, finishViewTransition, router],
  );

  useEffect(() => {
    completeNavigation();
  }, [completeNavigation, pathname]);

  useEffect(() => {
    const handleHistoryNavigation = (): void => {
      const commit = beginNavigation();
      if (
        typeof document.startViewTransition !== "function" ||
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ) {
        return;
      }
      void finishViewTransition(document.startViewTransition(() => commit));
    };
    window.addEventListener("popstate", handleHistoryNavigation);
    return () => window.removeEventListener("popstate", handleHistoryNavigation);
  }, [beginNavigation, finishViewTransition]);

  useEffect(() => completeNavigation, [completeNavigation]);

  const value = useMemo(() => ({ navigate }), [navigate]);

  return (
    <DocsNavigationContext value={value}>
      {isProgressVisible ? (
        <div className={styles.progress} data-docs-navigation-progress="true">
          <div
            className={styles.progressBar}
            role="progressbar"
            aria-label={locale === "ko" ? "문서 불러오는 중" : "Loading document"}
          />
        </div>
      ) : null}
      {children}
    </DocsNavigationContext>
  );
}

export function useDocsNavigation(): DocsNavigationValue {
  const value = use(DocsNavigationContext);
  if (value === null) {
    throw new Error("useDocsNavigation must be rendered inside RouteTransitionProvider.");
  }
  return value;
}

export const TransitionLink = forwardRef<
  HTMLAnchorElement,
  React.ComponentPropsWithoutRef<typeof NextLink>
>(function TransitionLink({ href, onNavigate, replace, scroll, ...props }, ref) {
  const { navigate } = useDocsNavigation();

  return (
    <NextLink
      {...props}
      ref={ref}
      href={href}
      replace={replace}
      scroll={scroll}
      onNavigate={(event) => {
        let isPrevented = false;
        onNavigate?.({
          preventDefault: () => {
            isPrevented = true;
            event.preventDefault();
          },
        });
        if (isPrevented || typeof href !== "string") return;

        const target = new URL(href, window.location.href);
        if (
          target.origin !== window.location.origin ||
          (target.pathname === window.location.pathname && target.search === window.location.search)
        ) {
          return;
        }

        event.preventDefault();
        navigate(`${target.pathname}${target.search}${target.hash}`, { replace, scroll });
      }}
    />
  );
});

TransitionLink.displayName = "TransitionLink";

export function RouteTransitionContent({ children }: { readonly children: ReactNode }) {
  return (
    <div className={styles.content} data-docs-transition-content="true">
      {children}
    </div>
  );
}
