"use client";

import { DiagramPlaceholder } from "./DiagramPlaceholder";

interface Props {
    caption?: string;
}

export const CpuVsIoBoundDiagram = ({ caption }: Props) => (
    <DiagramPlaceholder name="CpuVsIoBoundDiagram" caption={caption} />
);
