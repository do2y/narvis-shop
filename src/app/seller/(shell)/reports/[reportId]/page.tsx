import ReportDetailPage from "@/features/seller/ReportDetailPage";

// Next 16 — params 는 async 다(CLAUDE.md).
export default async function Page({
  params,
}: {
  params: Promise<{ reportId: string }>;
}) {
  const { reportId } = await params;
  return <ReportDetailPage reportId={reportId} />;
}
