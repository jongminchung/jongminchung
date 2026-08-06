// @ts-nocheck -- Upstream visual source; runtime contracts are checked at the registry boundary.
"use client";

import React from "react";
import { DiagramPlaceholder } from "./DiagramPlaceholder";

interface Props {
  caption?: string;
}

export const EventLoopVsMultithreadDiagram = ({ caption }: Props) => (
  <DiagramPlaceholder name="EventLoopVsMultithreadDiagram" caption={caption} />
);
