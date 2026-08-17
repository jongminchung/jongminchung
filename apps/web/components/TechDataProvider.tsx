"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";

export function createTechQueryClient(): QueryClient {
    return new QueryClient({
        defaultOptions: {
            queries: {
                refetchOnWindowFocus: false,
                retry: 1,
            },
        },
    });
}

export function TechDataProvider({
    children,
}: {
    readonly children: ReactNode;
}): React.JSX.Element {
    const [queryClient] = useState(createTechQueryClient);
    return (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    );
}
