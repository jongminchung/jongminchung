# YouTube caption hard gate research

조사일: 2026-07-06 KST

이 문서는 실제 YouTube hard gate에서 `YouTube caption payload is empty.`로 실패한 원인, 외부 레퍼런스, Immersive Translate가 어떻게 처리했을 가능성이 높은지에 대한 리버스 엔지니어링 메모리다.

## 결론

현재 구현의 실패는 단순 UI 문제가 아니라 YouTube caption 공급 경로를 하나로 가정한 데서 생긴다. 실제 YouTube는 같은 영상에서도 환경, 쿠키, client context, bot detection, player state, caption UI state에 따라 다음 결과가 달라진다.

- `captionTracks.baseUrl + fmt=json3`가 정상 JSON3를 반환한다.
- 같은 URL이 HTTP 200이지만 빈 본문을 반환한다.
- transcript panel token은 보이지만 `/youtubei/v1/get_transcript`가 `Precondition check failed`를 반환한다.
- player에 `.ytp-caption-segment` DOM이 렌더링될 때만 실시간 caption observer가 동작한다.
- 공식 YouTube Data API는 임의 공개 영상의 caption text를 가져오는 범용 해결책이 아니다.

따라서 실제 hard gate를 통과하려면 `timedtext` 단일 경로가 아니라 계층형 caption collector가 필요하다.

1. YouTube player caption DOM observer.
2. `ytInitialPlayerResponse.captionTracks` 기반 timedtext fetch.
3. `ytInitialData`의 `getTranscriptEndpoint.params` 기반 Innertube transcript fetch.
4. 사용자가 caption을 켜야 하는 상태를 명확히 표시.
5. 자막이 없거나 YouTube가 막는 경우 AI subtitle generation/STT fallback.

## 레퍼런스 요약

### Immersive Translate 공식 문서

공식 video subtitle 문서는 사용자가 영상 페이지에서 Immersive Translation panel을 열고 `[Auto Enable Bilingual Subtitles]`를 선택하면 활성화된다고 설명한다. 설정이 적용되지 않으면 페이지 새로고침이 필요하다고도 안내한다.

해석:

- 프로덕션도 완전히 무조건적인 caption fetch를 보장한다고 보기 어렵다.
- “auto enable”은 extension 내부 상태를 켠 뒤 페이지/플랫폼 자막 상태에 맞춰 자동 렌더링한다는 의미에 가깝다.
- 새로고침 안내는 content script 초기화, YouTube SPA 상태, caption track availability가 흔들릴 수 있음을 암시한다.

Source: https://immersivetranslate.com/en/docs/features/video-subtitles/

### Immersive Translate GitHub repo

현재 `immersive-translate/immersive-translate` repo는 release 및 issue 추적용이며, 현행 제품 소스 코드는 공개되어 있지 않다고 명시한다. 과거 `old-immersive-translate`는 2023-01-16에 archive되었고, 현재 제품의 YouTube subtitle 구현을 직접 보여주지 않는다.

해석:

- 현재 제품의 정확한 구현을 소스 수준으로 검증할 수 없다.
- reverse engineering은 공식 문서, issue, runtime behavior, 유사 오픈소스 구현을 통해 추정해야 한다.

Source: https://github.com/immersive-translate/immersive-translate

### YouTube captionTracks / timedtext

여러 구현체가 `ytInitialPlayerResponse.captions.playerCaptionsTracklistRenderer.captionTracks[*].baseUrl`에 `fmt=json3`를 붙여 caption events를 가져온다. JSON3는 `events[*].tStartMs`, `dDurationMs`, `segs[*].utf8` 구조를 제공한다.

하지만 실제 hard gate에서 관찰한 것처럼 HTTP 200 + 빈 payload가 나올 수 있다. Google Issue Tracker와 커뮤니티 자료도 timedtext가 빈 본문을 반환하는 문제를 오래된 불안정성으로 다룬다.

Source:

- https://www.nadimtuhin.com/blog/ytranscript-how-it-works
- https://stackoverflow.com/questions/69937867/google-video-no-longer-able-to-retrieve-captions

### Innertube transcript endpoint

YouTube web은 내부 Innertube API를 사용한다. transcript 계열 구현은 보통 다음 정보를 조합한다.

- `INNERTUBE_API_KEY`
- `INNERTUBE_CONTEXT`
- watch page HTML 또는 `ytInitialData` 안의 `getTranscriptEndpoint.params`
- `POST /youtubei/v1/get_transcript`

이번 조사에서 실제 Andrew Kelley 영상 `IroPQ150F6c`의 `ytInitialData`에 `getTranscriptEndpoint.params`가 존재하는 것을 확인했다. 하지만 같은 headless context에서 직접 POST하면 `400 Precondition check failed`가 발생했다.

해석:

- token 존재만으로 hard pass가 아니다.
- YouTube가 client context, visitor data, UI command state, request headers, account/cookie state, bot detection 중 일부를 precondition으로 요구할 수 있다.
- transcript endpoint는 유용한 fallback이지만 extension-only deterministic gate로 믿으면 안 된다.

Source:

- https://www.nadimtuhin.com/blog/ytranscript-how-it-works
- https://scrapecreators.com/blog/youtube-video-transcripts-guide
- https://github.com/steipete/summarize/blob/main/docs/youtube.md

### 공식 YouTube Data API

공식 Captions API는 caption resource를 제공하지만, 실제 caption download는 YouTube API 권한 모델 안에 있다. 문서상 caption resource는 특정 video caption track이고, list/download 메서드는 OAuth/권한/소유자 관계의 제약을 받는다. 임의 공개 YouTube 영상의 자막을 extension에서 바로 가져오는 해결책으로 보기 어렵다.

Source: https://developers.google.com/youtube/v3/docs/captions

### 유사 오픈소스 YouTube subtitle translator

`orange2ai/youtube-subtitle-translator`는 timedtext를 직접 호출하지 않고 YouTube player DOM을 관찰한다.

- `.ytp-caption-window-container`를 찾는다.
- `MutationObserver`로 caption DOM 변화를 감시한다.
- `.ytp-caption-segment`의 현재 텍스트를 번역한다.
- 별도 overlay를 player에 붙인다.
- README도 사용자가 YouTube CC를 켜야 한다고 안내한다.

해석:

- browser extension에서 가장 안정적인 real-time 방식은 “YouTube가 이미 렌더링한 자막 DOM을 읽는 것”이다.
- 단점은 미래 cue 전체를 미리 알 수 없고, YouTube 자막이 실제로 켜져 있어야 한다.

Source: https://github.com/orange2ai/youtube-subtitle-translator

## 이번 hard gate 관찰

대상 영상:

- 기본 테스트 영상: `https://www.youtube.com/watch?v=YS4e4q9oBaU`
- 사용자 스크린샷 기준 영상: `https://www.youtube.com/watch?v=IroPQ150F6c`

관찰:

- YouTube watch page는 정상 렌더링된다.
- extension overlay는 자동 주입된다.
- `ytInitialPlayerResponse`에는 caption track metadata가 있다.
- timedtext fetch 결과가 HTTP 200이지만 빈 본문이다.
- `ytInitialData`에는 `getTranscriptEndpoint.params`가 있다.
- 직접 `POST /youtubei/v1/get_transcript`는 `Precondition check failed`를 반환한다.
- transcript 표시 버튼은 DOM에 보이며, YouTube의 새 transcript panel은 `transcript-segment-view-model` row를 렌더링한다.
- 기존 구현은 과거 `ytd-transcript-segment-renderer` 계열 selector만 읽어서 실제 row를 놓쳤고, 이 때문에 `YouTube caption payload is empty.`로 실패했다.
- 2026-07-06 KST 수정 후 `IroPQ150F6c` actual YouTube hard gate는 popup이나 page translation fallback 없이 통과했다. 증거 이미지는 `test-results/qa-evidence/screenshots/production-alignment/real-youtube-auto-subtitle-translation.png`다.

## Immersive Translate는 어떻게 했을 가능성이 높은가

현행 제품 소스가 비공개이므로 확정이 아니라 추정이다.

가능성이 높은 구조:

1. 사이트별 adapter registry를 가진다.
   - YouTube, Netflix, Coursera, Udemy 같은 플랫폼별로 caption source가 다르다.
   - 공식 제품이 60개 이상 플랫폼을 말하는 점을 보면 generic `<track>`만 보는 구조로는 부족하다.

2. YouTube에서는 caption DOM과 platform metadata를 함께 쓴다.
   - player DOM caption은 real-time overlay에 가장 잘 맞는다.
   - captionTracks/timedtext는 미리 cue list를 만들 수 있지만 비어 있거나 막힐 수 있다.
   - transcript endpoint는 전체 transcript를 얻는 fallback이나 export/edit 기능에 적합하다.

3. 실패를 UX 상태로 다룬다.
   - 공식 문서의 “안 되면 refresh” 안내는 YouTube SPA state와 adapter initialization이 흔들릴 수 있음을 보여준다.
   - caption unavailable, auto-generated unavailable, refresh needed 같은 상태가 있을 가능성이 높다.

4. caption이 없는 영상에는 STT/AI subtitle generation을 둔다.
   - 제품 페이지는 captions/transcripts가 없는 영상도 AI subtitle generation으로 처리한다고 설명한다.
   - 이 기능은 extension-only timedtext fetch가 아니라 audio extraction 또는 backend/native/client STT가 필요하다.

5. translation은 cue 단위 캐시와 batch를 같이 쓸 가능성이 높다.
   - real-time DOM observer는 같은 자막 segment가 반복 렌더링되므로 cache가 필수다.
   - 전체 transcript/timedtext cue list가 있으면 batch translation이 가능하다.

## 권장 구현 전략

### 1. DOM observer를 primary real-time path로 승격

현재 코드는 timedtext/track 수집을 먼저 시도하고, visible caption fallback이 뒤에 있다. 실제 hard gate 관점에서는 순서를 바꿔야 한다.

권장:

- YouTube video context 진입.
- player hover/move로 controls를 깨운다.
- `.ytp-subtitles-button`을 찾고, 꺼져 있으면 클릭한다.
- `video.muted = true` 후 `video.play()` 시도.
- `.ytp-caption-window-container`와 `.ytp-caption-segment`를 `MutationObserver`로 감시한다.
- 새 caption text가 나오면 즉시 번역하고 overlay에 원문/번역 2줄을 렌더링한다.
- 같은 text는 cache hit 처리한다.

장점:

- CORS/timedtext/Innertube precondition을 피한다.
- 실제 사용자가 보는 자막과 sync가 맞다.
- “자동 활성화” UX와 가장 잘 맞는다.

단점:

- YouTube caption이 실제로 켜져 있어야 한다.
- full cue list가 없어서 사전 batch 번역은 어렵다.
- headless autoplay/user gesture 제약이 있을 수 있다.

### 2. timedtext는 prefetch/batch path로 유지

`captionTracks.baseUrl` 경로는 여전히 가치가 있다.

권장:

- `fmt=json3`, `fmt=srv3`, `fmt=vtt` 순서로 시도한다.
- 빈 payload는 fatal error가 아니라 `empty_timedtext_payload` diagnostic으로 저장한다.
- timedtext가 성공하면 cue list를 batch 번역하고 overlay를 video time에 맞춰 렌더링한다.
- 실패하면 DOM observer로 내려간다.

### 3. Innertube transcript fallback 추가

현재 transcript fallback은 DOM click 기반이라 headless에서 rows가 생기지 않는다. 별도 parser를 추가한다.

필요 함수:

- `findGetTranscriptEndpointParams(ytInitialData | pageHtml)`.
- `readYouTubeInnertubeConfig()`:
  - `ytcfg.get("INNERTUBE_API_KEY")`
  - `ytcfg.get("INNERTUBE_CONTEXT")`
  - `ytcfg.get("INNERTUBE_CLIENT_VERSION")`
- `fetchYouTubeTranscript(params, context, apiKey)`.
- `parseTranscriptSegmentRenderer(response)`.

주의:

- `Precondition check failed`는 expected failure로 다룬다.
- 실패 시 retry loop를 무작정 돌리지 않는다.
- 이 경로는 YouTube internal API라 변경 가능성이 크고 ToS 리스크가 있다.

### 4. hard gate를 두 단계로 나눈다

실제 YouTube hard gate는 다음 두 개로 분리해야 한다.

- `actual-youtube-caption-dom-auto`: 실제 player caption DOM을 자동으로 켜고 observer overlay를 렌더링한다.
- `actual-youtube-transcript-prefetch`: timedtext 또는 transcript endpoint로 cue list를 미리 가져온다.

Acceptance:

- product UX hard gate는 DOM auto path로 pass할 수 있다.
- prefetch hard gate는 best-effort로 두되 실패 원인을 metadata에 기록한다.
- page translation fallback은 caption hard gate pass로 인정하지 않는다.

### 5. STT fallback은 Docker scope로 설계

caption source가 전부 실패하면 product-level 해결책은 STT다.

현 repo에는 `DEFAULT_LOCAL_TRANSLATION_SETTINGS.sttEndpoint = http://127.0.0.1:5000/transcribe`가 있으므로, 장기적으로 Docker compose에 STT service를 붙일 수 있다.

권장:

- YouTube audio를 직접 다운로드하는 경로는 extension-only로 구현하지 않는다.
- Docker QA scope에서는 user-provided media fixture 또는 allowed sample audio로 STT path를 검증한다.
- 실제 YouTube audio extraction은 별도 동의/권한/ToS 검토 후 후속 결정으로 둔다.

## 다음 구현 이슈

1. `collectYouTubeVisibleCaptionStream` 구현.
   - `MutationObserver` 기반 current caption stream.
   - 기존 `render-caption-overlay`와 별개로 streaming caption render message 추가.

2. `tryEnableYouTubeCaptions` 보강.
   - player controls wake.
   - CC button click.
   - keyboard `c` fallback.
   - 실패 상태를 `captionState.message`로 노출.

3. `fetchYouTubeTranscriptFromInitialData` 구현.
   - params extractor.
   - Innertube request.
   - transcript segment parser.
   - `precondition_failed` diagnostic.

4. Playwright actual YouTube gate 재설계.
   - target video: `IroPQ150F6c`.
   - wait for player visible.
   - no popup.
   - extension auto enables captions.
   - pass condition: original caption DOM or transcript cue에서 온 원문 + Docker Korean translation overlay.
   - rendered cue의 첫 start time으로 video currentTime을 이동해 영상별 첫 자막 시작 시간이 달라도 active cue를 검증한다.

5. Evidence schema 확장.
   - `captionSource: "visible-dom" | "timedtext-json3" | "timedtext-srv3" | "timedtext-vtt" | "innertube-transcript" | "browser-text-track" | "stt"`.
   - `failureReason`.
   - `youtubeDiagnostics`: timedtext status/body length, transcript endpoint status, visible caption count.

## 현재 repo에 반영해야 할 판단

단기적으로 실제 hard gate 통과 가능성이 가장 높은 것은 timedtext가 아니라 visible caption DOM observer다. Immersive Translate류 제품도 사용자가 보는 player caption을 기준으로 overlay를 맞추는 경로를 반드시 가지고 있을 가능성이 높다.

즉 다음 작업은 “더 강한 timedtext URL 만들기”가 아니라 “YouTube caption을 켜고, 실제 렌더링된 caption DOM stream을 번역하는 path를 1급으로 승격”하는 것이다.
