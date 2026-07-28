import ChatPage from "@/features/chat";

// Suspense 불필요 — ?q= 는 마운트 후 이펙트에서 읽는다(SSR에서 헤더가 사라지지 않도록).
export default function Page() {
  return <ChatPage />;
}
