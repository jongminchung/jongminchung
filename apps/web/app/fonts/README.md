# Pretendard web fonts

- `PretendardStdVariable.woff2`는 locale 없는 fixture용 Latin·Greek·Cyrillic 가변 폰트임
- `public/fonts/pretendard-variable/dynamic-subset.css`는 영어·한국어 route가 필요한 glyph 조각만 요청하게 함
- 같은 public 디렉터리의 92개 WOFF2는 Pretendard `v1.3.9` 공식 dynamic subset임
- 모든 파일은 same-origin으로 self-host함
- 원본 경로와 integrity 계약은 `apps/web/font-assets.json`이 소유함
- 라이선스는 같은 디렉터리의 `LICENSE.txt`를 따름
