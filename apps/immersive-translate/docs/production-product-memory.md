# Immersive Translate 프로덕션 제품 메모리

조사일: 2026-07-06 KST

이 문서는 `apps/immersive-translate`를 다음에 다시 작업할 때 프로덕션 Immersive Translate 제품을 잘못 이해하지 않도록 남기는 기준 메모리다. 핵심은 이 앱을 "로컬 번역 엔드포인트 UI"나 "문서 업로드 도구"로 이해하면 안 된다는 점이다.

## 조사 출처

- 공식 한국어 홈페이지: https://immersivetranslate.com/ko/
- 공식 문서 소개: https://immersivetranslate.com/en/docs/
- 웹페이지 번역 문서: https://immersivetranslate.com/en/docs/features/webpage/
- PDF 번역 문서: https://immersivetranslate.com/en/docs/features/pdf/
- 영상 자막 문서: https://immersivetranslate.com/en/docs/features/video-subtitles/
- 영상 제품 페이지: https://immersivetranslate.com/en/video/
- 입력창 번역 문서: https://immersivetranslate.com/en/docs/input/
- 마우스 호버 번역 문서: https://immersivetranslate.com/en/docs/features/hover/
- FAQ: https://immersivetranslate.com/en/docs/faq/
- ePub 문서: https://immersivetranslate.com/en/docs/features/epub/
- 이미지 번역 문서: https://immersivetranslate.com/en/docs/features/image/
- 한국어 마케팅 페이지: https://go.immersivetranslate.com/ko/
- 첨부 reference: `docs/research/screenshots/reference-floating-click-translation-tooltip.png`
- 첨부 reference: `docs/research/screenshots/reference-youtube-bilingual-subtitle.png`
- 첨부 reference: `docs/research/screenshots/reference-go-docs-bilingual-webpage.png`
- 첨부 anti-reference: `docs/research/screenshots/reference-popup-settings-not-v1.png`

## 제품 포지셔닝

Immersive Translate는 소비자용 브라우저 확장 및 모바일 읽기 제품이다. 핵심 약속은 "로컬 번역을 실행한다"가 아니라, 사용자가 외국어 웹페이지, 영상, 문서, 이미지, 텍스트를 원문 맥락과 함께 모국어로 읽게 하는 것이다.

공식 홈페이지는 이 제품을 Chrome 인기 확장 프로그램이자 대규모 사용자를 가진 이중 언어 읽기 도구로 설명한다. 공식 문서는 주요 기능을 웹페이지 본문 인식 번역, 입력창 번역, 문서 번역, 호버 번역, 주요 사이트 최적화, 모바일 지원, 다수 번역 서비스 지원으로 묶는다.

첨부 reference의 중국어 popup은 이번 v1에서 구현하지 않는 anti-reference다. 오른쪽 floating tooltip 구조만 참고하고, 실제 사용자-facing copy는 한국어로 둔다.

제품의 중심 모델은 다음과 같다.

- 원문과 레이아웃을 보존한다.
- 원문 옆이나 가까운 위치에 번역문을 추가한다.
- 이중 언어 대조 읽기를 기본 경험으로 둔다.
- 사용자가 현재 탐색 맥락을 벗어나지 않고 번역 서비스, 대상 언어, 표시 모드를 바꿀 수 있게 한다.
- 하나의 확장 아이덴티티 안에서 웹, 영상, 문서, 이미지, 입력창, 선택 텍스트를 다룬다.

## 핵심 제품 표면

### 1. 웹페이지 번역

웹페이지 번역이 1순위 표면이다. 사용자는 확장을 설치하고 고정한 뒤 외국어 페이지에서 확장 아이콘, 페이지 측면 바로가기, 컨텍스트 메뉴, 단축키로 번역을 실행한다. 기본값은 읽기 흐름을 해치지 않도록 주요 본문을 번역하는 것이고, 사이드바나 내비게이션까지 필요한 경우 전체 페이지 번역을 별도로 선택한다.

필수 개념:

- 현재 페이지 번역이 첫 번째 CTA다.
- 이중 언어 대조 모드와 번역문만 보기 모드가 있어야 한다.
- 주요 본문 번역이 기본이다.
- 전체 페이지 번역은 명시적인 보조 모드다.
- 확장 팝업뿐 아니라 페이지 안 플로팅 버튼, 우클릭, 단축키가 진입점이다.
- 지원이 약한 사이트에 대한 규칙, 리포트, fallback 흐름이 필요하다.

### 2. 영상 자막

영상은 부가 기능이 아니라 큰 제품 축이다. 프로덕션은 YouTube, Netflix 등 주요 영상 플랫폼에서 원문 자막과 번역 자막을 함께 보여주는 경험을 제공하고, 다수 플랫폼 지원을 전면에 둔다. 자막이 없는 영상에 대한 AI 자막 생성, 자막 편집/다운로드, 자막 스타일 설정도 제품 영역에 포함된다.

필수 개념:

- 영상 페이지를 감지하고 자막 액션을 맥락적으로 노출한다.
- 이중 언어 자막 사용 여부는 지속 설정이다.
- 원문 자막을 없애는 대신 번역 자막을 함께 보여준다.
- 실시간 자막 번역과 회의 자막 번역 시나리오까지 고려한다.
- 자막 스타일과 자막 사용 가능 상태를 UI 상태로 다룬다.

### 3. 문서, PDF, ePub

문서 번역은 중요하지만 여러 표면 중 하나다. 표준 비스캔 PDF는 무료 흐름에서 다루고, 스캔 PDF, 수식, 문단 단위 이중 언어 대조처럼 어려운 케이스는 PDF Pro로 구분된다. 로컬 파일은 확장 메뉴의 추가 액션이나 업로드 흐름을 통해 진입한다.

필수 개념:

- 문서 도구는 보조 진입점에 있어야 하며, 웹페이지 번역보다 앞에 오면 안 된다.
- PDF/ePub 흐름은 구조 보존과 이중 언어 대조를 중심으로 설계한다.
- 표준 PDF, 스캔 PDF, 수식 많은 PDF, eBook 읽기, 이중 언어 ePub 생성은 서로 다른 의도다.

### 4. 텍스트, 선택 영역, 입력창, 호버 번역

프로덕션에는 전체 페이지 번역 외의 빠른 번역 상호작용이 있다.

- 선택한 문장이나 긴 텍스트를 번역한다.
- 호버 번역을 켠 뒤 문단에 마우스를 올리고 modifier 키로 번역을 본다.
- 입력창에서 반복 공백 입력이나 단축키로 작성 중인 텍스트를 번역한다.
- `/ja`, `/fr` 같은 언어 명령으로 대상 언어를 빠르게 지정한다.

필수 개념:

- 이 기능들은 별도 대시보드가 아니라 빠른 맥락 기능이다.
- 입력창 번역은 읽기 기능이 아니라 작성 보조 기능이다.
- 호버 번역은 기본 비활성이고 사용자가 의도적으로 켠다.

### 5. 이미지와 만화 번역

이미지 번역은 OCR을 사용하고 시각적 맥락을 유지하려고 한다. 공식 문서는 브라우저 내 OCR의 제약과 Pro/server OCR 지원을 구분한다. 만화 번역은 지원 사이트에서 빠른 진입점을 제공하는 Pro 성격의 기능으로 다뤄진다.

필수 개념:

- 이미지 번역은 이미지 우클릭 메뉴와 빠른 액션에 붙어야 한다.
- OCR 가능 여부는 브라우저, 언어, 제품 tier에 따라 달라진다.
- 단순 텍스트 추출보다 시각적 배치 보존이 중요하다.

### 6. 번역 엔진

프로덕션은 다중 엔진 제품이다. 공식 페이지와 문서는 DeepL, OpenAI, Gemini, Google, Microsoft 등 여러 서비스를 언급한다. 따라서 사용자는 번역 품질 차이를 번역 서비스 선택과 연결해서 이해한다.

필수 개념:

- 번역 서비스 선택은 핵심 설정이다.
- API key나 계정이 필요한 서비스는 설정 화면에 둔다.
- 로컬 LibreTranslate는 고급 provider 중 하나일 수 있지만 제품의 정체성이 아니다.
- 번역 품질, 실패, 디버그 상태는 현재 provider 이름과 함께 설명해야 한다.

### 7. 개인정보와 신뢰

공식 홈페이지는 번역 내용을 저장하지 않고, 제품이 AI 학습에 사용하지 않으며, 전송을 암호화한다는 점을 신뢰 요소로 내세운다. 이후 UI도 어떤 텍스트가 어디로 전송되는지 모호하게 만들면 안 된다.

필수 개념:

- provider별 개인정보 동작을 설정에서 명확히 설명한다.
- 확장 자체의 동작과 제3자 번역 엔진의 동작을 구분한다.
- 개인정보 문구는 선택된 provider에서 실제로 참인 내용만 말해야 한다.

### 8. 플랫폼

프로덕션은 브라우저 확장과 모바일/태블릿 클라이언트를 모두 다룬다. 공식 홈페이지는 Chrome, Edge, Firefox, Safari, Tampermonkey, zip 설치와 iOS, Android, Google Play, Edge 모바일 브라우저 진입점을 보여준다.

필수 개념:

- 이 repo의 구현 대상은 우선 브라우저 확장이다.
- 그래도 설정, 문서, 향후 표면은 모바일 제품 사고를 배제하지 않는다.
- 플랫폼별 제약은 숨기지 말고 명시한다.

## 프로덕션 UI 모델

이번 v1에서 프로덕션 모델을 이해할 때 가장 중요한 결정은 popup/settings 창이 아니라 페이지 오른쪽 floating toggle이 주 조작면이라는 점이다. 공식 제품은 확장 아이콘, 페이지 측면 바로가기, shortcut icon, 컨텍스트 메뉴 등 여러 진입점을 제공하지만, 현재 `apps/immersive-translate`의 수용 기준은 오른쪽 floating toggle을 먼저 구현하고 popup은 최소 상태판으로 낮추는 것이다.

페이지 안 UI의 주 책임:

- 번역 가능한 페이지에 오른쪽 floating toggle을 자동 주입한다.
- idle tooltip과 접근성 이름은 정확히 `페이지 번역 켜기`여야 한다.
- 첫 클릭은 현재 웹페이지의 smart content 번역을 시작한다.
- 번역 완료 후 클릭은 원문/번역 표시를 토글한다.
- 최소 44px 아이콘 버튼과 활성 상태 점만 제공한다.
- 번역문을 원문 가까이에 유지하고, 웹페이지 번역 block과 영상 자막 block의 DOM/test selector/style을 분리한다.

팝업의 주 책임:

- 현재 페이지 상태를 보여준다.
- floating toggle을 사용하라는 짧은 안내를 제공한다.
- provider가 Default Docker로 켜져 있는지 표시한다.
- 대상 언어 selector, provider selector, raw endpoint input, 문서 업로드, More menu, provider settings form은 v1 popup에 노출하지 않는다.

영상 UI의 주 책임:

- 영상 페이지를 감지하면 popup 클릭 없이 자막 번역을 자동 시작한다.
- 자막 overlay는 어두운 반투명 block 안에 원문 1줄과 번역 1줄을 함께 보여준다.
- 원문 자막을 제거하지 않고 번역 자막을 아래에 stack한다.
- selector는 `caption-original-line`, `caption-translated-line`, `video-auto-subtitle-status`로 검증한다.

설정의 주 책임은 후속 버전으로 미룬다. Default Docker provider는 설정 UI 없이 `http://127.0.0.1:5000/translate`, source `auto`, target `ko-en`으로 기본 활성화되어야 한다.

## 초기 이관 상태에서의 불일치

이 섹션은 2026-07-06 KST 프로덕션 정렬 작업을 시작하기 전의 기준 상태를 기록한다. 당시 `apps/immersive-translate`는 이관된 기술 기반으로는 유용했지만, 프로덕션 제품 모델과는 달랐다.

관찰된 초기 구현:

- `src/entrypoints/popup/App.tsx`는 `ActiveTabTranslationPanel`만 렌더링한다.
- 사용되지 않는 `DocumentTranslationPanel`과 DOCX/EPUB 파서가 소스와 dependency에 남아 있었다.
- `ActiveTabTranslationPanel`은 active-tab bridge, install bridge, smoke translation 같은 개발/QA 용어를 노출한다.
- 로컬 provider 설정이 주요 사용자 여정처럼 보인다.
- 현재 페이지 번역 command center가 없다.
- 번역 서비스, 대상 언어, 표시 모드, 페이지 플로팅 컨트롤이 중심 모델로 잡혀 있지 않다.
- 사용되지 않는 문서 번역 코드가 실제 제품 범위를 불명확하게 만들었다.
- 영상 자막, 호버 번역, 입력창 번역, 이미지 번역, provider 개인정보, 사이트별 모드는 1급 제품 개념으로 나타나지 않는다.

즉, 초기 UI는 프로덕션 Immersive Translate에 가까운 사용자 제품이라기보다 로컬 QA/dev 유틸리티에 가까웠다.

## 2026-07-06 구현 후 제품 정렬 상태

이번 정렬 작업 후 `apps/immersive-translate`는 최소 제품 모델을 다음처럼 잡는다.

- 팝업 첫 화면은 command center가 아니라 `Minimal Status`다.
- 대상 언어, 번역 서비스, raw endpoint, More menu, PDF/ePub/document entry, provider settings form은 popup에서 제거한다.
- Default Docker provider는 기본 활성화되어 별도 UI 설정 없이 동작한다.
- 일반 웹페이지 번역은 오른쪽 `data-testid="floating-translate-control"` 클릭으로 시작한다.
- floating control은 열린 Shadow DOM 내부의 44px Astryx `IconButton`이며 `페이지 번역 켜기` tooltip과 접근성 이름을 제공한다.
- host 문서의 `data-theme`, CSS 변수와 전역 스타일은 변경하지 않는다.
- 일반 웹페이지 번역은 원문 block 아래 또는 heading 옆에 번역 block을 붙이는 이중 언어 읽기를 기본으로 한다.
- 영상 문맥에서는 provider enabled 상태이면 popup 클릭 없이 `run-caption-translation`을 자동 실행한다.
- 영상 overlay는 `data-testid="caption-original-line"`, `data-testid="caption-translated-line"`, `data-testid="video-auto-subtitle-status"`로 검증한다.
- 사용자-facing UI copy는 한국어 중심이다. 참고 이미지에 중국어 UI가 있더라도 실제 UI copy에 중국어 문구를 넣지 않는다.
- 사용자-facing popup/document UI에서 `active-tab bridge`, `install bridge`, `smoke translation` 같은 개발/QA 중심 문구를 제거한다.
- manifest host permission은 Go 공식문서와 YouTube 실사이트 QA를 위해 `https://go.dev/*`, `https://www.youtube.com/*`, `https://youtube.com/*`, `https://m.youtube.com/*`를 포함한다.

실제 검증 기준:

- 실제 Go 공식문서: `https://go.dev/doc/effective_go`는 오른쪽 floating toggle 클릭으로 실제 네트워크 페이지 번역을 검증한다.
- 실제 YouTube: popup fallback을 성공으로 보지 않는다. 실제 watch page에서는 자동 자막 번역을 시도하고, 접근 가능한 YouTube transcript/player caption cue에서 온 원문과 Docker 한국어 번역 overlay가 모두 보여야 한다.
- `IroPQ150F6c` hard gate는 2026-07-06 KST 기준 통과했다. YouTube가 반환하는 `timedtext` payload가 비어 있어도 새 transcript DOM인 `transcript-segment-view-model`을 읽어 영상 위 이중 자막으로 렌더링해야 한다.
- YouTube형 이중 언어 자막 UI와 Docker provider 기반 자막 번역은 local fixture에서도 별도로 검증한다. 실제 YouTube caption end-to-end는 YouTube DOM/API 변경, 로그인/비headless 브라우저, 접근 가능한 transcript source 제약을 그대로 드러낸다.

## 다음 구현을 위한 메모리 규칙

다음 규칙은 이후 명시적인 제품 결정이 바뀌기 전까지 기본값으로 둔다.

1. 앱을 "LibreTranslate frontend"로 모델링하지 않는다.
2. v1 첫 조작면은 popup이 아니라 오른쪽 floating toggle이다.
3. popup은 minimal status만 제공한다.
4. 로컬 번역은 Default Docker provider로 기본 활성화한다.
5. 문서 업로드는 v1 primary UX에서 제외한다.
6. 이중 언어 대조가 핵심 상호작용이다.
7. 사용자가 번역문만 보기 모드를 고르기 전에는 원문을 유지한다.
8. 주요 본문 번역이 기본이고 전체 페이지 번역은 보조다.
9. 페이지 안 플로팅 컨트롤은 장식이 아니라 핵심 기능이다.
10. `페이지 번역 켜기` tooltip 문구는 정확히 유지한다.
11. 사용자-facing UI에 중국어 문구를 넣지 않는다.
12. bridge, smoke translation 같은 개발/QA 용어는 사용자 UI에 노출하지 않는다.
13. 개인정보 문구는 선택된 번역 provider의 실제 동작과 맞아야 한다.
14. 공식 제품의 독점 시각 자산, private API, 정확한 브랜드 구현을 복제하지 않는다. 이 문서는 행동과 정보 구조 참고용이다.

## 권장 다음 제품 형태

### Popup v1

팝업은 최소 상태판으로 둔다.

- Header: 제품명과 provider 상태.
- Status: 현재 페이지 상태, 영상 자막 상태.
- Guidance: 페이지 오른쪽 번역 버튼 안내.
- Excluded: 대상 언어 selector, 번역 서비스 selector, raw endpoint input, PDF/ePub/document entry, More menu, provider settings form.

### In-page floating control v1

페이지 overlay는 다음을 제공한다.

- 오른쪽 자동 주입.
- idle tooltip `페이지 번역 켜기`.
- 첫 클릭 번역 시작.
- 번역 완료 후 클릭 원문/번역 토글.
- Astryx 상태 점과 retry/error 상태.
- 열린 Shadow DOM의 단일 React root와 host 스타일 격리.

### Settings v1

설정은 일반 제품 설정과 provider plumbing을 분리한다.

- 번역 서비스 목록.
- API key/account.
- 로컬 LibreTranslate endpoint.
- 기본 대상 언어.
- 기본 표시 모드.
- 단축키.
- 사이트 규칙.
- 개인정보/provider 설명.
- 개발자 진단.

### QA 시나리오

앞으로 QA는 로컬 endpoint 연결성만 보지 말고 제품 동작을 검증해야 한다.

- 일반 article page에서 팝업 첫 액션이 현재 페이지 번역인지 확인한다.
- 이중 언어 모드에서 원문과 번역문이 함께 보이는지 확인한다.
- 번역문만 보기 모드에서 원문이 숨겨지거나 낮은 우선순위가 되는지 확인한다.
- 주요 본문 번역과 전체 페이지 번역이 별도 액션인지 확인한다.
- 서비스와 대상 언어가 팝업 재오픈 후에도 유지되는지 확인한다.
- 로컬 LibreTranslate가 설정에서 provider로 추가되고 선택될 수 있는지 확인한다.
- 영상 페이지에서 자막 컨트롤이 노출되는지 확인한다.
- 호버 번역이 enable 후 문서화된 modifier 동작으로 실행되는지 확인한다.
- 지원 입력창에서 입력창 번역이 실행되는지 확인한다.
- PDF/document 진입점이 존재하되 첫 화면을 지배하지 않는지 확인한다.
- 사용자 UI에 bridge, smoke-test, developer label이 없는지 확인한다.

## 열린 제품 질문

- 이 앱은 `Tobi Immersive Translate` 표시명을 유지할 것인가, 아니면 내부/중립 이름으로 갈 것인가?
- 첫 production-like iteration에서 필수 번역 provider는 무엇인가?
- UI는 한국어 우선인가, 브라우저 locale 기반인가?
- 공식 Pro 기능은 unavailable state로 보여줄 것인가, 생략할 것인가, 로컬 대체 기능으로 구현할 것인가?
- 각 provider별로 정확히 어떤 개인정보 문구가 참인가?
