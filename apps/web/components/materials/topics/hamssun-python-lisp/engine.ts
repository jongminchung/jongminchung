// 함수썬(Hamssun) 인터프리터 — 본문의 Python 구현(hamssun.py)을 TypeScript로 그대로 옮긴 것.
// 데모 컴포넌트들은 전부 이 엔진을 import해서 사용한다.

export type Expr = number | boolean | string | Expr[];
export type Value =
    | number
    | boolean
    | string
    | Value[]
    | Procedure
    | BuiltinFn
    | null;
export type BuiltinFn = (...args: Value[]) => Value;

// ---------- 1. 토큰화 ----------

export function tokenize(source: string): string[] {
    return source
        .replace(/\(/g, " ( ")
        .replace(/\)/g, " ) ")
        .split(/\s+/)
        .filter((t) => t.length > 0);
}

// ---------- 2. 파싱 ----------

export function parse(tokens: string[]): Expr {
    if (tokens.length === 0) {
        throw new SyntaxError("입력이 끝나버렸다. 괄호가 닫혔는지 확인하자");
    }
    const token = tokens.shift()!;
    if (token === "(") {
        const expr: Expr[] = [];
        while (tokens.length > 0 && tokens[0] !== ")") {
            expr.push(parse(tokens));
        }
        if (tokens.length === 0) {
            throw new SyntaxError("닫는 괄호가 없다");
        }
        tokens.shift(); // ')' 버리기
        return expr;
    } else if (token === ")") {
        throw new SyntaxError("여는 괄호 없이 )가 나왔다");
    } else {
        return atom(token);
    }
}

export function atom(token: string): Expr {
    if (token === "#t") return true;
    if (token === "#f") return false;
    const n = Number(token);
    if (!Number.isNaN(n) && token.trim() !== "") return n;
    return token; // Symbol
}

export function read(source: string): Expr {
    return parse(tokenize(source));
}

// 여러 식이 든 소스를 순서대로 파싱한다 (REPL 멀티라인 입력용)
export function readAll(source: string): Expr[] {
    const tokens = tokenize(source);
    const exprs: Expr[] = [];
    while (tokens.length > 0) {
        exprs.push(parse(tokens));
    }
    return exprs;
}

// ---------- 3. 환경 ----------

export class Env {
    vars = new Map<string, Value>();
    outer: Env | null;

    constructor(
        params: string[] = [],
        args: Value[] = [],
        outer: Env | null = null,
    ) {
        params.forEach((p, i) => this.vars.set(p, args[i]!));
        this.outer = outer;
    }

    find(name: string): Env {
        if (this.vars.has(name)) return this;
        if (this.outer === null) {
            throw new ReferenceError(`정의되지 않은 이름: ${name}`);
        }
        return this.outer.find(name);
    }

    get(name: string): Value {
        return this.find(name).vars.get(name)!;
    }

    set(name: string, value: Value): void {
        this.vars.set(name, value);
    }
}

const asNum = (v: Value): number => {
    if (typeof v !== "number")
        throw new TypeError(`숫자가 아니다: ${toLispString(v)}`);
    return v;
};
const asList = (v: Value): Value[] => {
    if (!Array.isArray(v))
        throw new TypeError(`리스트가 아니다: ${toLispString(v)}`);
    return v;
};
const asFn = (v: Value): Procedure | BuiltinFn => {
    if (v instanceof Procedure || typeof v === "function") return v;
    throw new TypeError(`함수가 아니다: ${toLispString(v)}`);
};
const isTruthy = (v: Value): boolean =>
    v !== false &&
    v !== null &&
    v !== 0 &&
    !(Array.isArray(v) && v.length === 0);
// 주의: Python의 진리값 규칙(0, [] 도 거짓)을 따른다. hamssun.py의 if가 파이썬 진리값을 쓰기 때문.

export function standardEnv(): Env {
    const env = new Env();
    const b: Record<string, BuiltinFn | number> = {
        "+": (...xs) => xs.map(asNum).reduce((a, c) => a + c),
        "-": (...xs) =>
            xs.length === 1
                ? -asNum(xs[0]!)
                : xs.map(asNum).reduce((a, c) => a - c),
        "*": (...xs) => xs.map(asNum).reduce((a, c) => a * c),
        "/": (...xs) => xs.map(asNum).reduce((a, c) => a / c),
        ">": (a, b2) => asNum(a) > asNum(b2),
        "<": (a, b2) => asNum(a) < asNum(b2),
        ">=": (a, b2) => asNum(a) >= asNum(b2),
        "<=": (a, b2) => asNum(a) <= asNum(b2),
        "=": (a, b2) => a === b2,
        quotient: (a, b2) => Math.floor(asNum(a) / asNum(b2)),
        mod: (a, b2) => {
            const m = asNum(a) % asNum(b2);
            return m < 0 !== asNum(b2) < 0 && m !== 0 ? m + asNum(b2) : m; // 파이썬식 mod
        },
        abs: (x) => Math.abs(asNum(x)),
        max: (...xs) => Math.max(...xs.map(asNum)),
        min: (...xs) => Math.min(...xs.map(asNum)),
        not: (x) => !isTruthy(x),
        and: (...xs) => xs.every(isTruthy),
        or: (...xs) => xs.some(isTruthy),
        list: (...xs) => xs,
        car: (xs) => {
            const l = asList(xs);
            if (l.length === 0)
                throw new TypeError("빈 리스트에는 car를 쓸 수 없다");
            return l[0]!;
        },
        cdr: (xs) => asList(xs).slice(1),
        cons: (x, xs) => [x, ...asList(xs)],
        "null?": (xs) => Array.isArray(xs) && xs.length === 0,
        length: (xs) => asList(xs).length,
        range: (a, b2) => {
            const out: Value[] = [];
            for (let i = asNum(a); i < asNum(b2); i++) out.push(i);
            return out;
        },
        map: (f, xs) => asList(xs).map((x) => callProc(asFn(f), [x])),
        filter: (f, xs) =>
            asList(xs).filter((x) => isTruthy(callProc(asFn(f), [x]))),
        pi: Math.PI,
    };
    for (const [k, v] of Object.entries(b)) env.set(k, v);
    return env;
}

// ---------- 4. 평가 ----------

export class Procedure {
    params: string[];
    body: Expr;
    env: Env;

    constructor(params: string[], body: Expr, env: Env) {
        this.params = params;
        this.body = body;
        this.env = env;
    }
}

export function callProc(proc: Procedure | BuiltinFn, args: Value[]): Value {
    if (proc instanceof Procedure) {
        return evaluate(proc.body, new Env(proc.params, args, proc.env));
    }
    return proc(...args);
}

const MAX_DEPTH = 2000;

export function evaluate(x: Expr, env: Env, depth = 0): Value {
    if (depth > MAX_DEPTH) {
        throw new RangeError(
            "재귀가 너무 깊다 (함수썬의 재귀 깊이는 숙주 언어에 묶여 있다)",
        );
    }
    if (typeof x === "string") {
        // 심볼 → 환경에서 찾는다
        return env.get(x);
    }
    if (typeof x === "number" || typeof x === "boolean") {
        return x;
    }
    if (x.length === 0) return x as Value[];

    const head = x[0]!;
    if (head === "quote") {
        return x[1] as Value;
    }
    if (head === "if") {
        const [, test, conseq, alt] = x;
        const branch = isTruthy(evaluate(test!, env, depth + 1))
            ? conseq
            : (alt ?? false);
        return evaluate(branch!, env, depth + 1);
    }
    if (head === "define") {
        const [, name, expr] = x;
        env.set(name as string, evaluate(expr!, env, depth + 1));
        return null;
    }
    if (head === "set!") {
        const [, name, expr] = x;
        env.find(name as string).set(
            name as string,
            evaluate(expr!, env, depth + 1),
        );
        return null;
    }
    if (head === "lambda") {
        const [, params, body] = x;
        return new Procedure((params as Expr[]).map(String), body!, env);
    }
    if (head === "begin") {
        let result: Value = null;
        for (const expr of x.slice(1)) result = evaluate(expr, env, depth + 1);
        return result;
    }

    const proc = asFn(evaluate(head, env, depth + 1));
    const args = x.slice(1).map((arg) => evaluate(arg, env, depth + 1));
    if (proc instanceof Procedure) {
        return evaluate(
            proc.body,
            new Env(proc.params, args, proc.env),
            depth + 1,
        );
    }
    return proc(...args);
}

// ---------- 5. 출력 ----------

export function toLispString(value: Value | Expr): string {
    if (value === true) return "#t";
    if (value === false) return "#f";
    if (value === null) return "";
    if (Array.isArray(value))
        return "(" + value.map(toLispString).join(" ") + ")";
    if (value instanceof Procedure)
        return `#<함수 (${value.params.join(" ")})>`;
    if (typeof value === "function") return "#<내장함수>";
    return String(value);
}

// 여러 식을 순서대로 평가하고 마지막 값을 돌려준다
export function run(source: string, env: Env): Value {
    let result: Value = null;
    for (const expr of readAll(source)) result = evaluate(expr, env);
    return result;
}
