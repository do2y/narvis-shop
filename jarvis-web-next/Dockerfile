# syntax=docker/dockerfile:1
# JARVIS 프론트엔드 컨테이너 이미지 (Next.js).
# 원본(Vite)은 정적 빌드 결과를 nginx로 서빙했지만, SSR은 요청마다 서버에서 렌더를
# 돌리므로 Node 프로세스가 상시 떠 있어야 한다.

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
# 빈 값 = 브라우저가 /api/... 상대경로로 요청 → app/api/[...path] 프록시가 백엔드로 전달.
ENV NEXT_PUBLIC_API_BASE_URL=""
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# --- runtime: standalone 서버 ---
FROM node:20-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# 원본 nginx가 80을 쓰고 ALB 헬스체크도 http://localhost/healthz라 포트를 맞춘다.
ENV PORT=80
ENV HOSTNAME=0.0.0.0

# standalone은 필요한 node_modules만 담아 나온다.
COPY --from=build /app/.next/standalone ./
# public·.next/static은 standalone에 자동 포함되지 않으므로 직접 넣는다(문서 명시).
COPY --from=build /app/public ./public
COPY --from=build /app/.next/static ./.next/static

# 80은 특권 포트라 비특권 사용자로는 bind할 수 없다. root로 돌리는 대신
# node 바이너리에 포트 바인딩 권한만 부여하고 사용자를 낮춘다.
RUN apk add --no-cache libcap \
  && setcap 'cap_net_bind_service=+ep' /usr/local/bin/node \
  && apk del libcap
USER node

EXPOSE 80
CMD ["node", "server.js"]
