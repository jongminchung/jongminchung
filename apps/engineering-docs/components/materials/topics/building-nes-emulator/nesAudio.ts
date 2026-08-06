// @ts-nocheck -- Upstream visual source; runtime contracts are checked at the registry boundary.

// NES APU 오디오 출력 헬퍼.
// AudioWorklet(링 버퍼) 기반. 워크릿 코드는 별도 파일 서빙 문제를 피하려고
// 문자열 → Blob URL로 등록한다 (Vite/Astro 빌드에서 안전).

const RING_CAPACITY = 16384; // 링 버퍼 크기 (샘플)
const HIGH_WATER = 12288; // 이보다 많이 쌓이면 오래된 것부터 버림 (지연 방지)
const MASTER_GAIN = 0.5;

const WORKLET_CODE = `
class NesAudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.capacity = ${RING_CAPACITY};
    this.highWater = ${HIGH_WATER};
    this.buf = new Float32Array(this.capacity);
    this.readPos = 0;
    this.writePos = 0;
    this.size = 0;
    // DC 제거 하이패스 상태 (에뮬레이터 출력은 0.0~1.0 + DC 오프셋)
    this.prevIn = 0;
    this.prevOut = 0;
    // 언더런 시 클릭 노이즈 방지용: 마지막 출력값에서 서서히 0으로
    this.lastOut = 0;
    this.port.onmessage = (e) => {
      const data = e.data;
      if (!(data instanceof Float32Array) || data.length === 0) return;
      // 오버런 방지: 넘치면 오래된 샘플부터 버린다
      const overflow = this.size + data.length - this.highWater;
      if (overflow > 0) {
        const drop = Math.min(this.size, overflow);
        this.readPos = (this.readPos + drop) % this.capacity;
        this.size -= drop;
      }
      for (let i = 0; i < data.length && this.size < this.capacity; i++) {
        this.buf[this.writePos] = data[i];
        this.writePos = (this.writePos + 1) % this.capacity;
        this.size++;
      }
    };
  }
  process(inputs, outputs) {
    const out = outputs[0][0];
    for (let i = 0; i < out.length; i++) {
      if (this.size > 0) {
        const x = this.buf[this.readPos];
        this.readPos = (this.readPos + 1) % this.capacity;
        this.size--;
        // 1차 하이패스: y[n] = x[n] - x[n-1] + 0.995*y[n-1]
        const y = x - this.prevIn + 0.995 * this.prevOut;
        this.prevIn = x;
        this.prevOut = y;
        this.lastOut = y;
        out[i] = y;
      } else {
        // 언더런: 마지막 값에서 서서히 0으로
        this.lastOut *= 0.95;
        out[i] = this.lastOut;
      }
    }
    return true;
  }
}
registerProcessor('nes-audio', NesAudioProcessor);
`;

interface StatEntry {
  t: number;
  count: number;
  absSum: number;
}

export class NesAudio {
  private ctx: AudioContext | null = null;
  private node: AudioWorkletNode | null = null;
  private gain: GainNode | null = null;
  private starting = false;
  private closed = false;
  private muted = false;
  private stats: StatEntry[] = [];

  /** 사용자 제스처(캔버스 첫 클릭) 안에서 호출해야 한다. 이미 시작됐으면 resume만 한다. */
  start() {
    if (this.closed) return;
    if (this.ctx) {
      if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
      return;
    }
    if (this.starting) return;
    this.starting = true;
    void this.init();
  }

  private async init() {
    let ctx: AudioContext | null = null;
    try {
      ctx = new AudioContext({ sampleRate: 44100 });
      const blob = new Blob([WORKLET_CODE], { type: "application/javascript" });
      const url = URL.createObjectURL(blob);
      try {
        await ctx.audioWorklet.addModule(url);
      } finally {
        URL.revokeObjectURL(url);
      }
      if (this.closed) {
        void ctx.close();
        return;
      }
      const node = new AudioWorkletNode(ctx, "nes-audio", {
        numberOfInputs: 0,
        numberOfOutputs: 1,
        outputChannelCount: [1],
      });
      const gain = ctx.createGain();
      gain.gain.value = this.muted ? 0 : MASTER_GAIN;
      node.connect(gain);
      gain.connect(ctx.destination);
      this.ctx = ctx;
      this.node = node;
      this.gain = gain;
      if (ctx.state !== "running") ctx.resume().catch(() => {});
    } catch {
      // 오디오 초기화 실패는 조용히 무시 — 게임 자체는 계속 돌아간다
      if (ctx) void ctx.close().catch(() => {});
    } finally {
      this.starting = false;
    }
  }

  /**
   * 매 프레임 호출. 컨텍스트가 없거나 음소거면 샘플을 버린다
   * (호출 자체는 Rust 쪽 버퍼가 무한히 쌓이지 않게 하는 배수구 역할).
   */
  push(samples: Float32Array) {
    this.updateStats(samples);
    if (samples.length === 0 || !this.node || this.muted) return;
    if (!this.ctx || this.ctx.state !== "running") return;
    this.node.port.postMessage(samples, [samples.buffer]);
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (this.gain && this.ctx) {
      this.gain.gain.setValueAtTime(muted ? 0 : MASTER_GAIN, this.ctx.currentTime);
    }
    this.publishStats(0, 0, 0);
  }

  suspend() {
    if (this.ctx && this.ctx.state === "running") this.ctx.suspend().catch(() => {});
  }

  resume() {
    if (this.ctx && this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
  }

  close() {
    this.closed = true;
    this.node = null;
    this.gain = null;
    if (this.ctx) {
      void this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }

  // ── 디버그 훅: 최근 1초간 워크릿으로 보낸 샘플 수 / 원본 절대값 평균 ──
  private updateStats(samples: Float32Array) {
    const sent = samples.length > 0 && !!this.node && !this.muted && this.ctx?.state === "running";
    const now = performance.now();
    if (sent) {
      let absSum = 0;
      for (let i = 0; i < samples.length; i++) absSum += Math.abs(samples[i]);
      this.stats.push({ t: now, count: samples.length, absSum });
    }
    while (this.stats.length > 0 && now - this.stats[0].t > 1000) this.stats.shift();
    let count = 0;
    let absSum = 0;
    for (const s of this.stats) {
      count += s.count;
      absSum += s.absSum;
    }
    this.publishStats(count, absSum, count > 0 ? absSum / count : 0);
  }

  private publishStats(samplesLastSec: number, _absSum: number, meanAbs: number) {
    if (typeof window === "undefined") return;
    (window as any).__nesAudioStats = {
      samplesLastSec,
      meanAbs,
      contextState: this.ctx ? this.ctx.state : "none",
      gain: this.gain ? this.gain.gain.value : 0,
      muted: this.muted,
    };
  }
}
