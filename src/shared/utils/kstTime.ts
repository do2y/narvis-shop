/**
 * UTC 시각 문자열을 KST(+09:00) 표기로 옮긴다.
 *
 * 왜 필요한가 — 같은 리포트를 두 경로가 다른 표기로 준다:
 *   S-4 report SSE 이벤트 → KST(+09:00) 고정
 *   R-1/R-2 저장 보고서    → UTC "Z"
 *
 * 화면(AnalysisReport)의 formatGeneratedAt 은 문자열 앞부분을 정규식으로 잘라 쓴다
 * — 타임존 변환을 하지 않는다. S-4 가 이미 KST 로 주기 때문에 그게 맞는 동작이고,
 * 그래서 컴포넌트를 고칠 수 없다(고치면 챗 패널이 9시간 어긋난다).
 *
 * 따라서 **R-1/R-2 응답을 읽는 쪽이 KST 로 옮겨서 넘긴다.** 그대로 넘기면
 * "2026-08-11T06:00:00Z" 가 화면에 "2026-08-11 06:00" 으로 찍힌다 — 실제 KST 는
 * 15:00 이고, UTC 15:00~23:59 구간은 날짜까지 하루 어긋난다.
 */

/** 한국은 서머타임이 없어 고정 오프셋으로 충분하다(1988년 이후). */
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * RFC3339 UTC → KST 오프셋 표기("2026-08-11T15:00:00+09:00").
 *
 * 반환 형식을 S-4 와 같은 오프셋 표기로 맞춘 이유: 이 값이 그대로
 * formatGeneratedAt 에 들어가는데, 그 함수는 앞 16자를 잘라 쓰므로
 * 옮겨진 벽시계 시각이 그대로 보인다.
 *
 * 파싱할 수 없는 값은 그대로 돌려준다 — 표시가 깨질지언정 화면을 죽이지 않는다.
 * (Date 는 잘못된 문자열에 NaN 을 담고 toISOString 에서 던진다.)
 */
export function utcToKst(iso: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return iso;

  const d = new Date(ms + KST_OFFSET_MS);
  // getUTC* 로 읽는다 — 오프셋을 이미 더했으므로 여기서 실행 환경의
  // 로컬 타임존이 한 번 더 끼어들면 안 된다(서버·CI 는 대개 UTC 다).
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}+09:00`
  );
}

/** null 을 통과시키는 변형 — readAt·appliedAt 처럼 null 이 정상값인 필드용. */
export function utcToKstNullable(iso: string | null): string | null {
  return iso === null ? null : utcToKst(iso);
}
