import {
    cancelMaterialFrame,
    scheduleMaterialFrame,
} from "#components/materials/runtime/scheduler";

interface Vec3 {
    readonly x: number;
    readonly y: number;
    readonly z: number;
}

interface ScreenPoint {
    readonly x: number;
    readonly y: number;
    readonly z: number;
}

interface Face {
    readonly vertices: readonly [Vec3, Vec3, Vec3];
}

const SHADES = "·┼╬░▒▓█";

function subtract(left: Vec3, right: Vec3): Vec3 {
    return { x: left.x - right.x, y: left.y - right.y, z: left.z - right.z };
}

function cross(left: Vec3, right: Vec3): Vec3 {
    return {
        x: left.y * right.z - left.z * right.y,
        y: left.z * right.x - left.x * right.z,
        z: left.x * right.y - left.y * right.x,
    };
}

function normalize(value: Vec3): Vec3 {
    const length = Math.hypot(value.x, value.y, value.z);
    if (length === 0) return { x: 0, y: 0, z: 0 };
    return { x: value.x / length, y: value.y / length, z: value.z / length };
}

function dot(left: Vec3, right: Vec3): number {
    return left.x * right.x + left.y * right.y + left.z * right.z;
}

function rotate(value: Vec3, angle: number): Vec3 {
    const sinX = Math.sin(angle);
    const cosX = Math.cos(angle);
    const sinY = Math.sin(angle);
    const cosY = Math.cos(angle);
    const sinZ = Math.sin(angle);
    const cosZ = Math.cos(angle);

    const aroundX = {
        x: value.x,
        y: value.y * cosX - value.z * sinX,
        z: value.y * sinX + value.z * cosX,
    };
    const aroundY = {
        x: aroundX.x * cosY + aroundX.z * sinY,
        y: aroundX.y,
        z: -aroundX.x * sinY + aroundX.z * cosY,
    };
    return {
        x: aroundY.x * cosZ - aroundY.y * sinZ,
        y: aroundY.x * sinZ + aroundY.y * cosZ,
        z: aroundY.z,
    };
}

function parseNumber(value: string | undefined, description: string): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed))
        throw new Error(`Invalid ${description}: ${value ?? "missing"}`);
    return parsed;
}

function parseVertexIndex(
    value: string | undefined,
    vertexCount: number,
): number {
    const sourceIndex = Math.trunc(
        parseNumber(value?.split("/")[0], "face vertex index"),
    );
    const index = sourceIndex < 0 ? vertexCount + sourceIndex : sourceIndex - 1;
    if (index < 0 || index >= vertexCount)
        throw new Error(`Face vertex index is out of range: ${sourceIndex}`);
    return index;
}

function parseObj(source: string): readonly Face[] {
    const vertices: Vec3[] = [];
    const faces: Face[] = [];

    for (const line of source.split("\n")) {
        const parts = line.trim().split(/\s+/u);
        if (parts[0] === "v") {
            vertices.push({
                x: parseNumber(parts[1], "vertex x"),
                y: parseNumber(parts[2], "vertex y"),
                z: parseNumber(parts[3], "vertex z"),
            });
            continue;
        }
        if (parts[0] !== "f" || parts.length < 4) continue;

        const indices = [
            parseVertexIndex(parts[1], vertices.length),
            parseVertexIndex(parts[2], vertices.length),
            parseVertexIndex(parts[3], vertices.length),
        ] as const;
        const first = vertices[indices[0]];
        const second = vertices[indices[1]];
        const third = vertices[indices[2]];
        if (
            first === undefined ||
            second === undefined ||
            third === undefined
        ) {
            throw new Error("OBJ face references a missing vertex");
        }
        faces.push({ vertices: [first, second, third] });
    }

    return faces;
}

function edge(
    first: ScreenPoint,
    second: ScreenPoint,
    x: number,
    y: number,
): number {
    return (
        (x - first.x) * (second.y - first.y) -
        (y - first.y) * (second.x - first.x)
    );
}

export class ASCII3DRenderer {
    readonly #element: HTMLDivElement;
    readonly #width: number;
    readonly #height: number;
    #faces: readonly Face[] = [];
    #angle = 0;
    #frameId: number | null = null;
    #lastFrameTime = 0;

    constructor(element: HTMLDivElement | null, width: number, height: number) {
        if (element === null)
            throw new Error("ASCII renderer requires a mounted element");
        this.#element = element;
        this.#width = width;
        this.#height = height;
        this.#element.style.whiteSpace = "pre";
    }

    loadFromString(source: string): void {
        this.#faces = parseObj(source);
    }

    run(): void {
        if (this.#frameId !== null) return;
        const renderFrame = (time: number): void => {
            if (time - this.#lastFrameTime >= 1000 / 60) {
                this.#lastFrameTime = time;
                this.#angle = (this.#angle + 0.007) % (Math.PI * 2);
                this.#render();
            }
            this.#frameId = scheduleMaterialFrame(renderFrame);
        };
        this.#render();
        this.#frameId = scheduleMaterialFrame(renderFrame);
    }

    stop(): void {
        if (this.#frameId === null) return;
        cancelMaterialFrame(this.#frameId);
        this.#frameId = null;
    }

    #project(value: Vec3): ScreenPoint {
        const depth = value.z + 5;
        const perspective = depth === 0 ? 1 : 2.4 / depth;
        return {
            x: value.x * perspective * (this.#width / 2) + this.#width / 2,
            y: -value.y * perspective * (this.#height / 2) + this.#height / 2,
            z: depth,
        };
    }

    #render(): void {
        const characters = Array.from({ length: this.#height }, () =>
            Array.from({ length: this.#width }, () => " "),
        );
        const depths = Array.from({ length: this.#height }, () =>
            Array.from({ length: this.#width }, () => Number.POSITIVE_INFINITY),
        );
        const light = normalize({ x: 0.3, y: 0.4, z: -1 });

        for (const face of this.#faces) {
            const [sourceA, sourceB, sourceC] = face.vertices;
            const a = rotate(sourceA, this.#angle);
            const b = rotate(sourceB, this.#angle);
            const c = rotate(sourceC, this.#angle);
            const normal = normalize(cross(subtract(b, a), subtract(c, a)));
            if (normal.z >= 0) continue;

            const brightness = Math.max(0, -dot(normal, light));
            const shadeIndex = Math.round(brightness * (SHADES.length - 1));
            const shade = SHADES[shadeIndex] ?? SHADES[0] ?? "#";
            this.#rasterize(
                this.#project(a),
                this.#project(b),
                this.#project(c),
                shade,
                characters,
                depths,
            );
        }

        this.#element.textContent = characters
            .map((row) => row.join(""))
            .join("\n");
    }

    #rasterize(
        a: ScreenPoint,
        b: ScreenPoint,
        c: ScreenPoint,
        shade: string,
        characters: string[][],
        depths: number[][],
    ): void {
        const minX = Math.max(0, Math.floor(Math.min(a.x, b.x, c.x)));
        const maxX = Math.min(
            this.#width - 1,
            Math.ceil(Math.max(a.x, b.x, c.x)),
        );
        const minY = Math.max(0, Math.floor(Math.min(a.y, b.y, c.y)));
        const maxY = Math.min(
            this.#height - 1,
            Math.ceil(Math.max(a.y, b.y, c.y)),
        );
        const area = edge(a, b, c.x, c.y);
        if (area === 0) return;

        for (let y = minY; y <= maxY; y += 1) {
            const characterRow = characters[y];
            const depthRow = depths[y];
            if (characterRow === undefined || depthRow === undefined) continue;
            for (let x = minX; x <= maxX; x += 1) {
                const weightA = edge(b, c, x + 0.5, y + 0.5) / area;
                const weightB = edge(c, a, x + 0.5, y + 0.5) / area;
                const weightC = 1 - weightA - weightB;
                if (weightA < 0 || weightB < 0 || weightC < 0) continue;
                const depth = a.z * weightA + b.z * weightB + c.z * weightC;
                const currentDepth = depthRow[x];
                if (currentDepth === undefined || depth >= currentDepth)
                    continue;
                depthRow[x] = depth;
                characterRow[x] = shade;
            }
        }
    }
}
