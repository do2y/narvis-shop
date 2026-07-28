import { SellerShell } from "@/features/seller/SellerShell";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <SellerShell>{children}</SellerShell>;
}
