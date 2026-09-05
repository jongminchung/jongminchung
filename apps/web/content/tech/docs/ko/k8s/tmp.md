- 도메인 없이 http://114.108.153.20/로 nginx 접근에 성공함
- 외부 5개 지역 모두 HTTP 200을 반환하고 nginx access log까지 확인함
- Cilium Gateway·HTTPRoute·Service·nginx 전체 경로가 정상 동작함
- RKE2 차트와 Cilium 실행 버전을 지원되는 1.19.6 조합으로 일치시킴
- Cilium의 특권 포트 직접 수신 문제를 피하기 위해 현재 80 → 8080 임시 리다이렉트를 적용함
- HTTPS 443은 동일한 연결 거부 현상이 남아 있어 다음 단계에서 별도 처리 필요함

## 도메인 없는 접근이 정상 확인됨

- 현재 접근 주소는 아래와 같음

http://114.108.153.20/

- 외부 5개 지역에서 모두 nginx HTTP 200 응답을 확인함
    - 최종 외부 검증 결과 (https://check-host.net/check-report/48b78b33k1cd)
    - 브라질·홍콩·몰도바·네덜란드·러시아 노드에서 모두 성공함

- nginx access log에서 외부 5개 요청이 실제 Pod까지 전달된 것을 확인함

## Gateway 전체 경로가 검증됨

- 요청 경로는 다음과 같음

    114.108.153.20:80
    → ens3
    → 10.25.140.2:8080
    → Cilium Envoy
    → HTTPRoute
    → nginx-smoke Service
    → nginx Pod

- 임시 Gateway 상태는 Programmed=True임
- 임시 HTTPRoute 상태는 Accepted=True, ResolvedRefs=True임
- nginx Deployment와 Cilium 구성요소 상태는 모두 정상임
    - cilium: 4/4
    - cilium-envoy: 4/4
    - cilium-operator: 2/2
    - nginx-smoke: 1/1

## 특권 포트에서만 문제가 재현됨

- Envoy가 직접 수신하는 10.25.140.2:80과 :443은 여전히 Connection refused를 반환함
- 동일한 host-network Gateway를 8080에 생성하면 내부와 외부에서 모두 정상 연결됨
    - 외부 8080 TCP 검증 결과 (https://check-host.net/check-report/48b74d96k12)

- Cilium 문서상 host-network 모드는 모든 인터페이스에 리스너를 노출하며, 특권 포트에는 NET_BIND_SERVICE가 필요함
    - 현재 해당 capability까지 설정되어 있으나 포트 80과 443에서만 수신 문제가 재현됨
    - Cilium Gateway API host-network 문서 (https://docs.cilium.io/en/stable/network/servicemesh/gateway-api/gateway-api/)

## Cilium 버전 불일치를 해소함

- 기존 구성은 RKE2 1.19.6 차트에 Cilium 1.20.0 이미지만 덮어쓴 조합이었음
- 이미지 덮어쓰기를 제거하여 RKE2가 제공하는 다음 버전으로 통일함
    - Cilium agent 1.19.6
    - Cilium Envoy 1.36.9
    - Cilium operator 1.19.6

- 임시로 추가했던 1.20 operator RBAC 호환 리소스도 제거함
- RKE2 공식 패키지 역시 Cilium 1.19.6 차트를 사용함
    - RKE2 Cilium 패키지 정의 (https://github.com/rancher/rke2-charts/blob/main-source/packages/rke2-cilium/package.yaml)

## 현재 테스트 구성은 유지 중임

- 사용자가 직접 확인할 수 있도록 gateway-smoke 네임스페이스와 80 → 8080 규칙을 현재 유지함
- 적용한 테스트 매니페스트는 다음과 같음
    - .gateway-smoke-ip.yaml
    - .gateway-smoke-8080.yaml

- 현재 리다이렉트는 런타임 iptables 규칙이므로 재부팅하면 사라짐

## 결론 및 실행 제안

- 첫 번째 목표인 도메인 없는 공인 IP → Cilium Gateway → nginx 접근은 성공함
- 다음 단계에서는 기존 Gateway의 HTTP·HTTPS 리스너를 비특권 포트 8080·8443으로 운영하고, 80·443 리다이렉트를 영구화하는 구성이 현실적인 해결책임
- 영구 구성 완료 후 임시 gateway-smoke 리소스를 삭제하는 순서가 적절함
