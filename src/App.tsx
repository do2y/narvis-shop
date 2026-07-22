import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { router } from '@/router';
import { useRestoreSession } from '@/shared/hooks/useRestoreSession';

const queryClient = new QueryClient();

export default function App() {
  // AT는 메모리에만 두므로 새로고침 시 RT 쿠키로 세션을 복원한다(라우터보다 먼저 시작).
  useRestoreSession();

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
