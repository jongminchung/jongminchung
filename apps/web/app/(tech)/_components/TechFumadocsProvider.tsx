"use client";

/* oxlint-disable react-compiler -- FrameworkProvider requires passing framework hook adapters as values. */

import { FrameworkProvider } from "fumadocs-core/framework";
import { RootProvider } from "fumadocs-ui/provider/base";
import {
  useParams,
  usePathname as useNextPathname,
  useRouter,
} from "next/navigation";
import type { ReactNode } from "react";

/** Proxy의 내부 `/tech` rewrite를 공개 Tech URL로 정규화함 */
function usePublicTechPathname(): string {
  return useNextPathname().replace(/^\/tech(?=\/(?:ko|en)(?:\/|$))/u, "");
}

/** Fumadocs 탐색 상태가 공개 URL을 기준으로 동작하도록 framework adapter를 제공함 */
export function TechFumadocsProvider({
  children,
}: {
  readonly children: ReactNode;
}) {
  return (
    <FrameworkProvider
      useParams={useParams}
      usePathname={usePublicTechPathname}
      useRouter={useRouter}
    >
      <RootProvider search={{ enabled: false }} theme={{ enabled: false }}>
        {children}
      </RootProvider>
    </FrameworkProvider>
  );
}
