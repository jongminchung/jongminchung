# Web 배포 계약

- 하나의 컨테이너가 `jamie.kr`, `tech.jamie.kr`, `invest.jamie.kr`의 원래 `Host` 헤더를 받음
- Ingress는 원래 `Host`를 보존하며 애플리케이션은 `Forwarded`와 `X-Forwarded-Host`를 라우팅 입력으로 사용하지 않음
- `/ko`와 `/en` 응답은 URL과 일치하는 `Content-Language`를 제공함
- Kubernetes Ingress·Service·Deployment는 인프라 저장소에서 관리함
- 컨테이너는 비루트 사용자로 `0.0.0.0:3000`에서 standalone 서버를 실행함
- readiness와 liveness probe는 Host에 의존하지 않는 `GET /healthz`를 사용함
- 로컬 이미지는 저장소 루트 컨텍스트와 `apps/web/docker/Dockerfile`로 생성함

```sh
docker build -f apps/web/docker/Dockerfile -t jamie-web .
docker run --rm -p 3000:3000 jamie-web
curl --fail http://127.0.0.1:3000/healthz
curl --fail -H 'Host: jamie.kr' http://127.0.0.1:3000/ko
curl --fail -H 'Host: tech.jamie.kr' http://127.0.0.1:3000/ko
curl --fail -H 'Host: invest.jamie.kr' http://127.0.0.1:3000/ko
```
