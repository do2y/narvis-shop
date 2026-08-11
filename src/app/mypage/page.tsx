import { redirect } from "next/navigation";

// 원본: <Route index element={<Navigate to="orders" replace />} />
export default function Page() {
  redirect("/mypage/preferences");
}
