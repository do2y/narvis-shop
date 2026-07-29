# syntax=docker/dockerfile:1
# JARVIS 프론트엔드 컨테이너 이미지 (nginx + Next.js SSR).
#
# 아키텍처(03 D-분산4): 앱 티어 A = nginx + next + spring 을 한 인스턴스에 묶는다.
# nginx는 층2 LB이자 /internal 차단(3중 방어 ①)을 맡으므로 프론트 컨테이너에 유지한다.
#
#   ALB → nginx(80) ─ /api/**, /.well-known/**, /actuator/** → spring:8080
#                    ─ /internal/**                          → 404 차단
#                    ─ 그 외                                  → next:3000 (SSR)

# --- deps: 의존성 설치 (레이어 캐시 분리) ---
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# --- build: next build ---
FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* 는 빌드 시점에 번들에 박힌다(런타임 주입 불가).
# 빈 값 = 브라우저가 /api/... 상대경로로 요청 → nginx가 spring으로 프록시.
ENV NEXT_PUBLIC_API_BASE_URL=""
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# --- runtime: nginx + Next standalone ---
FROM node:20-alpine AS runtime
WORKDIR /app

RUN apk add --no-cache nginx

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Next는 내부 3000, 외부 노출은 nginx의 80뿐(원본과 동일).
ENV PORT=3000
ENV HOSTNAME=127.0.0.1

# standalone은 필요한 node_modules만 담아 나온다.
COPY --from=build /app/.next/standalone ./
# public·.next/static은 standalone에 자동 포함되지 않으므로 직접 넣는다(Next 문서 명시).
COPY --from=build /app/public ./public
COPY --from=build /app/.next/static ./.next/static

COPY nginx.conf /etc/nginx/http.d/default.conf
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# nginx가 80(특권 포트)을 bind해야 하므로 root로 둔다 — 원본(nginx 이미지)과 동일한 전제.
# Next는 127.0.0.1:3000이라 외부에서 직접 닿지 않는다.
EXPOSE 80
CMD ["/docker-entrypoint.sh"]
