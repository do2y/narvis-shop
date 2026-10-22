# SSR 전환 효과 측정 — Vite(CSR) vs Next.js(SSR)

> 측정일: 2026-10-22 · 로컬 · Lighthouse 12.8.2 모바일 기본 프리셋
>
> 전환(2026-07-28)의 목적은 **검색 노출과 공유 링크 미리보기**였다. 전환 당시에는
> "HTML 에 본문이 들어가는 구조를 갖췄다"까지만 확인하고 수치로 재지 않았다.
> 이 문서는 그 전후를 같은 조건에서 비교한 기록이다.

## 결론

- **목적한 것은 달성됨.** CSR 은 세 페이지 모두 459B 빈 껍데기(`<title>jarvis-web</title>`, 공유 메타 없음)였고,
  SSR 은 상품명·가격·페이지별 `og:title`·`og:image`·`description` 이 첫 HTML 에 들어 있음. SEO 점수 83 → 100
- **첫 화면은 빨라짐.** FCP 약 2.4초 → 1.7초(약 −30%), 상세 페이지 Speed Index 3.6초 → 1.7초(약 −54%)
- **LCP 는 줄지 않음.** 양쪽 모두 3.0~3.3초. 원인은 SSR 이 아니라 **웹폰트 2,010KB** —
  전송량의 약 78% 이고, 느린 4G 가정에서 글자가 이 폰트를 기다리느라 LCP 가 묶임
- **대가도 있음.** JS 전송량 190KB → 473KB, TBT 6ms → 33ms (둘 다 기준 200ms 대비 낮은 수준)

## 비교 조건

| | 전 (CSR) | 후 (SSR) |
|---|---|---|
| 코드 | `62267ff` (07-28, 전환 직전 Vite) | `main` `5dd240a` |
| 실행 | `vite build` → `vite preview` | `next build` → standalone `node server.js` (배포와 같은 방식) |
| 데이터 | `/api` 를 Next 목 서버로 프록시 | `MOCK_API=1` 목 (SSR·클라이언트 공용) |
| 페이지 | `/products/9001` · `/brands/101` · `/` | `/products/9001` · `/brands/101` · `/home` |

- **양쪽이 같은 목 데이터를 네트워크로 받게 맞춤.** 처음엔 Vite 를 MSW 로 띄웠는데, MSW(464KB)가 앱보다 먼저 떠야
  렌더가 시작돼 CSR 이 부당하게 느려지므로 버림
- CSR 도 JS 실행 후에는 같은 내용을 그림을 헤드리스 Chrome `--dump-dom` 으로 확인함(상세 38,700B · '에어플로우 러닝화' 2회 등)
- 이미지는 양쪽 모두 인라인 SVG(data URI) — 이미지 크기 차이가 LCP 에 섞이지 않음
- 홈 경로가 다른 건 2026-08-12 루트 전환(`/` = 랜딩, `/home` = 쇼핑몰 홈) 때문. 같은 화면을 비교함

## 1. 첫 HTML — 크롤러와 공유 미리보기가 보는 것

`curl` 로 받은 응답 그대로(JS 실행 전).

| 페이지 | 구분 | HTML | 상품·브랜드명 | 가격 | `<title>` | `og:title` | `og:image` | description |
|---|---|---|---|---|---|---|---|---|
| 상세 | CSR | 459B | 0회 | 없음 | jarvis-web | 없음 | 없음 | 없음 |
| 상세 | SSR | 46,687B | 12회 | 89,000원 | 에어플로우 러닝화 \| 스트라이드 | 같음 | 있음 | 있음 |
| 브랜드 | CSR | 459B | 0회 | 없음 | jarvis-web | 없음 | 없음 | 없음 |
| 브랜드 | SSR | 34,049B | 21회 | 89,000원 | 스트라이드 \| Narvis | 같음 | 있음 | 있음 |
| 홈 | CSR | 459B | 0회 | 없음 | jarvis-web | 없음 | 없음 | 없음 |
| 홈 | SSR | 80,531B | 5회 | 89,000원 | Narvis — 대화로 찾는 쇼핑 | 같음 | 있음 | 있음 |

- 공유 미리보기(카카오톡·슬랙 등)는 JS 를 실행하지 않으므로, CSR 은 어떤 상품 링크를 보내도 같은 빈 카드가 뜨는 구조였음
- Lighthouse SEO 감점 항목: CSR `meta-description` · `robots-txt` / SSR 없음

## 2. Lighthouse — 3회 중앙값

모바일 기본 프리셋(시뮬레이션: RTT 150ms · 1.6Mbps · CPU 4배 감속).

| 페이지 | 구분 | 성능 | SEO | FCP | LCP | Speed Index | TBT | CLS |
|---|---|---|---|---|---|---|---|---|
| 상세 | CSR | 89 | 83 | 2,489ms | 3,081ms | 3,640ms | 6ms | 0 |
| 상세 | SSR | 93 | **100** | **1,686ms** | 3,130ms | **1,686ms** | 33ms | 0 |
| 브랜드 | CSR | 91 | 83 | 2,413ms | 3,023ms | 2,413ms | 0ms | 0 |
| 브랜드 | SSR | 92 | **100** | **1,686ms** | 3,192ms | **1,853ms** | 29ms | 0 |
| 홈 | CSR | 89 | 83 | 2,413ms | 3,204ms | 3,281ms | 3ms | 0 |
| 홈 | SSR | 91 | **100** | **1,686ms** | 3,316ms | **1,980ms** | 25ms | 0 |

원시값(FCP/LCP/SI, 회차별):

```
csr detail  2489/3081/3640  2488/3055/2488  2640/3238/6541
ssr detail  1690/3130/1690  1686/3128/1686  1685/3130/1685
csr brand   2413/3023/2413  2413/3024/2413  2413/3023/2413
ssr brand   1680/3193/1853  1686/3192/1882  1686/3052/1686
csr home    2569/3204/9402  2341/3292/3281  2413/3052/2413
ssr home    1684/3316/1950  11964/13460/13276  1686/3313/1980
```

- SSR 홈 2회차(LCP 13.5초)는 이상치. 다른 두 회차와 10배 차이라 측정 잡음으로 봄 — 중앙값을 쓴 이유
- CSR Speed Index 는 회차별 편차가 큼(상세 2.5~6.5초). SSR 은 세 회차가 거의 같음

## 3. LCP 가 줄지 않은 이유 — 웹폰트

| | 전송 합계 | 폰트 | JS |
|---|---|---|---|
| CSR 상세 | 2,546KB | **2,010KB** | 190KB |
| SSR 상세 | 2,566KB | **2,010KB** | 473KB |

- `globals.css` 1행이 Pretendard **가변 폰트 전체**(`pretendardvariable.min.css`)를 CDN 에서 불러옴 → `PretendardVariable.woff2` 2,010KB
- LCP 요소가 양쪽 모두 텍스트(상세: CSR 은 `h1` 상품명, SSR 은 가격 `span`)라 폰트 도착에 묶임
- 실제 관측값으로는 SSR LCP 요소가 응답 후 약 0.1초 만에 렌더됨(TTFB 12ms + 렌더 지연 100ms).
  3초대는 느린 4G 를 가정한 시뮬레이션 값이고, 그 대부분이 폰트 2MB 다운로드 시간임
- → **SSR 은 HTML 을 일찍 보내는 데까지는 해냈지만, 그다음 병목이 폰트로 옮겨 감.**
  LCP 를 줄이려면 다음 작업은 폰트 서브셋(한글 사용 글자만 담은 dynamic subset 등)이다. 이번 측정 범위 밖이라 손대지 않음

## 4. 대가 — JS 증가

- JS 190KB → 473KB(+283KB). Next 런타임·RSC 페이로드·하이드레이션 코드
- TBT 6ms → 33ms. 기준(200ms) 대비 낮아 체감 영향은 작다고 봄. 다만 "SSR 은 공짜"는 아님

## 한계 — 이 수치로 말할 수 없는 것

- **로컬 측정이다.** 실사용자 데이터(필드 데이터)·실제 검색 유입이 아님. "검색 유입이 늘었다"는 여전히 말할 수 없음
- **목 데이터다.** 실제 백엔드의 응답 시간(TTFB)이 빠져 있음. 실서버에선 SSR 이 서버에서 API 를 기다리는 만큼 TTFB 가 늘고,
  CSR 은 브라우저에서 같은 시간을 기다림 — 이 차이는 이 측정에 반영되지 않음
- CSR 은 Vite preview 프록시를 한 번 더 거침(로컬이라 수 ms 수준)
- 비교 대상 사이에 7~9월 변경이 있음(`62267ff` → `5dd240a`). 화면 구성이 완전히 같지는 않음
- 시뮬레이션 스로틀링 값이라 절대값보다 **같은 조건에서의 차이**로 읽을 것

## 재현 방법

```bash
# 후(SSR) — 배포와 같은 standalone 방식. `next start` 는 output: standalone 과 맞지 않아 SSR 목이 동작하지 않음
MOCK_API=1 npm run build
cp -R public .next/standalone/ && cp -R .next/static .next/standalone/.next/
(cd .next/standalone && MOCK_API=1 PORT=3000 HOSTNAME=127.0.0.1 node server.js)

# 전(CSR) — 전환 직전 커밋을 별도 작업 폴더로
git worktree add ../before 62267ff && cd ../before && npm ci
npx vite build   # VITE_ENABLE_MOCKS 를 켜지 않는다(MSW 제외)
VITE_API_PROXY_TARGET=http://127.0.0.1:3000 npx vite preview --port 4173

# 첫 HTML
curl -s http://127.0.0.1:3000/products/9001 | grep -o '<title>[^<]*</title>'

# Lighthouse (프로젝트 의존성에 추가하지 않고 1회 실행)
npx -y lighthouse@12.8.2 <url> --output=json --only-categories=performance,seo \
  --chrome-flags="--headless=new"
```

- zsh 에서 스크립트를 짤 땐 주의 — 따옴표 없는 변수가 공백으로 나뉘지 않고, `path` 는 `PATH` 와 묶인 예약 변수라
  측정이 조용히 엉뚱한 URL 을 잴 수 있음(실제로 한 번 랜딩 페이지를 재고 있었음). bash 로 돌릴 것
