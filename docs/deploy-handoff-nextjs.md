# 프론트엔드 Next.js 전환 — 배포 인수인계

> 대상: 배포 담당자
> 작성: 2026-07-29 · 프론트엔드 담당
> **현재 상태: 코드·검증 완료, 배포 스위치는 꺼져 있음. 지금 푸시해도 기존 Vite 앱이 그대로 배포됨**

---

## 1. 한 줄 요약

프론트엔드를 Vite(CSR) → **Next.js(SSR)** 로 전환합니다.
**정적 파일을 nginx로 서빙하던 컨테이너가 Node 프로세스가 상시 도는 컨테이너로 바뀝니다.**

인프라(EC2·ALB·GHCR·SSH 시크릿)는 **그대로**입니다. 새로 등록할 시크릿도 없습니다.

### ⚠️ 먼저 알아두실 것 — 기존 배포 파일은 수정되지 않았습니다

| 파일 | 상태 |
|---|---|
| `.github/workflows/deploy.yml` | **무수정** — 지금 배포 중인 그 파일 |
| `Dockerfile` (레포 루트) | **무수정** |
| `nginx.conf` | **무수정** |
| `.github/workflows/deploy-next.yml.disabled` | 신규 · **비활성** |
| `jarvis-web-next/Dockerfile` | 신규 (하위 폴더) |
| `.github/workflows/ci.yml` | 잡 1개 추가 (PR 검사용, 배포와 무관) |

**지금 main에 무엇을 푸시해도 기존 Vite 앱이 배포됩니다.**
`.disabled` 확장자라 Actions가 인식하지 않고, 새 Dockerfile은 하위 폴더에 있어 기존 빌드가 참조하지 않습니다.

전환은 **파일 rename 두 번**으로 일어납니다(5장). 기존 파일을 고치는 방식이 아니라
**통째로 교체**하는 방식이라, 롤백도 rename을 되돌리면 끝입니다.

---

## 2. 왜 바꾸나

상품 상세·브랜드 페이지가 검색엔진에 노출되고, 카카오톡·슬랙 공유 시 상품 카드가 뜨게 하기 위함입니다(SEO/OG). 기존 CSR은 HTML이 비어 있어 검색봇이 내용을 읽지 못했습니다.

---

## 3. 새 파일이 기존과 다른 점 — 4가지

> 아래는 **전환했을 때** 달라지는 내용입니다. 지금 기존 파일이 이렇게 수정돼 있다는 뜻이 아닙니다.

### ① 컨테이너 런타임: nginx → Node

| | 기존 | 변경 후 |
|---|---|---|
| 베이스 이미지 | `nginx:1.27-alpine` | `node:20-alpine` |
| 실행 | nginx 정적 서빙 | `node server.js` (Next standalone) |
| 포트 | 80 | **80 (동일)** |
| 실행 사용자 | root | **`node` (비특권)** |
| 이미지 크기 | (nginx-alpine + 정적파일) | **416MB** (로컬 빌드 실측) |

**포트가 그대로라 ALB 타깃그룹·보안그룹 변경이 없습니다.**

80은 특권 포트라 비특권 사용자로는 bind가 안 됩니다. root로 돌리는 대신 `setcap cap_net_bind_service`로 node 바이너리에만 권한을 주고 사용자를 낮췄습니다.

### ② nginx.conf가 사라지고 Next 설정으로 이관

| 기존 nginx.conf | 이관처 |
|---|---|
| 보안 헤더 4종 | `next.config.ts`의 `headers()` |
| `/api/` → `127.0.0.1:8080` 프록시 | `app/api/[...path]/route.ts` (Route Handler) |
| `/healthz` | `app/healthz/route.ts` |
| gzip·정적자산 캐시 | Next 기본 제공 |
| SPA fallback(`try_files`) | 불필요 (App Router가 처리) |

**`nginx.conf` 파일은 더 이상 쓰이지 않습니다.**

### ③ 워크플로 — 신규 파일이지만 기존과 두 줄만 다름

`deploy-next.yml`은 **기존 `deploy.yml`을 복사해 두 줄만 고친 것**입니다.
(기존 파일은 그대로 두고 새로 만들었습니다 — 나머지 주석 차이는 무시하셔도 됩니다)

```diff
  - name: 이미지 빌드 및 푸시
    with:
-     context: .
+     context: jarvis-web-next        # Dockerfile 위치가 하위 폴더

    docker run -d \
      --name jarvis-frontend \
      --restart always \
      --network host \
+     -e API_PROXY_TARGET="http://localhost:8080" \
      ${{ env.IMAGE }}:${{ github.sha }}
```

`API_PROXY_TARGET`이 필요한 이유: Next standalone 서버는 `.env` 파일을 읽지 않아 **런타임 주입이 필수**입니다. 빠뜨리면 코드 기본값으로 동작하지만 의존을 명시해 두었습니다.

### ④ 헬스체크 대기시간 연장

```diff
- for i in $(seq 1 15); do    # 30초
+ for i in $(seq 1 30); do    # 60초
```

nginx는 즉시 뜨지만 **Node SSR 서버는 부팅에 시간이 걸립니다.** 경로(`/healthz`)와 판정 방식은 동일합니다.

---

## 4. ⚠️ 배포 전 확인 부탁드립니다 — 백엔드 네트워크

프록시가 `http://localhost:8080`으로 백엔드를 호출합니다.
프론트 컨테이너는 `--network host`라 이 `localhost`가 **EC2 호스트**를 가리킵니다.

**확인 명령** (EC2에서):
```bash
docker ps --format 'table {{.Names}}\t{{.Ports}}'
```

- 백엔드가 `0.0.0.0:8080->8080/tcp`로 나오면 → **그대로 진행 가능**
- 호스트에 포트 매핑이 없는 bridge 컨테이너라면 → `API_PROXY_TARGET`을 그 컨테이너가
  닿는 주소로 바꿔야 합니다 (워크플로의 `-e API_PROXY_TARGET=` 값만 수정하면 됨)

이게 틀리면 **배포는 성공하는데 API 호출이 전부 실패**합니다. 화면은 뜨는데 데이터가 안 나오는 형태라 눈치채기 어렵습니다.

---

## 5. 전환 절차

```bash
# 1) 워크플로 교체
mv .github/workflows/deploy.yml .github/workflows/deploy.yml.disabled
mv .github/workflows/deploy-next.yml.disabled .github/workflows/deploy-next.yml

# 2) main 머지 후 푸시 → 자동 배포
```

배포 흐름은 **기존과 동일**합니다: 러너에서 이미지 빌드 → GHCR 푸시 → EC2 2대 순차 배포(`max-parallel: 1`) → 헬스체크.

---

## 6. 롤백

**자동**: 1호기 헬스체크 실패 시 `fail-fast: true`로 2호기는 건드리지 않습니다. **최소 한 대는 이전 버전으로 살아 있습니다.**

**수동** (둘 중 빠른 쪽):
```bash
# A. EC2에서 이전 이미지로 즉시 되돌리기 (가장 빠름)
docker stop jarvis-frontend && docker rm -f jarvis-frontend
docker run -d --name jarvis-frontend --restart always --network host \
  ghcr.io/toss-delta-final/jarvis-frontend:076198920d750b158f3bd40edd7ed40463f76fe5

# B. 워크플로 rename 되돌리고 재푸시 → 기존 Vite 앱 재배포
```

**위 해시 `0761989...` = 전환 직전 main의 마지막 커밋(현재 배포 중인 Vite 앱)입니다.**
워크플로가 `github.sha`(40자 전체)로 태그를 달므로 **짧은 해시로는 pull이 안 됩니다.**

EC2에 남아 있는 태그를 직접 확인하려면:
```bash
docker images ghcr.io/toss-delta-final/jarvis-frontend
```
(배포 시 `docker image prune -f`가 돌지만 실행 중이던 이미지는 보통 남아 있습니다)

---

## 7. 배포 후 확인 항목

```bash
# 헬스체크
curl -i http://<서버>/healthz          # → 200, "ok", Content-Type: text/plain

# SSR 동작 (HTML에 본문이 있어야 함 — 이번 전환의 핵심)
curl -s http://<서버>/products/<상품ID> | grep -o '<title>[^<]*</title>'

# API 프록시
curl -s -o /dev/null -w '%{http_code}' http://<서버>/api/categories   # → 200

# 보안 헤더 (nginx에서 이관됨)
curl -sI http://<서버>/ | grep -iE 'x-frame|x-content|referrer|permissions'
```

브라우저에서는 **상품 상세 페이지 소스 보기**로 상품명·가격이 HTML에 들어있는지 확인하면 SSR이 동작하는 것입니다.

---

## 8. 알려진 차이·주의

- **메모리·CPU 사용량이 늘어납니다.** 정적 파일 서빙 → 매 요청 서버 렌더로 바뀌기 때문입니다. 현재 트래픽 규모에서는 인스턴스 상향이 필요 없을 것으로 보지만, 배포 후 모니터링 부탁드립니다.
- **기동이 느립니다.** nginx는 즉시, Node SSR은 수 초 걸립니다. 헬스체크 대기를 60초로 늘린 이유입니다.
- **컨테이너 이름·재시작 정책·네트워크 모드는 그대로**입니다(`jarvis-frontend`, `--restart always`, `--network host`).

---

## 9. 참고 문서

- `docs/nextjs-migration.md` — 전체 마이그레이션 계획·단계별 결과
- `docs/nextjs-migration-qa.md` — 브라우저 검증 시나리오·결과(전 항목 통과, 버그 5건 수정)
- `jarvis-web-next/Dockerfile` — 새 컨테이너 정의
- `jarvis-web-next/CLAUDE.md` — 아키텍처 결정 사항

문의사항은 프론트엔드 담당자에게 주세요.
