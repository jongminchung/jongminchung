"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Locale } from "#lib/content-model";

const MaterialLocaleContext = createContext<Locale>("ko");

export function MaterialLocaleProvider({
    locale,
    children,
}: {
    readonly locale: Locale;
    readonly children: ReactNode;
}) {
    return (
        <MaterialLocaleContext value={locale}>{children}</MaterialLocaleContext>
    );
}

export function useMaterialLocale(): Locale {
    return useContext(MaterialLocaleContext);
}
