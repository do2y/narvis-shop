#!/usr/bin/env bash
# 백엔드 스키마·시드를 MariaDB init 디렉토리로 모은다.
#
# 왜 복사하나: docker-entrypoint-initdb.d 는 **파일명 알파벳 순**으로 실행한다.
# 백엔드가 요구하는 순서(schema → accounts → catalog → commerce → analytics)는
# 알파벳 순과 다르므로 숫자 접두어를 붙여 고정한다.
#
# 왜 레포에 커밋하지 않나: SQL 원본은 jarvis-backend 소관이다. 복사본을 커밋하면
# 스키마가 바뀔 때 조용히 낡아 "validate 실패로 기동 거부"를 디버깅하게 된다.
# 배포 직전에 항상 원본에서 다시 만든다.

set -euo pipefail

HERE="$(cd "$(dirname "$0")/.." && pwd)"   # deploy/
OUT="$HERE/sql/backend"

# 기본값은 deploy/ 기준 상대경로(레포 3개를 나란히 둔 배치)로 해석한다.
BACKEND_REPO="${BACKEND_REPO_PATH:-$HERE/../../jarvis-backend}"
BACKEND_ABS="$(cd "$BACKEND_REPO" 2>/dev/null && pwd)" || {
  echo "백엔드 레포 경로를 열 수 없다: $BACKEND_REPO" >&2
  exit 1
}

if [ ! -f "$BACKEND_ABS/docs/backend/schema.sql" ]; then
  echo "백엔드 레포를 찾지 못했다: $BACKEND_ABS" >&2
  echo "BACKEND_REPO_PATH 를 지정하거나 레포를 나란히 두어라." >&2
  exit 1
fi

rm -rf "$OUT"
mkdir -p "$OUT"

# 00 = 스키마 (최초 1회 전용 DDL). 빈 볼륨에만 적용되므로 재실행 문제가 없다.
cp "$BACKEND_ABS/docs/backend/schema.sql" "$OUT/00-schema.sql"

# 01.. = 증분 마이그레이션. schema.sql 이 어느 시점 스냅샷인지 보장이 없어
# 전부 흘린다 — 재실행 무해하게 작성되어 있다(DEPLOY.md §4-2).
# ⚠️ 정렬 주의: 이름 순 나열은 `-post` 를 `-pre` 보다 앞에 둔다(o < r).
# 2026-08-11 ERD 정비 쌍은 pre → 앱기동 → post 가 계약이라 뒤집히면 안 된다.
# `sed` 로 정렬 키만 pre=1/post=2 로 바꿔 날짜 안에서의 순서를 바로잡는다.
i=1
for f in $(
  for m in "$BACKEND_ABS"/scripts/migrate-*.sql; do
    [ -e "$m" ] || continue
    key=$(basename "$m" | sed -e 's/-pre\.sql$/-1.sql/' -e 's/-post\.sql$/-2.sql/')
    printf '%s	%s
' "$key" "$m"
  done | sort | cut -f2
); do
  n=$(printf "%02d" "$i")
  cp "$f" "$OUT/${n}-$(basename "$f")"
  i=$((i + 1))
done

# 90.. = 시드. 순서가 의미를 가진다(계정 → 카탈로그 → 주문 → 분석).
cp "$BACKEND_ABS/scripts/seed-accounts.sql"        "$OUT/90-seed-accounts.sql"
cp "$BACKEND_ABS/scripts/seed-catalog.sql"         "$OUT/91-seed-catalog.sql"
cp "$BACKEND_ABS/scripts/seed-commerce-demo.sql"   "$OUT/92-seed-commerce-demo.sql"
cp "$BACKEND_ABS/scripts/seed-analytics-demo.sql"  "$OUT/93-seed-analytics-demo.sql"
# 리뷰 시드 — 상품 상세의 리뷰 분포 바가 비면 화면이 허전해 데모 품질이 떨어진다.
[ -f "$BACKEND_ABS/scripts/seed-reviews.sql" ] && \
  cp "$BACKEND_ABS/scripts/seed-reviews.sql" "$OUT/94-seed-reviews.sql"

echo "준비 완료 → $OUT"
ls -1 "$OUT" | sed 's/^/  /'
