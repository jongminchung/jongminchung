"use client";

import { DiagramPlaceholder } from "./DiagramPlaceholder";

interface Props {
    caption?: string;
}

export const ExecutionModelsDiagram = ({ caption }: Props) => (
    <DiagramPlaceholder name="ExecutionModelsDiagram" caption={caption} />
);
