# 04. TypeScript의 언어 서비스·검사·디버깅을 일치시키기

[이전: Java](03-java.md) · [목차](README.md) · [다음: Go](05-go.md)

TS에서 편집기 밑줄, `tsc`, lint, 브라우저 오류는 서로 다른 검사다. 이 네 가지의 실행 환경을
확인하면 VS Code의 기본 기능만으로도 탐색·리팩터링·디버깅 흐름을 만들 수 있다.

## 프로젝트가 사용하는 TypeScript부터 확인한다

`package.json`, lockfile, `tsconfig.json`이 있는 폴더를 연다. 타입 검사는 프로젝트의 script로
실행하고, 열린 TS 파일의 Language Status에서 실제 언어 서비스 버전을 확인한다.
프로젝트 compiler와 편집기의 language service는 별개다.
[TypeScript compiler와 language service](https://code.visualstudio.com/docs/typescript/typescript-transpiling)

2026-09-06 확인한 문서에서는 TS 설정이 `js/ts.*`로 안내된다. 예전 VS Code의
`typescript.tsdk` 예제를 새 버전에 무조건 붙여 넣지 않는다. Settings에서 SDK 설정을 검색하고
현재 지원 키를 확인한다. 기존 JS 기반 TypeScript SDK를 선택할 때는 프로젝트의 지원되는
language-service 경로를 지정하고, Language Status의 버전 선택에서 적용 여부를 확인한다.

TypeScript 7의 native compiler·language server는 별도의 호환성 경계다. 오래된
`node_modules/typescript/lib` 경로에 파일이 있다고 가정하거나 `tsdk`만 지정하면 native
서비스까지 선택된다고 가정하지 않는다. 현재 설치된 VS Code가 제공하는 TS 7 통합 또는
Microsoft의 Native Preview 경로를 공식 안내와 함께 확인한다.
[VS Code 팀의 TS 7 전환 기록](https://code.visualstudio.com/blogs/2026/06/26/iterating-faster-with-ts-7)

이 저장소는 [TypeScript 7 호환성 보고서](../../apps/web/content/tech/docs/ko/fe/typescript-7-compatibility.mdx)가
기준이다. compiler API를 사용하는 lint·plugin의 호환성도 별도로 확인하며 편집기 오류를 숨기려고
타입 검사를 끄지 않는다.

## 필요한 확장만 고른다

기본 JavaScript/TypeScript 언어 지원과 Node·Chrome/Edge 디버거는 VS Code에 포함된다.
코드 실행용 범용 확장을 추가해 tsconfig·cwd를 우회할 필요가 없다.
[TypeScript 개요](https://code.visualstudio.com/docs/languages/typescript),
[TS debugging](https://code.visualstudio.com/docs/typescript/typescript-debugging)

| 프로젝트             | 추가할 확장                                        | 유지할 경계                       |
| -------------------- | -------------------------------------------------- | --------------------------------- |
| Prettier·ESLint      | `esbenp.prettier-vscode`, `dbaeumer.vscode-eslint` | 02편의 스타일 규칙 분리           |
| 이 저장소의 Oxc      | `oxc.oxc-vscode`                                   | 기존 Oxfmt·Oxlint 설정 사용       |
| React·Next           | 사용하는 framework에 필요한 기능만                 | built-in TS 기능과 중복 여부 확인 |
| Vitest·Playwright 등 | 실제 test runner의 공식 통합                       | 테스트 실행과 타입 검사 구분      |

## 타입을 보면서 코드를 읽는다

Hover로 추론 타입을 보고, Signature Help로 인자를 확인한다. parameter inlay hint는 `literals`
정도로 시작하면 불리언·숫자 인자의 의미를 읽기 좋다. References CodeLens·Implementations
CodeLens도 필요한 경우에만 켠다. 현재 설정 키는 각각 `js/ts.inlayHints.parameterNames.enabled`,
`js/ts.referencesCodeLens.enabled`, `js/ts.implementationsCodeLens.enabled`다.
[TS editing](https://code.visualstudio.com/docs/typescript/typescript-editing)

파일 이동은 Explorer에서 실행하고 import 갱신 diff를 확인한다. 함수·interface 이름은 F2,
복잡한 표현식은 Refactor에서 Extract한다. import 경로 정책을 바꿀 때는 `tsconfig` alias와
런타임·bundler의 해석을 함께 확인한다. 타입 검사만 되는 alias가 Node에서 자동 해석되는 것은 아니다.
[TS refactoring](https://code.visualstudio.com/docs/typescript/typescript-refactoring)

React에서는 컴포넌트를 별도 파일로 옮긴 뒤 props 타입, JSX import, 실제 화면 테스트를 확인한다.
Next의 Server/Client Component 경계와 route 생성 타입은 framework build도 검사해야 한다.
이 저장소에서는 [Web 가이드](../web/README.md)의 명령을 사용한다.

## 디버깅: 먼저 작은 Node ESM 프로젝트

아래는 **일반 Node·TypeScript 학습 프로젝트**다. Next·Bun 앱의 manifest를 이 구성으로
바꾸는 예제가 아니다. `npm init -y` 후 `npm install --save-dev --save-exact typescript @types/node`를 실행하고
다음 필드를 `package.json`에 병합한다.

```json
{
    "type": "module",
    "scripts": {
        "build": "tsc -p tsconfig.json",
        "typecheck": "tsc -p tsconfig.json --noEmit"
    }
}
```

`tsconfig.json`:

```json
{
    "compilerOptions": {
        "target": "ES2022",
        "module": "NodeNext",
        "moduleResolution": "NodeNext",
        "lib": ["ES2022"],
        "types": ["node"],
        "rootDir": "src",
        "outDir": "dist",
        "strict": true,
        "sourceMap": true
    },
    "include": ["src/**/*.ts"]
}
```

`src/main.ts`:

```ts
function total(price: number, quantity: number): number {
    return price * quantity;
}

const result = total(1200, 3);
console.log({ result });
```

`tasks.json`은 터미널과 같은 프로젝트 build script를 호출한다.

```json
{
    "version": "2.0.0",
    "tasks": [
        {
            "label": "ts: build",
            "type": "shell",
            "command": "npm",
            "args": ["run", "build"],
            "options": { "cwd": "${workspaceFolder}" },
            "problemMatcher": ["$tsc"],
            "group": "build"
        }
    ]
}
```

`launch.json`은 생성된 JS를 실행하고 source map으로 원본 TS에 멈춘다.

```json
{
    "version": "0.2.0",
    "configurations": [
        {
            "type": "node",
            "name": "TS: compiled Node program",
            "request": "launch",
            "program": "${workspaceFolder}/dist/main.js",
            "cwd": "${workspaceFolder}",
            "preLaunchTask": "ts: build",
            "outFiles": ["${workspaceFolder}/dist/**/*.js"],
            "sourceMaps": true,
            "skipFiles": ["<node_internals>/**"]
        }
    ]
}
```

`return` 줄에 breakpoint를 넣고 F5를 누른다. `price=1200`, `quantity=3`과 반환값 `3600`을
확인한다. 회색 breakpoint라면 `dist`의 JS·map 생성, 원본 경로, 실행 중인 파일을 차례로 확인한다.
`preLaunchTask` 이름이 Tasks의 `label`과 정확히 같아야 한다.
[Source map·outFiles](https://code.visualstudio.com/docs/typescript/typescript-debugging)

## 웹·Node·Bun의 디버거를 구분한다

브라우저 코드는 Chrome/Edge launch 설정에서 개발 서버 URL과 `webRoot`를 맞춘다.
서버 Node 프로세스는 JavaScript Debug Terminal에서 실행하거나 Node attach를 사용한다.
SSR 앱은 서버에서 실행되는 함수와 브라우저 event handler에 각각 breakpoint를 넣어 어느
프로세스에서 실행되는지 확인한다. [Node debugging](https://code.visualstudio.com/docs/nodejs/nodejs-debugging)

Bun으로 실행하는 프로세스에는 Node inspector 설정을 그대로 적용하지 않는다. Bun의
공식 debugging 절차를 따르고, 브라우저 디버깅은 별도 세션으로 다룬다.
[Bun debugging](https://bun.sh/docs/runtime/debugger)
이 저장소의 Next main·standalone은 Bun이라는 점은 [런타임 안내](../web/bun-standalone-runtime.md)를 따른다.

테스트는 실제 runner의 CLI와 통합을 사용한다. Vitest·Jest·Bun test 설정을 서로 복사하지 않는다.
이 저장소의 focused 검사 예시는 다음과 같다.

```sh
bun run --filter @jongminchung/web test next.config.test.ts
bun run --filter @jongminchung/web typecheck
bun run --filter @jongminchung/web test:e2e --grep "mobile keyboard"
```

마지막 명령은 Playwright이며 Node 단위 테스트와 다르다. 테스트 발견·단위 테스트 성공과
production browser 동작을 각각 확인한다.

## 모노레포·타입 기반 lint에서 생기는 문제

| 증상                             | 확인할 것                                                  |
| -------------------------------- | ---------------------------------------------------------- |
| IDE만 타입 오류                  | 활성 TS language service 버전·소속 tsconfig·재시작 후 결과 |
| 특정 package에 ESLint가 안 뜸    | Output의 cwd·config, `eslint.workingDirectories`           |
| type-aware 규칙이 파일을 못 읽음 | typescript-eslint의 project service·tsconfig 포함 범위     |
| alias가 실행 중 실패             | Node/bundler 해석과 package exports                        |
| 저장이 느림                      | 전체 type-aware lint와 formatter 시간을 따로 관찰          |
| 브라우저에서만 실패              | 서버/클라이언트 런타임·source map·네트워크 응답            |

ESLint working directory를 추가할 때는 실제 package 루트를 명시하고 Output으로 확인한다.
`mode: auto`가 모든 모노레포 구조를 정확히 이해한다고 전제하지 않는다.
[ESLint extension](https://github.com/microsoft/vscode-eslint)

타입 정보를 쓰는 lint는 기본 권장 lint보다 설정·실행 비용이 더 든다. 필요한 규칙을 선택하고
파일 포함 범위를 설정한다. [Typed linting](https://typescript-eslint.io/getting-started/typed-linting/)

실습 영상: [How to Run Typescript in VS Code](https://www.youtube.com/watch?v=_hKYFKZPZmc)
— Train To Code, 2022-11-10. 프로젝트 로컬 compiler와 디버깅 흐름을 참고한다. 당시 SDK 설정이나
글로벌 설치를 현재 팀 기준으로 복사하지 않고 위 문서의 버전 선택 절차를 적용한다.
