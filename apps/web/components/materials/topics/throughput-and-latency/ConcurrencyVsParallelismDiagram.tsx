"use client";

import { DiagramPlaceholder } from "./DiagramPlaceholder";

interface Props {
    caption?: string;
}

export const ConcurrencyVsParallelismDiagram = ({ caption }: Props) => (
    <DiagramPlaceholder
        name="ConcurrencyVsParallelismDiagram"
        caption={caption}
    />
);
