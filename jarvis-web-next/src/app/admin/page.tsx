import { Suspense } from "react";
import AdminPage from "@/features/admin";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <AdminPage />
    </Suspense>
  );
}
