"use client";

import { DiagramPlaceholder } from "./DiagramPlaceholder";

interface Props {
    caption?: string;
}

export const LittlesLawDiagram = ({ caption }: Props) => (
    <DiagramPlaceholder name="LittlesLawDiagram" caption={caption} />
);
