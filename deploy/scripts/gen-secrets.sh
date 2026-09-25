#!/usr/bin/env bash
# 데모 배포용 시크릿을 새로 생성해 .env 조각으로 출력한다.
#
# ⚠️ 로컬 개발 값이나 팀 운영 값을 재사용하지 않는다 — 공개 링크에 붙는 키다.
# INTERNAL_API_TOKEN 은 BE·AI가 **같은 값**을 봐야 하므로 한 번 생성해 둘 다에 쓴다
# (이 compose는 두 서비스에 같은 변수를 주입하므로 자동으로 맞는다).
#
# 사용:
#   bash deploy/scripts/gen-secrets.sh >> deploy/.env

set -euo pipefail

command -v openssl >/dev/null || { echo "openssl 이 필요하다" >&2; exit 1; }

echo "# ── 자동 생성 ($(date +%Y-%m-%d)) — 이 블록은 커밋하지 않는다 ──"
echo "JWT_SECRET=$(openssl rand -base64 48 | tr -d '\n')"
echo "INTERNAL_API_TOKEN=$(openssl rand -hex 32)"
echo "CUSTOMER_LABEL_SECRET=$(openssl rand -base64 48 | tr -d '\n')"
# AI 서버 jwks 모드 필수 — 없으면 기동을 거부한다(약한 PII 해시 방지).
echo "PII_HASH_PEPPER=$(openssl rand -hex 32)"
echo "DB_PASSWORD=$(openssl rand -hex 16)"
echo "DB_ROOT_PASSWORD=$(openssl rand -hex 16)"
echo "PG_PASSWORD=$(openssl rand -hex 16)"

# 스트림 티켓 RS256 private key — base64(PKCS#8 DER) 한 줄.
# 백엔드가 이 키로 서명하고 AI가 JWKS 공개키로 검증한다(양쪽 짝이 맞아야 챗이 열린다).
key=$(openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 2>/dev/null \
      | openssl pkcs8 -topk8 -nocrypt -outform DER | base64 | tr -d '\n')
echo "STREAM_TICKET_PRIVATE_KEY=$key"
echo "STREAM_TICKET_KID=narvis-demo-$(date +%Y%m)"
