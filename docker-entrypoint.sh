#!/bin/sh
# nginx(80) + Next(3000) 두 프로세스를 한 컨테이너에서 띄운다.
#
# 왜 한 컨테이너인가: 팀 아키텍처(03 D-분산4)가 "앱 티어 A = nginx+next+spring"으로
# 한 인스턴스 안에 묶는 구조다. nginx는 층2 LB이자 /internal 차단(3중 방어 ①)을 맡는다.
#
# 프로세스 관리자를 따로 두지 않는 이유: 둘 중 하나라도 죽으면 컨테이너를 내려
# --restart always가 통째로 재기동하게 한다(부분 장애 상태로 남지 않게).

set -e

# 종료 신호를 두 프로세스에 전달 — docker stop이 걸리면 정상 종료시킨다.
term() {
  kill -TERM "$NEXT_PID" "$NGINX_PID" 2>/dev/null || true
}
trap term TERM INT

# 1) Next를 백그라운드로 먼저 띄운다.
node server.js &
NEXT_PID=$!

# 2) nginx가 3000으로 프록시하므로 Next가 준비될 때까지 기다린다.
#    (ALB 헬스체크 /healthz도 Next로 넘기므로 미리 떠 있어야 한다)
i=0
while [ "$i" -lt 60 ]; do
  if wget -q -O /dev/null "http://127.0.0.1:3000/healthz" 2>/dev/null; then
    break
  fi
  # Next가 기동 중 죽었으면 더 기다릴 이유가 없다.
  if ! kill -0 "$NEXT_PID" 2>/dev/null; then
    echo "[entrypoint] Next가 기동 중 종료됨" >&2
    exit 1
  fi
  i=$((i + 1))
  sleep 1
done

# 3) nginx 기동
nginx -g 'daemon off;' &
NGINX_PID=$!

# 4) 둘 중 하나라도 죽으면 컨테이너를 내린다.
#    ash에는 `wait -n`이 없어 폴링으로 감시한다(1초 간격, 비용 무시 가능).
while kill -0 "$NEXT_PID" 2>/dev/null && kill -0 "$NGINX_PID" 2>/dev/null; do
  sleep 1
done

echo "[entrypoint] 프로세스 중 하나가 종료됨 — 컨테이너를 내린다" >&2
term
exit 1
