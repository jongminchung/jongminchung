"use client";

import { DiagramPlaceholder } from "./DiagramPlaceholder";

interface Props {
    caption?: string;
}

export const EventLoopVsMultithreadDiagram = ({ caption }: Props) => (
    <DiagramPlaceholder
        name="EventLoopVsMultithreadDiagram"
        caption={caption}
    />
);
