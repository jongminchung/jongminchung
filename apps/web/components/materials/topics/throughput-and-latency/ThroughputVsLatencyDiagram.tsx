"use client";

import { DiagramPlaceholder } from "./DiagramPlaceholder";

interface Props {
    caption?: string;
}

export const ThroughputVsLatencyDiagram = ({ caption }: Props) => (
    <DiagramPlaceholder name="ThroughputVsLatencyDiagram" caption={caption} />
);
