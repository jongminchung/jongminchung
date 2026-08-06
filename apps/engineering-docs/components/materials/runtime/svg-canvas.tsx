"use client";

import { motion, useReducedMotion, type SVGMotionProps } from "motion/react";
import { forwardRef, useImperativeHandle, useRef, type CSSProperties } from "react";

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

type Matrix = readonly [number, number, number, number, number, number];
type SvgStyle = string | SvgGradient;

interface DrawingState {
  fillStyle: SvgStyle;
  strokeStyle: SvgStyle;
  font: string;
  textAlign: CanvasTextAlign;
  textBaseline: CanvasTextBaseline;
  globalAlpha: number;
  lineWidth: number;
  lineCap: CanvasLineCap;
  lineJoin: CanvasLineJoin;
  lineDash: readonly number[];
  shadowBlur: number;
  shadowColor: string;
  shadowOffsetX: number;
  shadowOffsetY: number;
  transform: Matrix;
  clipId?: string;
}

interface TextMeasurement {
  readonly width: number;
  readonly actualBoundingBoxAscent: number;
  readonly actualBoundingBoxDescent: number;
}

let nextDefinitionId = 1;

function createElement(name: string): SVGElement {
  return document.createElementNS(SVG_NAMESPACE, name);
}

function multiply(left: Matrix, right: Matrix): Matrix {
  const [a, b, c, d, e, f] = left;
  const [g, h, i, j, k, l] = right;
  return [
    a * g + c * h,
    b * g + d * h,
    a * i + c * j,
    b * i + d * j,
    a * k + c * l + e,
    b * k + d * l + f,
  ];
}

function cloneState(state: DrawingState): DrawingState {
  return { ...state, lineDash: [...state.lineDash], transform: [...state.transform] as Matrix };
}

function fontSize(font: string): number {
  const match = /([\d.]+)px/u.exec(font);
  return match === null ? 10 : Number(match[1]);
}

function textWidth(text: string, font: string): number {
  const size = fontSize(font);
  return Array.from(text).reduce((width, character) => {
    if (/\s/u.test(character)) return width + size * 0.32;
    if (/[\u1100-\u11ff\u2e80-\u9fff\uac00-\ud7af]/u.test(character)) return width + size;
    if (/[A-Z0-9]/u.test(character)) return width + size * 0.62;
    return width + size * 0.54;
  }, 0);
}

function matrixAttribute(matrix: Matrix): string | null {
  const identity = matrix.every((value, index) => value === [1, 0, 0, 1, 0, 0][index]);
  return identity ? null : `matrix(${matrix.join(" ")})`;
}

export class SvgGradient {
  readonly id = `material-gradient-${nextDefinitionId++}`;
  readonly stops: { readonly offset: number; readonly color: string }[] = [];

  constructor(
    readonly kind: "linear" | "radial",
    readonly values: readonly number[],
  ) {}

  addColorStop(offset: number, color: string): void {
    this.stops.push({ offset: Math.min(1, Math.max(0, offset)), color });
  }
}

function defaultState(): DrawingState {
  return {
    fillStyle: "#000000",
    strokeStyle: "#000000",
    font: "10px sans-serif",
    textAlign: "start",
    textBaseline: "alphabetic",
    globalAlpha: 1,
    lineWidth: 1,
    lineCap: "butt",
    lineJoin: "miter",
    lineDash: [],
    shadowBlur: 0,
    shadowColor: "rgba(0, 0, 0, 0)",
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    transform: [1, 0, 0, 1, 0, 0],
  };
}

export class SvgDrawingContext {
  private state = defaultState();
  private readonly stack: DrawingState[] = [];
  private path = "";
  private pathStarted = false;
  private readonly definitions = new Set<string>();

  constructor(private readonly svg: SVGSVGElement) {}

  get fillStyle(): SvgStyle {
    return this.state.fillStyle;
  }
  set fillStyle(value: SvgStyle) {
    this.state.fillStyle = value;
  }
  get strokeStyle(): SvgStyle {
    return this.state.strokeStyle;
  }
  set strokeStyle(value: SvgStyle) {
    this.state.strokeStyle = value;
  }
  get font(): string {
    return this.state.font;
  }
  set font(value: string) {
    this.state.font = value;
  }
  get textAlign(): CanvasTextAlign {
    return this.state.textAlign;
  }
  set textAlign(value: CanvasTextAlign) {
    this.state.textAlign = value;
  }
  get textBaseline(): CanvasTextBaseline {
    return this.state.textBaseline;
  }
  set textBaseline(value: CanvasTextBaseline) {
    this.state.textBaseline = value;
  }
  get globalAlpha(): number {
    return this.state.globalAlpha;
  }
  set globalAlpha(value: number) {
    this.state.globalAlpha = value;
  }
  get lineWidth(): number {
    return this.state.lineWidth;
  }
  set lineWidth(value: number) {
    this.state.lineWidth = value;
  }
  get lineCap(): CanvasLineCap {
    return this.state.lineCap;
  }
  set lineCap(value: CanvasLineCap) {
    this.state.lineCap = value;
  }
  get lineJoin(): CanvasLineJoin {
    return this.state.lineJoin;
  }
  set lineJoin(value: CanvasLineJoin) {
    this.state.lineJoin = value;
  }
  get shadowBlur(): number {
    return this.state.shadowBlur;
  }
  set shadowBlur(value: number) {
    this.state.shadowBlur = value;
  }
  get shadowColor(): string {
    return this.state.shadowColor;
  }
  set shadowColor(value: string) {
    this.state.shadowColor = value;
  }
  get shadowOffsetX(): number {
    return this.state.shadowOffsetX;
  }
  set shadowOffsetX(value: number) {
    this.state.shadowOffsetX = value;
  }
  get shadowOffsetY(): number {
    return this.state.shadowOffsetY;
  }
  set shadowOffsetY(value: number) {
    this.state.shadowOffsetY = value;
  }
  globalCompositeOperation: GlobalCompositeOperation = "source-over";
  imageSmoothingEnabled = true;

  clearRect(_x = 0, _y = 0, _width = 0, _height = 0): void {
    this.svg.replaceChildren();
    this.definitions.clear();
    this.path = "";
    this.pathStarted = false;
  }

  beginPath(): void {
    this.path = "";
    this.pathStarted = false;
  }

  closePath(): void {
    this.path += " Z";
  }

  moveTo(x: number, y: number): void {
    this.path += ` M ${x} ${y}`;
    this.pathStarted = true;
  }

  lineTo(x: number, y: number): void {
    this.path += `${this.pathStarted ? " L" : " M"} ${x} ${y}`;
    this.pathStarted = true;
  }

  rect(x: number, y: number, width: number, height: number): void {
    this.path += ` M ${x} ${y} h ${width} v ${height} h ${-width} Z`;
    this.pathStarted = true;
  }

  roundRect(
    x: number,
    y: number,
    width: number,
    height: number,
    radii: number | readonly number[] = 0,
  ): void {
    const radiusValue = Array.isArray(radii) ? radii[0] : radii;
    const radius = Math.max(
      0,
      Math.min(Number(radiusValue ?? 0), Math.abs(width) / 2, Math.abs(height) / 2),
    );
    this.path += ` M ${x + radius} ${y} H ${x + width - radius} Q ${x + width} ${y} ${x + width} ${y + radius} V ${y + height - radius} Q ${x + width} ${y + height} ${x + width - radius} ${y + height} H ${x + radius} Q ${x} ${y + height} ${x} ${y + height - radius} V ${y + radius} Q ${x} ${y} ${x + radius} ${y} Z`;
    this.pathStarted = true;
  }

  quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): void {
    this.path += ` Q ${cpx} ${cpy} ${x} ${y}`;
    this.pathStarted = true;
  }

  bezierCurveTo(
    cp1x: number,
    cp1y: number,
    cp2x: number,
    cp2y: number,
    x: number,
    y: number,
  ): void {
    this.path += ` C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${x} ${y}`;
    this.pathStarted = true;
  }

  arcTo(x1: number, y1: number): void {
    this.lineTo(x1, y1);
  }

  arc(
    x: number,
    y: number,
    radius: number,
    startAngle: number,
    endAngle: number,
    counterclockwise = false,
  ): void {
    this.ellipse(x, y, radius, radius, 0, startAngle, endAngle, counterclockwise);
  }

  ellipse(
    x: number,
    y: number,
    radiusX: number,
    radiusY: number,
    rotation: number,
    startAngle: number,
    endAngle: number,
    counterclockwise = false,
  ): void {
    const delta = Math.abs(endAngle - startAngle);
    const startX = x + Math.cos(startAngle) * radiusX;
    const startY = y + Math.sin(startAngle) * radiusY;
    const endX = x + Math.cos(endAngle) * radiusX;
    const endY = y + Math.sin(endAngle) * radiusY;
    this.path += `${this.pathStarted ? " L" : " M"} ${startX} ${startY}`;
    if (delta >= Math.PI * 2 - 0.0001) {
      const middleAngle = startAngle + (counterclockwise ? -Math.PI : Math.PI);
      const middleX = x + Math.cos(middleAngle) * radiusX;
      const middleY = y + Math.sin(middleAngle) * radiusY;
      const sweep = counterclockwise ? 0 : 1;
      this.path += ` A ${radiusX} ${radiusY} ${(rotation * 180) / Math.PI} 1 ${sweep} ${middleX} ${middleY}`;
      this.path += ` A ${radiusX} ${radiusY} ${(rotation * 180) / Math.PI} 1 ${sweep} ${startX} ${startY}`;
    } else {
      const largeArc = delta > Math.PI ? 1 : 0;
      const sweep = counterclockwise ? 0 : 1;
      this.path += ` A ${radiusX} ${radiusY} ${(rotation * 180) / Math.PI} ${largeArc} ${sweep} ${endX} ${endY}`;
    }
    this.pathStarted = true;
  }

  fill(): void {
    this.appendPath(true, false);
  }

  stroke(): void {
    this.appendPath(false, true);
  }

  fillRect(x: number, y: number, width: number, height: number): void {
    const rect = createElement("rect");
    rect.setAttribute("x", String(x));
    rect.setAttribute("y", String(y));
    rect.setAttribute("width", String(width));
    rect.setAttribute("height", String(height));
    this.applyPaint(rect, true, false);
    this.svg.append(rect);
  }

  strokeRect(x: number, y: number, width: number, height: number): void {
    const rect = createElement("rect");
    rect.setAttribute("x", String(x));
    rect.setAttribute("y", String(y));
    rect.setAttribute("width", String(width));
    rect.setAttribute("height", String(height));
    this.applyPaint(rect, false, true);
    this.svg.append(rect);
  }

  fillText(text: string, x: number, y: number, maxWidth?: number): void {
    this.appendText(text, x, y, maxWidth, true, false);
  }

  strokeText(text: string, x: number, y: number, maxWidth?: number): void {
    this.appendText(text, x, y, maxWidth, false, true);
  }

  measureText(text: string): TextMeasurement {
    const size = fontSize(this.state.font);
    return {
      width: textWidth(text, this.state.font),
      actualBoundingBoxAscent: size * 0.8,
      actualBoundingBoxDescent: size * 0.2,
    };
  }

  createLinearGradient(x0: number, y0: number, x1: number, y1: number): SvgGradient {
    return new SvgGradient("linear", [x0, y0, x1, y1]);
  }

  createRadialGradient(
    x0: number,
    y0: number,
    r0: number,
    x1: number,
    y1: number,
    r1: number,
  ): SvgGradient {
    return new SvgGradient("radial", [x0, y0, r0, x1, y1, r1]);
  }

  setLineDash(segments: readonly number[]): void {
    this.state.lineDash = [...segments];
  }

  getLineDash(): number[] {
    return [...this.state.lineDash];
  }

  save(): void {
    this.stack.push(cloneState(this.state));
  }

  restore(): void {
    const restored = this.stack.pop();
    if (restored !== undefined) this.state = restored;
  }

  scale(x: number, y: number): void {
    this.state.transform = multiply(this.state.transform, [x, 0, 0, y, 0, 0]);
  }

  translate(x: number, y: number): void {
    this.state.transform = multiply(this.state.transform, [1, 0, 0, 1, x, y]);
  }

  rotate(angle: number): void {
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    this.state.transform = multiply(this.state.transform, [cosine, sine, -sine, cosine, 0, 0]);
  }

  transform(a: number, b: number, c: number, d: number, e: number, f: number): void {
    this.state.transform = multiply(this.state.transform, [a, b, c, d, e, f]);
  }

  setTransform(a: number, b: number, c: number, d: number, e: number, f: number): void {
    this.state.transform = [a, b, c, d, e, f];
  }

  resetTransform(): void {
    this.state.transform = [1, 0, 0, 1, 0, 0];
  }

  clip(): void {
    const id = `material-clip-${nextDefinitionId++}`;
    const defs = this.ensureDefs();
    const clipPath = createElement("clipPath");
    clipPath.setAttribute("id", id);
    const path = createElement("path");
    path.setAttribute("d", this.path);
    const transform = matrixAttribute(this.state.transform);
    if (transform !== null) path.setAttribute("transform", transform);
    clipPath.append(path);
    defs.append(clipPath);
    this.state.clipId = id;
  }

  private appendPath(fill: boolean, stroke: boolean): void {
    if (this.path.length === 0) return;
    const path = createElement("path");
    path.setAttribute("d", this.path.trim());
    this.applyPaint(path, fill, stroke);
    this.svg.append(path);
  }

  private appendText(
    value: string,
    x: number,
    y: number,
    maxWidth: number | undefined,
    fill: boolean,
    stroke: boolean,
  ): void {
    const text = createElement("text");
    text.textContent = value;
    text.setAttribute("x", String(x));
    text.setAttribute("y", String(y));
    text.setAttribute("style", `font: ${this.state.font}`);
    const anchor =
      this.state.textAlign === "center"
        ? "middle"
        : this.state.textAlign === "right" || this.state.textAlign === "end"
          ? "end"
          : "start";
    text.setAttribute("text-anchor", anchor);
    const baseline =
      this.state.textBaseline === "middle"
        ? "central"
        : this.state.textBaseline === "top" || this.state.textBaseline === "hanging"
          ? "hanging"
          : this.state.textBaseline === "bottom" || this.state.textBaseline === "ideographic"
            ? "text-after-edge"
            : "alphabetic";
    text.setAttribute("dominant-baseline", baseline);
    if (maxWidth !== undefined && textWidth(value, this.state.font) > maxWidth) {
      text.setAttribute("textLength", String(maxWidth));
      text.setAttribute("lengthAdjust", "spacingAndGlyphs");
    }
    this.applyPaint(text, fill, stroke);
    this.svg.append(text);
  }

  private applyPaint(element: SVGElement, fill: boolean, stroke: boolean): void {
    const fillValue = fill ? this.resolveStyle(this.state.fillStyle) : "none";
    const strokeValue = stroke ? this.resolveStyle(this.state.strokeStyle) : "none";
    element.setAttribute("fill", fillValue);
    element.setAttribute("stroke", strokeValue);
    if (stroke) {
      element.setAttribute("stroke-width", String(this.state.lineWidth));
      element.setAttribute("stroke-linecap", this.state.lineCap);
      element.setAttribute("stroke-linejoin", this.state.lineJoin);
      if (this.state.lineDash.length > 0) {
        element.setAttribute("stroke-dasharray", this.state.lineDash.join(" "));
      }
    }
    if (this.state.globalAlpha !== 1)
      element.setAttribute("opacity", String(this.state.globalAlpha));
    const transform = matrixAttribute(this.state.transform);
    if (transform !== null) element.setAttribute("transform", transform);
    if (this.state.clipId !== undefined) {
      element.setAttribute("clip-path", `url(#${this.state.clipId})`);
    }
    if (this.state.shadowBlur > 0 && this.state.shadowColor !== "rgba(0, 0, 0, 0)") {
      element.setAttribute(
        "style",
        `${element.getAttribute("style") ?? ""};filter:drop-shadow(${this.state.shadowOffsetX}px ${this.state.shadowOffsetY}px ${this.state.shadowBlur}px ${this.state.shadowColor})`,
      );
    }
  }

  private resolveStyle(style: SvgStyle): string {
    if (typeof style === "string") return style;
    if (!this.definitions.has(style.id)) {
      this.definitions.add(style.id);
      const defs = this.ensureDefs();
      const gradient = createElement(style.kind === "linear" ? "linearGradient" : "radialGradient");
      gradient.setAttribute("id", style.id);
      gradient.setAttribute("gradientUnits", "userSpaceOnUse");
      if (style.kind === "linear") {
        const [x1, y1, x2, y2] = style.values;
        gradient.setAttribute("x1", String(x1));
        gradient.setAttribute("y1", String(y1));
        gradient.setAttribute("x2", String(x2));
        gradient.setAttribute("y2", String(y2));
      } else {
        const [, , , x, y, radius] = style.values;
        gradient.setAttribute("cx", String(x));
        gradient.setAttribute("cy", String(y));
        gradient.setAttribute("r", String(radius));
      }
      for (const stopValue of style.stops) {
        const stop = createElement("stop");
        stop.setAttribute("offset", `${stopValue.offset * 100}%`);
        stop.setAttribute("stop-color", stopValue.color);
        gradient.append(stop);
      }
      defs.append(gradient);
    }
    return `url(#${style.id})`;
  }

  private ensureDefs(): SVGDefsElement {
    const existing = this.svg.querySelector(":scope > defs");
    if (existing instanceof SVGDefsElement) return existing;
    const defs = createElement("defs") as SVGDefsElement;
    this.svg.prepend(defs);
    return defs;
  }
}

export interface SvgCanvasHandle {
  width: number;
  height: number;
  readonly style: CSSStyleDeclaration;
  getContext(type: "2d"): SvgDrawingContext | null;
  getBoundingClientRect(): DOMRect;
  addEventListener: SVGSVGElement["addEventListener"];
  removeEventListener: SVGSVGElement["removeEventListener"];
  toBlob(callback: BlobCallback, type?: string): void;
}

type SvgCanvasProps = Omit<SVGMotionProps<SVGSVGElement>, "ref"> & {
  readonly style?: CSSProperties;
};

export const SvgCanvas = forwardRef<SvgCanvasHandle, SvgCanvasProps>(function SvgCanvas(
  { role = "presentation", ...props },
  forwardedRef,
) {
  const svgRef = useRef<SVGSVGElement>(null);
  const contextRef = useRef<SvgDrawingContext | null>(null);
  const reducedMotion = useReducedMotion();

  useImperativeHandle(forwardedRef, () => {
    const svg = svgRef.current;
    if (svg === null) throw new Error("SvgCanvas mounted without an SVG element.");
    return {
      get width() {
        return Number(svg.getAttribute("width") ?? 300);
      },
      set width(value: number) {
        svg.setAttribute("width", String(value));
        svg.setAttribute("viewBox", `0 0 ${value} ${Number(svg.getAttribute("height") ?? 150)}`);
        contextRef.current?.clearRect();
      },
      get height() {
        return Number(svg.getAttribute("height") ?? 150);
      },
      set height(value: number) {
        svg.setAttribute("height", String(value));
        svg.setAttribute("viewBox", `0 0 ${Number(svg.getAttribute("width") ?? 300)} ${value}`);
        contextRef.current?.clearRect();
      },
      style: svg.style,
      getContext(type: "2d") {
        if (type !== "2d") return null;
        contextRef.current ??= new SvgDrawingContext(svg);
        return contextRef.current;
      },
      getBoundingClientRect: () => svg.getBoundingClientRect(),
      addEventListener: svg.addEventListener.bind(svg),
      removeEventListener: svg.removeEventListener.bind(svg),
      toBlob(callback: BlobCallback) {
        const source = new XMLSerializer().serializeToString(svg);
        callback(new Blob([source], { type: "image/svg+xml" }));
      },
    };
  }, []);

  return (
    <motion.svg
      ref={svgRef}
      role={role}
      focusable="false"
      initial={reducedMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: reducedMotion ? 0 : 0.18 }}
      {...props}
    />
  );
});
