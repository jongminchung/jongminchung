// @ts-nocheck -- Upstream visual source; runtime contracts are checked at the registry boundary.

// 유전 알고리즘 자동차 시뮬레이션 공용 엔진
// 본문에서 설명하는 코드와 동일한 로직을 담고 있다.

// ---------- 결정적 난수 ----------
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function gaussian(rand: () => number) {
  let u = 0;
  let v = 0;
  while (u === 0) u = rand();
  while (v === 0) v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// ---------- 트랙 ----------
export const WORLD_W = 900;
export const WORLD_H = 620;
export const HALF_W = 30; // 트랙 반폭(px)
const GRID = 4; // 거리 그리드 해상도(px)

// 우측 헤어핀([800,260]→[640,340]→[750,460])과 하단 S 시케인이 있는 난코스
const CONTROL: Array<[number, number]> = [
  [150, 300],
  [180, 150],
  [330, 90],
  [500, 120],
  [620, 70],
  [770, 120],
  [800, 260],
  [640, 340],
  [750, 460],
  [620, 540],
  [460, 450],
  [380, 540],
  [300, 460],
  [160, 470],
];

function catmullRom(points: Array<[number, number]>, samplesPerSeg: number) {
  const n = points.length;
  const out: Array<[number, number]> = [];
  for (let i = 0; i < n; i++) {
    const p0 = points[(i - 1 + n) % n];
    const p1 = points[i];
    const p2 = points[(i + 1) % n];
    const p3 = points[(i + 2) % n];
    for (let j = 0; j < samplesPerSeg; j++) {
      const t = j / samplesPerSeg;
      const t2 = t * t;
      const t3 = t2 * t;
      out.push([
        0.5 *
          (2 * p1[0] +
            (-p0[0] + p2[0]) * t +
            (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 +
            (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 *
          (2 * p1[1] +
            (-p0[1] + p2[1]) * t +
            (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 +
            (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
      ]);
    }
  }
  return out;
}

export interface Track {
  center: Array<[number, number]>;
  total: number;
  dist(x: number, y: number): number;
  inside(x: number, y: number): boolean;
}

let cachedTrack: Track | null = null;

export function buildTrack(): Track {
  if (cachedTrack) return cachedTrack;
  const center = catmullRom(CONTROL, 16);
  const n = center.length;
  const gw = Math.ceil(WORLD_W / GRID) + 1;
  const gh = Math.ceil(WORLD_H / GRID) + 1;
  const grid = new Float32Array(gw * gh);
  for (let gy = 0; gy < gh; gy++) {
    for (let gx = 0; gx < gw; gx++) {
      const px = gx * GRID;
      const py = gy * GRID;
      let best = Infinity;
      for (let i = 0; i < n; i++) {
        const a = center[i];
        const b = center[(i + 1) % n];
        const abx = b[0] - a[0];
        const aby = b[1] - a[1];
        const apx = px - a[0];
        const apy = py - a[1];
        let t = (apx * abx + apy * aby) / (abx * abx + aby * aby);
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const dx = apx - abx * t;
        const dy = apy - aby * t;
        const d = dx * dx + dy * dy;
        if (d < best) best = d;
      }
      grid[gy * gw + gx] = Math.sqrt(best);
    }
  }
  let total = 0;
  for (let i = 0; i < n; i++) {
    const a = center[i];
    const b = center[(i + 1) % n];
    total += Math.hypot(b[0] - a[0], b[1] - a[1]);
  }
  cachedTrack = {
    center,
    total,
    dist(x, y) {
      if (x < 0 || y < 0 || x >= WORLD_W || y >= WORLD_H) return 1e9;
      return grid[Math.round(y / GRID) * gw + Math.round(x / GRID)];
    },
    inside(x, y) {
      return this.dist(x, y) <= HALF_W;
    },
  };
  return cachedTrack;
}

// ---------- 자동차 ----------
export const SPEED = 140; // px/s
export const MAX_TURN = 2.5; // rad/s
export const DT = 1 / 60;
export const RAY_ANGLES = [-Math.PI / 2, -Math.PI / 4, 0, Math.PI / 4, Math.PI / 2];
export const RAY_LEN = 160;
const RAY_STEP = 8;

export function senseRays(track: Track, x: number, y: number, heading: number, out: Float32Array) {
  for (let r = 0; r < RAY_ANGLES.length; r++) {
    const a = heading + RAY_ANGLES[r];
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    let d = RAY_LEN;
    for (let s = RAY_STEP; s <= RAY_LEN; s += RAY_STEP) {
      if (!track.inside(x + dx * s, y + dy * s)) {
        d = s;
        break;
      }
    }
    out[r] = d / RAY_LEN;
  }
}

// ---------- 신경망 정책 ----------
export const N_IN = 5;
export const N_HID = 6;
export const GENOME_LEN = N_IN * N_HID + N_HID + N_HID + 1; // 43

// genome 레이아웃: [W1(5×6), b1(6), W2(6), b2(1)]
export function forward(genome: Float32Array, sensors: Float32Array, hid: Float32Array) {
  let g = 0;
  for (let h = 0; h < N_HID; h++) {
    let sum = 0;
    for (let i = 0; i < N_IN; i++) sum += genome[g++] * sensors[i];
    hid[h] = sum;
  }
  for (let h = 0; h < N_HID; h++) hid[h] = Math.tanh(hid[h] + genome[g++]);
  let out = 0;
  for (let h = 0; h < N_HID; h++) out += genome[g++] * hid[h];
  return Math.tanh(out + genome[g++]); // -1 ~ 1
}

// ---------- 개체 ----------
export interface Car {
  genome: Float32Array;
  x: number;
  y: number;
  heading: number;
  alive: boolean;
  frames: number; // 살아남은 프레임 수 = 적합도
  travel: number;
  sensors: Float32Array;
  hid: Float32Array;
}

export function spawnCar(track: Track, genome: Float32Array): Car {
  const start = track.center[0];
  const next = track.center[1];
  return {
    genome,
    x: start[0],
    y: start[1],
    heading: Math.atan2(next[1] - start[1], next[0] - start[0]),
    alive: true,
    frames: 0,
    travel: 0,
    sensors: new Float32Array(N_IN),
    hid: new Float32Array(N_HID),
  };
}

// 한 프레임 진행. 죽으면 alive=false
export function stepCar(track: Track, car: Car) {
  if (!car.alive) return;
  senseRays(track, car.x, car.y, car.heading, car.sensors);
  const steer = forward(car.genome, car.sensors, car.hid);
  car.heading += steer * MAX_TURN * DT;
  car.x += Math.cos(car.heading) * SPEED * DT;
  car.y += Math.sin(car.heading) * SPEED * DT;
  car.travel += SPEED * DT;
  if (!track.inside(car.x, car.y)) {
    car.alive = false;
    return;
  }
  car.frames++;
}

// ---------- 유전 연산 ----------
export function randomGenome(rand: () => number) {
  const g = new Float32Array(GENOME_LEN);
  for (let i = 0; i < GENOME_LEN; i++) g[i] = rand() * 2 - 1;
  return g;
}

export function rouletteSelect(pop: Float32Array[], fits: number[], rand: () => number) {
  let total = 0;
  for (const f of fits) total += f;
  if (total === 0) return pop[Math.floor(rand() * pop.length)];
  let r = rand() * total;
  for (let i = 0; i < pop.length; i++) {
    r -= fits[i];
    if (r <= 0) return pop[i];
  }
  return pop[pop.length - 1];
}

export function tournamentSelect(
  pop: Float32Array[],
  fits: number[],
  k: number,
  rand: () => number,
) {
  let best = -1;
  for (let i = 0; i < k; i++) {
    const c = Math.floor(rand() * pop.length);
    if (best < 0 || fits[c] > fits[best]) best = c;
  }
  return pop[best];
}

export function crossoverUniform(a: Float32Array, b: Float32Array, rand: () => number) {
  const c = new Float32Array(GENOME_LEN);
  for (let i = 0; i < GENOME_LEN; i++) c[i] = rand() < 0.5 ? a[i] : b[i];
  return c;
}

export function crossoverOnePoint(a: Float32Array, b: Float32Array, rand: () => number) {
  const c = new Float32Array(GENOME_LEN);
  const p = 1 + Math.floor(rand() * (GENOME_LEN - 1));
  for (let i = 0; i < GENOME_LEN; i++) c[i] = i < p ? a[i] : b[i];
  return c;
}

export function mutate(g: Float32Array, rate: number, sigma: number, rand: () => number) {
  for (let i = 0; i < GENOME_LEN; i++) {
    if (rand() < rate) g[i] += gaussian(rand) * sigma;
  }
}

// ---------- 세대 교체 ----------
export interface GAOptions {
  popSize: number;
  tournamentK: number;
  mutRate: number;
  mutSigma: number;
  elitism: number;
}

export const DEFAULT_GA: GAOptions = {
  popSize: 60,
  tournamentK: 3,
  mutRate: 0.1,
  mutSigma: 0.5,
  elitism: 2,
};

// 평가가 끝난 개체군(fits)으로 다음 세대 유전자를 만든다
export function nextGeneration(
  pop: Float32Array[],
  fits: number[],
  opts: GAOptions,
  rand: () => number,
) {
  const idx = fits.map((_, i) => i).sort((a, b) => fits[b] - fits[a]);
  const next: Float32Array[] = [];
  for (let e = 0; e < opts.elitism && e < pop.length; e++) next.push(pop[idx[e]]);
  while (next.length < opts.popSize) {
    const p1 = tournamentSelect(pop, fits, opts.tournamentK, rand);
    const p2 = tournamentSelect(pop, fits, opts.tournamentK, rand);
    const child = crossoverUniform(p1, p2, rand);
    mutate(child, opts.mutRate, opts.mutSigma, rand);
    next.push(child);
  }
  return next;
}
