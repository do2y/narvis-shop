#!/usr/bin/env bash
# Oracle Cloud(Ubuntu ARM) 호스트를 데모 배포가 가능한 상태로 만든다.
#
# 하는 일: Docker 설치 → 스왑 확보 → Oracle 기본 방화벽 정리 → 레포 3개 clone.
# 멱등하게 작성했으므로 중간에 끊겨도 다시 실행하면 된다.
#
# 사용: curl 로 받지 말고 레포를 clone 한 뒤 실행하거나, 내용을 확인하고 붙여넣는다.
#   bash deploy/scripts/bootstrap-host.sh

set -euo pipefail

GH_USER="${GH_USER:-do2y}"
WORKDIR="${WORKDIR:-$HOME/project}"

log() { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }

# ── 1) Docker ──
if command -v docker >/dev/null 2>&1; then
  log "Docker 이미 설치됨 — 건너뛴다"
else
  log "Docker 설치"
  sudo apt-get update -qq
  sudo apt-get install -y -qq ca-certificates curl gnupg git
  sudo install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
    | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  sudo chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
  sudo apt-get update -qq
  sudo apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  sudo usermod -aG docker "$USER"
  log "⚠️ docker 그룹 적용을 위해 이 세션을 다시 로그인해야 한다 (또는 newgrp docker)"
fi

# ── 2) 스왑 ──
# 이미지 빌드(특히 Gradle·uv)가 순간적으로 메모리를 크게 먹는다. 24GB 인스턴스라면
# 없어도 되지만, 무료 티어를 1GB×4 로 쪼개 받은 경우엔 스왑 없이는 빌드가 OOM 으로 죽는다.
if [ "$(swapon --show --noheadings | wc -l)" -gt 0 ]; then
  log "스왑 이미 있음 — 건너뛴다"
else
  log "스왑 4GB 생성"
  sudo fallocate -l 4G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile >/dev/null
  sudo swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
fi

# ── 3) 방화벽 ──
# Oracle 의 Ubuntu 이미지는 iptables 로 거의 전부 DROP 한다. Cloudflare Tunnel 은
# **아웃바운드만** 쓰므로 인바운드를 열 필요는 없지만, DOCKER 체인과 기본 REJECT 규칙이
# 충돌해 컨테이너의 외부 통신(이미지 pull, 터널 연결)이 막히는 일이 흔하다.
# 그 REJECT 규칙만 걷어낸다 — 포트를 새로 여는 것이 아니다.
if sudo iptables -C INPUT -j REJECT --reject-with icmp-host-prohibited 2>/dev/null; then
  log "Oracle 기본 REJECT 규칙 제거 (인바운드 포트는 열지 않는다)"
  sudo iptables -D INPUT -j REJECT --reject-with icmp-host-prohibited || true
  sudo iptables -D FORWARD -j REJECT --reject-with icmp-host-prohibited 2>/dev/null || true
  sudo apt-get install -y -qq iptables-persistent >/dev/null 2>&1 || true
  sudo netfilter-persistent save >/dev/null 2>&1 || true
else
  log "REJECT 규칙 없음 — 건너뛴다"
fi

# ── 4) 레포 clone ──
log "레포 clone → $WORKDIR"
mkdir -p "$WORKDIR"
cd "$WORKDIR"
clone() {
  local name="$1" url="$2"
  if [ -d "$name/.git" ]; then
    echo "  $name 이미 있음 — pull"
    git -C "$name" pull --ff-only || true
  else
    git clone "$url" "$name"
  fi
}
# compose 의 기본 경로가 jarvis-* 를 가정하므로 그 이름으로 받는다.
clone jarvis-web     "https://github.com/$GH_USER/narvis-shop.git"
clone jarvis-backend "https://github.com/$GH_USER/narvis-backend.git"
clone jarvis-ai      "https://github.com/$GH_USER/narvis-ai.git"

# 데모 코드가 있는 브랜치로 맞춘다.
git -C jarvis-web    checkout feat/portfolio-deploy
git -C jarvis-ai     checkout feat/mock-llm-provider

log "완료. 다음 단계:"
cat <<'NEXT'
  cd ~/project/jarvis-web/deploy
  bash scripts/prepare-sql.sh
  cp .env.example .env
  bash scripts/gen-secrets.sh >> .env
  vi .env          # SITE_URL · AI_PUBLIC_URL · TUNNEL_TOKEN 채우기
  docker compose up -d --build
NEXT
