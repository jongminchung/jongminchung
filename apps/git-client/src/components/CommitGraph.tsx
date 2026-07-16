import { memo, useEffect, useMemo, useRef } from "react";
import { placeGraphLanes } from "../domain/parsers";
import type { Commit } from "../domain/types";

const COLORS = ["#745fd6", "#28a477", "#dc6f58", "#438fc4", "#c5902e", "#b461a5"] as const;
const ROW_HEIGHT = 29;
const LANE_WIDTH = 12;

export const CommitGraph = memo(function CommitGraph({
  commits,
  width = 72,
}: {
  readonly commits: readonly Commit[];
  readonly width?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rows = useMemo(() => placeGraphLanes(commits), [commits]);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const height = commits.length * ROW_HEIGHT;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.scale(ratio, ratio);
    context.lineWidth = 1.6;
    context.lineCap = "round";
    rows.forEach((row, index) => {
      const y = index * ROW_HEIGHT + ROW_HEIGHT / 2;
      row.activeLanes.forEach((oid, lane) => {
        if (!oid) return;
        context.strokeStyle = COLORS[lane % COLORS.length] ?? COLORS[0]!;
        context.beginPath();
        context.moveTo(10 + lane * LANE_WIDTH, y);
        context.lineTo(10 + lane * LANE_WIDTH, y + ROW_HEIGHT);
        context.stroke();
      });
      row.parentLanes.forEach((parentLane) => {
        context.strokeStyle = COLORS[parentLane % COLORS.length] ?? COLORS[0]!;
        context.beginPath();
        context.moveTo(10 + row.lane * LANE_WIDTH, y);
        context.bezierCurveTo(
          10 + row.lane * LANE_WIDTH,
          y + 8,
          10 + parentLane * LANE_WIDTH,
          y + 13,
          10 + parentLane * LANE_WIDTH,
          y + ROW_HEIGHT,
        );
        context.stroke();
      });
      context.fillStyle = COLORS[row.lane % COLORS.length] ?? COLORS[0]!;
      context.beginPath();
      context.arc(10 + row.lane * LANE_WIDTH, y, 4.2, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = "#f7f6f9";
      context.beginPath();
      context.arc(10 + row.lane * LANE_WIDTH, y, 1.55, 0, Math.PI * 2);
      context.fill();
    });
  }, [commits.length, rows, width]);
  return <canvas ref={canvasRef} style={{ display: "block", pointerEvents: "none" }} />;
});
