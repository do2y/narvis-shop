# 프론트엔드 Next.js 전환 — 배포 인수인계

> 대상: 배포 담당자
> 작성: 2026-07-29 · 프론트엔드 담당
> **현재 상태: 코드·검증 완료, 배포 스위치는 꺼져 있음. 지금 푸시해도 기존 Vite 앱이 그대로 배포됨**

---

## 1. 한 줄 요약

프론트엔드를 Vite(CSR) → **Next.js(SSR)** 로 전환합니다.
**nginx는 그대로 두고**(층2 LB · `/internal` 차단), 그 뒤에 Next SSR 서버를 추가합니다.

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

### ① 컨테이너 구성: nginx 유지 + Next 추가

**nginx는 그대로 있습니다.** 아키텍처 문서(03 D-분산4)의 "앱 티어 A = nginx+next+spring" 구조와 `/internal` 3중 방어 ①을 유지합니다.

```
ALB → nginx(80) ─ /api/**, /.well-known/**, /actuator/** → spring:8080
                 ─ /internal/**                          → 404 차단
                 ─ /_next/static/**, 그 외               → next:3000 (SSR)
```

| | 기존 | 변경 후 |
|---|---|---|
| 베이스 이미지 | `nginx:1.27-alpine` | `node:20-alpine` + `apk add nginx` |
| 프로세스 | nginx 1개 | **nginx + node 2개** (entrypoint가 관리) |
| 외부 포트 | 80 (nginx) | **80 (nginx, 동일)** |
| Next 포트 | — | 3000, **`127.0.0.1`만 바인딩** (외부 노출 없음) |
| 정적 파일 | nginx가 직접 서빙 | Next가 서빙(`/_next/static`), nginx는 프록시 |

**포트가 그대로라 ALB 타깃그룹·보안그룹 변경이 없습니다.**

**두 프로세스 관리**: `docker-entrypoint.sh`가 Next를 먼저 띄우고 준비되면 nginx를 올립니다. 둘 중 하나라도 죽으면 컨테이너를 내려 `--restart always`가 통째로 재기동합니다(부분 장애 상태로 남지 않게).

### ② nginx.conf 변경점

경로 규칙은 **기존과 동일**하고, 정적 서빙 대신 Next로 프록시하는 것만 다릅니다.

| 경로 | 기존 | 변경 후 |
|---|---|---|
| `/api/`, `/.well-known/`, `/actuator/` | → `127.0.0.1:8080` | **동일** |
| `/internal/` | (프록시했음) | **404 차단** ← 3중 방어 ① 강화 |
| `/healthz` | nginx `return 200` | → Next `/healthz` (앱까지 살아야 200) |
| `/assets/` 정적 | nginx 직접 서빙 | `/_next/static/` → Next 프록시 |
| `/` (SPA fallback) | `try_files → index.html` | → Next (SSR) |

보안 헤더는 **Next(`next.config.ts`)가 붙입니다** — nginx에서도 붙이면 응답에 중복으로 실려서, 로컬(nginx 없음)에서도 일관되도록 앱 쪽에 두었습니다.

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
# 헬스체크 (nginx → Next 프록시 — 둘 다 살아야 200)
curl -i http://<서버>/healthz          # → 200, "ok"

# SSR 동작 (HTML에 본문이 있어야 함 — 이번 전환의 핵심)
curl -s http://<서버>/products/<상품ID> | grep -o '<title>[^<]*</title>'

# API 프록시 (nginx → spring:8080)
curl -s -o /dev/null -w '%{http_code}\n' http://<서버>/api/categories   # → 200

# ★ JWKS — AI 서버가 챗 티켓 검증에 쓴다. 이게 막히면 챗봇이 401로 죽는다
curl -s -o /dev/null -w '%{http_code}\n' http://<서버>/.well-known/jwks.json  # → 200

# ★ /internal 차단 (3중 방어 ①)
curl -s -o /dev/null -w '%{http_code}\n' http://<서버>/internal/products/changes  # → 404

# 보안 헤더 (각 1개씩만 — 중복이면 nginx/Next 양쪽에서 붙는 것)
curl -sI http://<서버>/ | grep -icE 'x-frame|x-content|referrer|permissions'  # → 4
```

브라우저에서는 **상품 상세 페이지 소스 보기**로 상품명·가격이 HTML에 들어있는지 확인하면 SSR이 동작하는 것입니다.

**컨테이너 안 프로세스 확인** (nginx·node 둘 다 떠 있어야 함):
```bash
docker exec jarvis-frontend ps -o pid,comm
```

---

## 8. 알려진 차이·주의

- **메모리·CPU 사용량이 늘어납니다.** 매 요청 SSR을 돌리기 때문입니다. 현재 트래픽 규모에서는 인스턴스 상향이 필요 없을 것으로 보지만, 배포 후 모니터링 부탁드립니다.
- **기동이 느립니다.** Next SSR 부팅에 수 초 걸리고, 그 뒤에 nginx가 올라옵니다. 헬스체크 대기를 60초로 늘린 이유입니다.
- **`--network host`라 Next가 호스트의 3000 포트를 씁니다.** `127.0.0.1`에만 바인딩해 외부 노출은 없지만, EC2에서 3000을 쓰는 다른 프로세스가 있으면 충돌합니다(현재는 없음을 확인).
- **컨테이너 이름·재시작 정책·네트워크 모드는 그대로**입니다(`jarvis-frontend`, `--restart always`, `--network host`).
- **한 컨테이너에 두 프로세스**가 돕니다. Docker 모범사례(컨테이너당 1프로세스)와는 다르지만, 아키텍처 문서의 "앱 티어 A = nginx+next+spring" 구조를 따른 것입니다.

---

## 9. 참고 문서

- `docs/nextjs-migration.md` — 전체 마이그레이션 계획·단계별 결과
- `docs/nextjs-migration-qa.md` — 브라우저 검증 시나리오·결과(전 항목 통과, 버그 5건 수정)
- `jarvis-web-next/Dockerfile` — 새 컨테이너 정의
- `jarvis-web-next/CLAUDE.md` — 아키텍처 결정 사항

문의사항은 프론트엔드 담당자에게 주세요.
