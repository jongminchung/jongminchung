// @ts-nocheck -- Upstream visual source; runtime contracts are checked at the registry boundary.

// 시임 카빙(Avidan & Shamir, 2007) — 에너지가 가장 낮은 세로 경로를 찾아 한 줄씩 제거한다.
// 메인 스레드(SeamCarvingDemo)와 워커(seamCarver.worker.ts)가 같은 코드를 쓴다.

let energyBuf = new Float32Array(0);
let seamBuf = new Int32Array(0);

// 시임 하나를 찾아 제거한다. 버퍼는 stride(원본 폭) 그대로 두고 논리적 폭 w만 줄어든다.
export function carveSeam(px: Uint8ClampedArray, stride: number, w: number, h: number): void {
  if (energyBuf.length < w * h) energyBuf = new Float32Array(w * h);
  if (seamBuf.length < h) seamBuf = new Int32Array(h);
  const e = energyBuf;

  // 1) 에너지 맵 — 이웃과의 색 차이(그라디언트)가 클수록 지우면 티가 나는 픽셀이다
  for (let y = 0; y < h; y++) {
    const row = y * stride * 4;
    const up = (y > 0 ? y - 1 : y) * stride * 4;
    const dn = (y < h - 1 ? y + 1 : y) * stride * 4;
    for (let x = 0; x < w; x++) {
      const xl = (x > 0 ? x - 1 : x) * 4;
      const xr = (x < w - 1 ? x + 1 : x) * 4;
      const xc = x * 4;
      let g = 0;
      for (let c = 0; c < 3; c++) {
        const dx = px[row + xr + c] - px[row + xl + c];
        const dy = px[dn + xc + c] - px[up + xc + c];
        g += dx * dx + dy * dy;
      }
      e[y * w + x] = g;
    }
  }

  // 2) 동적 계획법 — 위에서 아래로, 각 픽셀까지 도달하는 최소 누적 에너지를 채운다
  for (let y = 1; y < h; y++) {
    const cur = y * w;
    const prev = cur - w;
    for (let x = 0; x < w; x++) {
      let m = e[prev + x];
      if (x > 0 && e[prev + x - 1] < m) m = e[prev + x - 1];
      if (x < w - 1 && e[prev + x + 1] < m) m = e[prev + x + 1];
      e[cur + x] += m;
    }
  }

  // 3) 역추적 — 마지막 행의 최소값에서 출발해 위로 최소 경로를 따라간다
  let sx = 0;
  const last = (h - 1) * w;
  for (let x = 1; x < w; x++) if (e[last + x] < e[last + sx]) sx = x;
  seamBuf[h - 1] = sx;
  for (let y = h - 2; y >= 0; y--) {
    const row = y * w;
    const below = seamBuf[y + 1];
    let bx = below;
    let m = e[row + below];
    if (below > 0 && e[row + below - 1] < m) {
      m = e[row + below - 1];
      bx = below - 1;
    }
    if (below < w - 1 && e[row + below + 1] < m) bx = below + 1;
    seamBuf[y] = bx;
  }

  // 4) 제거 — 각 행에서 시임 오른쪽 픽셀들을 한 칸씩 당긴다
  for (let y = 0; y < h; y++) {
    const row = y * stride * 4;
    px.copyWithin(row + seamBuf[y] * 4, row + (seamBuf[y] + 1) * 4, row + w * 4);
  }
}

// stride 버퍼에서 논리적 폭 w만큼만 촘촘하게 뽑아낸 표시용 프레임을 만든다
export function packFrame(
  px: Uint8ClampedArray,
  stride: number,
  w: number,
  h: number,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    out.set(px.subarray(y * stride * 4, y * stride * 4 + w * 4), y * w * 4);
  }
  return out;
}
