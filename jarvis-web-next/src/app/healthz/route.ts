// ALB 헬스체크용 — 원본 nginx.conf의 `location /healthz`를 대체한다.
export const dynamic = "force-dynamic";

export function GET() {
  return new Response("ok\n", {
    status: 200,
    headers: { "Content-Type": "text/plain" },
  });
}
