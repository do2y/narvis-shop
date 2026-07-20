import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { initAnalytics } from '@/shared/analytics/track';
import './index.css';

async function enableMocking() {
  // MSW는 VITE_ENABLE_MOCKS=true일 때만 활성화 (dev/배포 무관).
  // 실제 백엔드 연동이 기본. 백엔드 없이 데모·화면 확인할 때만 .env.local에서 켠다.
  if (import.meta.env.VITE_ENABLE_MOCKS !== 'true') return;
  const { worker } = await import('./mocks/browser');
  return worker.start({ onUnhandledRequest: 'bypass' });
}

enableMocking().then(() => {
  // StrictMode의 이펙트 2회 실행을 피하려고 컴포넌트 밖에서 1회 초기화한다.
  initAnalytics();

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
