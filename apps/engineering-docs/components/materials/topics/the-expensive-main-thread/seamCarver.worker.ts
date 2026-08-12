import { carveSeam, packFrame } from "./seamCarving";

// 시임 몇 개마다 중간 프레임을 메인 스레드로 흘려보낼지
const FRAME_EVERY = 8;

type CarveRequest = {
    buf: ArrayBuffer;
    stride: number;
    w: number;
    h: number;
    seams: number;
};

addEventListener("message", (e: MessageEvent<CarveRequest>) => {
    const { buf, stride, h, seams } = e.data;
    let w = e.data.w;
    const px = new Uint8ClampedArray(buf);

    for (let s = 1; s <= seams; s++) {
        carveSeam(px, stride, w, h);
        w--;
        if (s % FRAME_EVERY === 0 && s < seams) {
            const frame = packFrame(px, stride, w, h);
            // 중간 프레임은 복사 없이 소유권째 넘긴다(transferable)
            postMessage(
                { type: "frame", buf: frame.buffer, w, done: s },
                { transfer: [frame.buffer] },
            );
        }
    }

    const frame = packFrame(px, stride, w, h);
    postMessage(
        { type: "done", buf: frame.buffer, w, done: seams },
        { transfer: [frame.buffer] },
    );
});
