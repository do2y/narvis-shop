# 포트폴리오 데모 배포 — 나비스(Narvis)

FE·BE·AI 3개 레포를 **한 호스트에서 무료로** 띄워 공개 링크를 만드는 절차임.

## 형상

```
             인터넷 (HTTPS)
                  │
        Cloudflare Tunnel  ← 인바운드 포트 0개, 인증서 자동
                  │
     ┌────────────┴─────────────┐
     │ narvis.…                 │ ai-narvis.…
     ▼                          ▼
  app-web (nginx+Next)      app-ai (FastAPI)
     │  /api → app-api           │
     ▼                           ▼
  app-api (Spring) ────────► pg-catalog / pg-profile
     │
     ├─ mariadb  ├─ redis  ├─ kafka
```

- **진입점은 app-web 하나뿐임.** 내장 nginx가 `/api`·`/.well-known`·`/actuator`·`/internal`을
  Spring으로, 나머지를 Next(SSR)로 보냄 → 동일 오리진이라 쿠키·CORS 이슈가 없음
- **AI는 별도 서브도메인임.** FE가 SSE를 직접 열기 때문임. 경로(`/ai/`)로 묶지 않은 이유는
  백엔드가 `LLM_SSE_URL` 뒤에 `/chat`·`/seller/chat`을 붙이고 AI 라우터에 prefix가 없어
  rewrite가 추가로 필요해지기 때문임

## 사전 준비

1. **호스트** — Oracle Cloud Always Free(ARM Ampere, 4 vCPU/24GB)를 권장함. 기간 제한이 없고
   이 스택(컨테이너 9개)을 여유롭게 담음
   - ⚠️ **ARM64임.** 세 레포 Dockerfile 모두 아키텍처 고정이 없어 호스트에서 빌드하면 그대로 arm64로 나옴.
     단 `docker build`를 ARM에서 직접 수행해야 함(x86에서 만든 이미지를 옮기면 실행되지 않음)
   - 최소 요구는 2GB이며 4GB 이상을 권장함. JVM·Kafka가 각각 힙을 잡음
2. **Docker + compose v2**
3. **Cloudflare 계정**(무료) + 도메인 하나. Zero Trust → Networks → Tunnels에서 터널을 만들고
   아래 두 호스트명을 라우팅함:

   | 호스트명 | 서비스 |
   |---|---|
   | `narvis.<도메인>` | `http://app-web:80` |
   | `ai-narvis.<도메인>` | `http://app-ai:8000` |

   터널 토큰을 `.env`의 `TUNNEL_TOKEN`에 넣음.

4. **레포 3개를 나란히 배치함** (기본 경로가 이 배치를 가정함):
   ```
   project/
     ├ jarvis-web/      ← 여기서 실행
     ├ jarvis-backend/
     └ jarvis-ai/
   ```

## 배포 절차

```bash
cd jarvis-web/deploy

# 1) 백엔드 스키마·시드를 init 디렉토리로 모음 (순서 고정)
bash scripts/prepare-sql.sh

# 2) 환경변수 — 시크릿 8종은 자동 생성함
cp .env.example .env
bash scripts/gen-secrets.sh >> .env
vi .env          # SITE_URL · AI_PUBLIC_URL · TUNNEL_TOKEN 채움

# 3) 기동 (첫 빌드는 ARM에서 10~20분 걸림)
docker compose up -d --build

# 4) 확인
docker compose ps
docker compose logs -f app-api      # "Started JarvisApplication" 확인
curl -s localhost 2>/dev/null || docker compose exec app-web wget -qO- localhost/healthz
```

### 기동 순서가 중요한 이유

BE는 `ddl-auto: validate`라 **스키마가 없으면 기동을 거부함**. 그래서 1번을 건너뛰면
`app-api`가 재시작을 반복함. MariaDB init 스크립트는 **빈 볼륨 최초 부팅에만** 실행되므로,
스키마를 다시 넣으려면 볼륨을 지워야 함:

```bash
docker compose down -v      # ⚠️ 데이터 전부 삭제
```

## 데모 계정

시드에 포함된 계정임(`seed-accounts.sql`). 비밀번호는 전 계정 `seller1234`임.

| 계정 | 역할 | 볼 수 있는 것 |
|---|---|---|
| `buyer1@jarvis.shop` | USER | 구매자 챗봇, 장바구니·찜·주문, 마이페이지 |
| `seller@jarvis.shop` | SELLER | 판매자 분석 챗봇, 판매자 워크스페이스 |

- 게스트로도 탐색·챗봇·장바구니 담기까지 가능함(개인화만 미적용)
- **판매자 챗봇은 로그인해야 보임** → 포트폴리오 링크를 공유할 때 위 계정을 함께 적어야
  채용 담당자가 그 기능까지 확인할 수 있음
- ⚠️ 시드 비밀번호는 공개 전제임. 이 계정으로 민감한 데이터를 넣지 않음

## 챗봇이 mock인 것에 대하여

`LLM_PROVIDER=mock`으로 돌아감. 공개 링크는 누구나 챗봇을 호출할 수 있고 그 호출이 곧
API 청구서가 되기 때문임. 무료 조건을 지키려면 실제 추론을 붙일 수 없음.

**mock이 대신하는 범위는 좁음** — 상품 검색·장바구니·주문·SSE 이벤트 11종·조건 칩·행동 이벤트
파이프라인은 **전부 실제 코드가 동작함**. mock이 만드는 것은 "어떤 순서로 보여주고 어떤 문구를
붙이나"뿐임(`jarvis-ai/app/core/llm_mock.py`).

실제 LLM로 바꾸려면:

```bash
# .env 에 추가
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...
GOOGLE_API_KEY=...        # 임베딩(검색 재정렬)까지 켤 때
SEARCH_BACKEND=embedding_rerank
```
그 뒤 각 대시보드에 **월 하드 리밋**을 먼저 거는 것을 권함.

## 운영 형상과 다른 점 (의도된 축소)

| 항목 | 팀 운영 | 이 데모 |
|---|---|---|
| 앱 서버 | EC2 4대 + ALB 무중단 배포 | 1대, 단일 컨테이너 |
| DB·캐시 | RDS + ElastiCache | 같은 호스트 컨테이너, 백업 없음 |
| Kafka | 전용 EC2, 운영 4 컨슈머 | 단일 노드 RF=1, 접두어 `demo-` |
| LLM | OpenAI 2-tier | mock(무과금) |
| TLS | ALB + ACM | Cloudflare Tunnel |

`APP_KAFKA_PREFIX=demo-`는 **지우지 말 것.** 자체 브로커를 쓰더라도, 설정이 잘못되어
팀 운영 브로커를 가리키게 되면 접두어가 마지막 방어선이 됨 — 없으면 운영 컨슈머 그룹의
정식 멤버가 되어 **운영 이벤트 일부가 이 데모 DB로 흘러들어가고 오프셋까지 커밋됨**
(에러도 lag도 남지 않음. `jarvis-backend/DEPLOY.md §2-1`)

## 문제 해결

| 증상 | 원인·조치 |
|---|---|
| `app-api` 재시작 반복 | 스키마 미적용 → `prepare-sql.sh` 후 `down -v` → `up` |
| 로그인이 안 됨 | http로 접속했는지 확인. 쿠키가 `Secure`라 HTTPS 필수임 |
| 챗 응답이 `LLM_UNAVAILABLE` | `LLM_PROVIDER=mock`이 주입됐는지 확인 |
| 챗 SSE가 CORS 오류 | `CORS_ORIGINS`(=`SITE_URL`)와 실제 접속 오리진이 정확히 같아야 함 |
| 챗이 401 | `INTERNAL_API_TOKEN`이 BE·AI 양쪽 같은 값인지, JWKS 도달되는지 확인 |
| 디스크 가득 | 로그 회전은 걸려 있음. `docker system prune -a`로 옛 이미지 정리 |
