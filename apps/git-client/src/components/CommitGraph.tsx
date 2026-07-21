import { memo, useEffect, useMemo, useRef } from "react";
import { placeGraphLanes } from "../domain/parsers";
import type { Commit } from "../domain/types";

const COLOR_TOKENS = [
  "--graph-1",
  "--graph-2",
  "--graph-3",
  "--graph-4",
  "--graph-5",
  "--graph-6",
] as const;
const ROW_HEIGHT = 20;
const LANE_WIDTH = 12;

export const CommitGraph = memo(function CommitGraph({
  commits,
  width = 58,
  showLongEdges = true,
}: {
  readonly commits: readonly Commit[];
  readonly width?: number;
  readonly showLongEdges?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rows = useMemo(() => placeGraphLanes(commits), [commits]);
  const visibleOids = useMemo(() => new Set(commits.map((commit) => commit.oid)), [commits]);
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
    const styles = getComputedStyle(document.documentElement);
    const colors = COLOR_TOKENS.map((token) => styles.getPropertyValue(token).trim());
    const fallbackColor = styles.getPropertyValue("--foreground").trim();
    const graphColor = (lane: number): string => colors[lane % colors.length] || fallbackColor;
    context.scale(ratio, ratio);
    context.lineWidth = 1.6;
    context.lineCap = "round";
    rows.forEach((row, index) => {
      const y = index * ROW_HEIGHT + ROW_HEIGHT / 2;
      row.activeLanes.forEach((oid, lane) => {
        if (!oid) return;
        if (!showLongEdges && !visibleOids.has(oid)) return;
        context.strokeStyle = graphColor(lane);
        context.beginPath();
        context.moveTo(10 + lane * LANE_WIDTH, y);
        context.lineTo(10 + lane * LANE_WIDTH, y + ROW_HEIGHT);
        context.stroke();
      });
      row.parentLanes.forEach((parentLane) => {
        context.strokeStyle = graphColor(parentLane);
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
      context.fillStyle = graphColor(row.lane);
      context.beginPath();
      context.arc(10 + row.lane * LANE_WIDTH, y, 4.2, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = styles.getPropertyValue("--graph-node").trim() || fallbackColor;
      context.beginPath();
      context.arc(10 + row.lane * LANE_WIDTH, y, 1.55, 0, Math.PI * 2);
      context.fill();
    });
  }, [commits.length, rows, showLongEdges, visibleOids, width]);
  return <canvas ref={canvasRef} style={{ display: "block", pointerEvents: "none" }} />;
});
