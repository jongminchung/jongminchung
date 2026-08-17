"use client";

import { DiagramPlaceholder } from "./DiagramPlaceholder";

interface Props {
    caption?: string;
}

export const UtilizationLatencyCurveDiagram = ({ caption }: Props) => (
    <DiagramPlaceholder
        name="UtilizationLatencyCurveDiagram"
        caption={caption}
    />
);
