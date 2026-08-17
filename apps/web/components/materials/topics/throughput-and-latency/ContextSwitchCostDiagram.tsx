"use client";

import { DiagramPlaceholder } from "./DiagramPlaceholder";

interface Props {
    caption?: string;
}

export const ContextSwitchCostDiagram = ({ caption }: Props) => (
    <DiagramPlaceholder name="ContextSwitchCostDiagram" caption={caption} />
);
