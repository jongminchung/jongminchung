import type { ComponentType } from "react";

interface InvestmentMdxModule { readonly default: ComponentType; }

export const investmentLoaders: Readonly<Record<string, () => Promise<InvestmentMdxModule>>> = {
};

export type InvestmentLoaderKey = string;
