# Home 유지보수

Home은 개인 소개와 **Tech·Invest 두 공간**을 연결한다. 한영 전환, 테마, 키보드 탐색을
지원하며, 소개·목적지·최근 글은 서버에서 렌더링한다.

| 바꾸려는 것                               | 수정 위치                            |
| ----------------------------------------- | ------------------------------------ |
| 소개, 메뉴, 목적지, 작업 원칙의 한영 문구 | `apps/web/lib/home/content.ts`       |
| header·footer와 외부 링크                 | `_components/HomeShell.tsx`          |
| 첫 화면                                   | `_components/HomeHeroSection.tsx`    |
| Tech·Invest 카드                          | `_components/HomeWorkSection.tsx`    |
| 최근 글 표시                              | `_components/HomeWritingSection.tsx` |
| 간격, 반응형 배치, 타이포그래피           | `home.css`                           |
| 공유 이미지                               | `home/og/route.tsx`                  |

최근 글은 각 사이트의 공개 콘텐츠에서 세 편씩 가져온다. 제목이나 날짜를 Home에
복제하지 않는다. 목적지 URL은 공용 `siteOrigins`를 사용하며 현재 언어를 유지한다.
색상과 폰트는 공용 semantic token을 사용하고, Home의 CSS class에는 `home-`를 붙인다.

저장소 루트에서 확인한다.

```sh
bun run --filter @jongminchung/web dev:home
bun run --filter @jongminchung/web typecheck
bun run --filter @jongminchung/web test:e2e --project=home-chromium --workers=2
```

화면을 의도적으로 바꾼 경우에만 실제 한영·모바일·테마 화면을 검토한 뒤 Home의
Playwright 기준 이미지를 갱신한다.
