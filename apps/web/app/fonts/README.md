# Pretendard web fonts

- `PretendardStdVariable.woff2`는 locale 없는 fixture용 Latin·Greek·Cyrillic 가변 폰트임
- 영어 route는 `public/fonts/pretendard-latin.woff2`의 Latin·기호·한국어 전환 라벨 subset을 우선함
- 원본의 가변 weight·hinting·layout feature를 유지하며 나머지 글자는 기존 dynamic subset으로 보완함
- 한국어 route는 `public/fonts/pretendard-variable/dynamic-subset.css`와 공식 92개 WOFF2를 유지함
- 같은 origin에서 self-host하며 원본·파생본의 integrity 계약은 `apps/web/font-assets.json`이 소유함
- 라이선스는 같은 디렉터리의 `LICENSE.txt`를 따름

- 파생본의 원본은 공식 Pretendard `v1.3.9` 전체 가변 폰트이며 다운로드 URL·SHA-256은 manifest에 고정함
- 수동 재생성 명령은 원본을 다운로드하고 해시를 확인한 뒤 subset을 생성함

저장소 루트에서 영어 subset을 재생성하는 명령임

```bash
uv run --with 'fonttools[woff]==4.59.0' python apps/web/scripts/subset-latin-font.py
```

- 파생본은 Reserved Font Name 조건에 따라 `Jamie Latin`으로 명명하며 원본 저작권·라이선스 메타데이터를 보존함
- 스크립트는 `font-assets.json`의 byte·SHA-256도 함께 갱신함
- 영문 세 사이트의 decoded budget은 45,000 bytes, HTTP 전송 budget은 46,000 bytes로 설정함
- 화살표와 `한국어` 세 글자도 포함하여 해당 UI 때문에 큰 fallback 조각이 요청되지 않도록 함
