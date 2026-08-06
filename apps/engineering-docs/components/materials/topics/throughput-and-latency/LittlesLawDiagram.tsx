// @ts-nocheck -- Upstream visual source; runtime contracts are checked at the registry boundary.
"use client";

import React from "react";
import { DiagramPlaceholder } from "./DiagramPlaceholder";

interface Props {
  caption?: string;
}

export const LittlesLawDiagram = ({ caption }: Props) => (
  <DiagramPlaceholder name="LittlesLawDiagram" caption={caption} />
);
