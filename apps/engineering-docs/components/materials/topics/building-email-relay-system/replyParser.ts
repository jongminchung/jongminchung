// 답장 본문에서 새로 쓴 부분만 발라내는 파서
// GitHub의 email_reply_parser와 같은 문제를 푼다

export type LineKind = "content" | "quote" | "quote-header" | "signature";

export interface ClassifiedLine {
    text: string;
    kind: LineKind;
    hidden: boolean; // 최종적으로 걷어낼 줄인가
}

// 인용 헤더: 메일 클라이언트가 인용문 위에 끼워 넣는 "누가 언제 썼다" 문구.
// 다음 줄부터 실제 인용(>)이 이어질 때만 인용 헤더로 취급한다
const QUOTE_HEADER_PATTERNS = [
    /^On .+ wrote:$/, // Gmail 영문
    /^20\d{2}년 .+님이 작성:$/, // Gmail 한글
    /^\d{4}\. \d{1,2}\. \d{1,2}\..* 작성:$/, // Apple Mail 한글
];

// 강한 구분선: 이 줄 아래는 전부 원문 인용이다.
// Outlook 계열은 인용문에 > 를 붙이지 않고 이런 구분선만 남기기 때문에
// "다음 줄이 > 로 시작하는가"로는 판별할 수 없다
const HARD_SEPARATOR_PATTERNS = [
    /^-{2,}\s*Original Message\s*-{2,}$/i, // Outlook 영문
    /^-{2,}\s*원본 (메일|메시지)\s*-{2,}$/, // Outlook 한글
    /^_{10,}$/, // Outlook 웹의 밑줄 구분선
    /^보낸 ?사람\s*:.+/, // Outlook식 인라인 헤더 블록의 첫 줄
    /^From\s*:\s*.+@.+/, // 같은 블록의 영문판
];

// 시그니처의 시작
const SIGNATURE_PATTERNS = [
    /^-- $/, // 표준 시그니처 구분자 (대시 둘 + 공백 하나)
    /^--$/, // 공백을 지워버리는 클라이언트가 많아 이것도 받아준다
    /^(Sent from my|Get Outlook for) /, // Sent from my iPhone 등
    /^i(Phone|Pad)에서 보냄$/,
    /^Android에서 .*보냄$/,
];

export function classifyLines(body: string): ClassifiedLine[] {
    const lines = body.replace(/\r\n/g, "\n").split("\n");

    // 1차: 위에서 아래로 줄의 종류를 정한다
    const kinds: LineKind[] = [];
    let afterHardSeparator = false;
    let inSignature = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!.trimEnd();
        if (afterHardSeparator) {
            kinds.push("quote"); // 강한 구분선 아래는 전부 인용이다
        } else if (HARD_SEPARATOR_PATTERNS.some((p) => p.test(line))) {
            afterHardSeparator = true;
            kinds.push("quote-header");
        } else if (line.startsWith(">")) {
            inSignature = false;
            kinds.push("quote");
        } else if (QUOTE_HEADER_PATTERNS.some((p) => p.test(line))) {
            const next = lines.slice(i + 1).find((l) => l.trim() !== "");
            kinds.push(
                next === undefined || next.startsWith(">")
                    ? "quote-header"
                    : "content",
            );
        } else if (inSignature) {
            kinds.push("signature");
        } else if (SIGNATURE_PATTERNS.some((p) => p.test(line))) {
            inSignature = true;
            kinds.push("signature");
        } else {
            kinds.push("content");
        }
    }

    // 2차: 아래에서 위로 걷어낸다. 맨 아래에 붙은 인용·인용 헤더·시그니처·빈 줄
    // 덩어리가 걷어낼 대상이고, 본문(content)을 만나는 순간 걷어내기를 멈춘다.
    // 이렇게 하면 인용문 사이사이에 답을 단 인라인 답장이 살아남는다
    const hidden = Array.from<boolean>({ length: lines.length }).fill(false);
    for (let i = lines.length - 1; i >= 0; i--) {
        if (kinds[i] === "content" && lines[i]!.trim() !== "") break;
        hidden[i] = true;
    }

    return lines.map((text, i) => ({
        text,
        kind: kinds[i]!,
        hidden: hidden[i]!,
    }));
}

export function extractReply(body: string): string {
    return classifyLines(body)
        .filter((l) => !l.hidden)
        .map((l) => l.text)
        .join("\n")
        .trim();
}
