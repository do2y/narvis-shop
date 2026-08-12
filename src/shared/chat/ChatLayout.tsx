"use client";

import { useState } from "react";
import type { CSSProperties } from "react";
import { ChatConversation } from "./ChatConversation";
import {
  MobileBottomSheetFrame,
  MOBILE_BOTTOM_SHEET_COLLAPSED_PEEK,
} from "./MobileBottomSheetFrame";

interface ChatLayoutProps {
  onSend: (message: string) => void;
  onRetry: () => void;
  isStreaming: boolean;
  placeholder?: string;
  showUserAvatar?: boolean;
  /** 화면 최상단 헤더 — 채널별 주입(쇼핑=AppHeader, 판매자=SellerHeader) */
  header: React.ReactNode;
  /** 대화 컬럼 상단 바 — "새 대화" 버튼 위치가 화면마다 달라 부모가 정한다 */
  conversationHeader?: React.ReactNode;
  /** 메시지 목록 위 고정 안내(승계 실패 배너 등) */
  notice?: React.ReactNode;
  /** 대화 입력창 위 영역(조건 칩·추천 질문 등) — 채널별 주입 */
  aboveInput?: React.ReactNode;
  /** 우측(모바일에선 하단) 결과 패널 — 채널별 주입 */
  resultPanel: React.ReactNode;
}

/**
 * 채팅 전용 화면 골격 — 좌측 대화 / 우측 결과 2단.
 * 도메인을 모른다. 헤더·결과 렌더링을 주입받는다(SHOPPING·SELLER 공용).
 * 대화 컬럼은 ChatConversation을 그대로 쓴다(사이드 패널과 공유).
 */
export function ChatLayout({
  onSend,
  onRetry,
  isStreaming,
  placeholder,
  showUserAvatar = true,
  header,
  conversationHeader,
  notice,
  aboveInput,
  resultPanel,
}: ChatLayoutProps) {
  const [sheetExpanded, setSheetExpanded] = useState(true);
  const mobileResultBottomClearance = `calc(${MOBILE_BOTTOM_SHEET_COLLAPSED_PEEK}px + env(safe-area-inset-bottom) + 20px)`;

  return (
    <div
      style={
        {
          "--mobile-chat-result-bottom-clearance":
            mobileResultBottomClearance,
        } as CSSProperties
      }
      className="flex h-[100dvh] min-h-[100dvh] max-h-[100dvh] flex-col overflow-hidden bg-background"
    >
      {header}

      <div className="relative flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* 결과는 모바일의 기본 콘텐츠다. 채팅 시트가 펼쳐지면 뒤 스크롤을 잠근다. */}
        <div
          style={{ scrollPaddingBottom: mobileResultBottomClearance }}
          className={[
            "min-h-0 flex-1 bg-muted/30",
            sheetExpanded
              ? "overflow-hidden lg:overflow-y-auto"
              : "overflow-y-auto",
          ].join(" ")}
        >
          {resultPanel}
        </div>

        <MobileBottomSheetFrame
          expanded={sheetExpanded}
          onExpandedChange={setSheetExpanded}
        >
          <ChatConversation
            onSend={(message) => {
              setSheetExpanded(true);
              onSend(message);
            }}
            onRetry={() => {
              setSheetExpanded(true);
              onRetry();
            }}
            isStreaming={isStreaming}
            placeholder={placeholder}
            showUserAvatar={showUserAvatar}
            headerSlot={conversationHeader}
            noticeSlot={notice}
            aboveInput={aboveInput}
            aboveInputClassName={
              sheetExpanded ? "block" : "hidden lg:block"
            }
            scrollAreaClassName="overscroll-y-contain"
            inputAreaClassName="bg-background/98 pb-[calc(1rem+env(safe-area-inset-bottom))] supports-[backdrop-filter]:bg-background/80 lg:bg-background lg:pb-4"
            onInputFocus={() => setSheetExpanded(true)}
            onInputAreaPointerDown={() => setSheetExpanded(true)}
          />
        </MobileBottomSheetFrame>
      </div>
    </div>
  );
}
