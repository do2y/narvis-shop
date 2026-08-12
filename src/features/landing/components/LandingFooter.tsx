"use client";

import Link from "next/link";
import type { LandingTab } from "../types";

/**
 * 랜딩 공통 푸터 — 두 탭이 같은 것을 쓴다.
 *
 * **없는 것을 적지 않는다.** 회사 정보·고객센터 번호·사용자 수·수상 실적·파트너사는
 * 이 프로젝트에 존재하지 않으므로 넣지 않는다. 랜딩 푸터에 흔히 들어가는 항목이라
 * 비워 두면 허전해 보이지만, 지어내면 그 순간 이 화면 전체가 신뢰를 잃는다.
 *
 * 이용약관·개인정보처리방침은 아직 라우트가 없다. 링크처럼 보이되 눌리지 않는
 * 버튼으로 두면 사용자가 고장으로 읽으므로, **준비 중임을 글로 밝힌다**.
 */
export function LandingFooter({
  tab,
  onTabChange,
}: {
  tab: LandingTab;
  onTabChange: (tab: LandingTab) => void;
}) {
  return (
    <footer className="border-t bg-muted/25">
      <div className="mx-auto w-full max-w-6xl px-5 py-12 sm:px-8 sm:py-14">
        <div className="flex flex-col gap-10 lg:flex-row lg:justify-between">
          <div className="flex max-w-sm flex-col gap-3">
            <div className="flex items-center gap-2.5">
              {/* 화면 아래쪽이라 늦게 받아도 된다 — 히어로 자원과 경쟁시키지 않는다.
                  width·height 명시로 로드 전에도 자리를 잡는다(CLS 방지). */}
              {/* eslint-disable-next-line @next/next/no-img-element -- fixed-size local logo mark; optimization overhead outweighs benefit here */}
              <img
                src="/logo-mark.png"
                alt=""
                aria-hidden
                width={28}
                height={28}
                loading="lazy"
                decoding="async"
                className="size-7 shrink-0"
              />
              <span className="text-lg font-bold tracking-tight text-wordmark">
                Narvis
              </span>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              대화로 상품을 찾고, 판매 데이터를 묻는 AI 쇼핑 에이전트입니다.
            </p>
          </div>

          <nav
            aria-label="푸터 내비게이션"
            className="grid grid-cols-2 gap-x-10 gap-y-8 sm:grid-cols-3"
          >
            <FooterGroup title="서비스">
              {/* 탭 전환 — 헤더와 같은 규칙(수식키 클릭은 새 탭으로 넘긴다) */}
              <FooterTab
                tab="buyer"
                current={tab}
                onSelect={onTabChange}
                label="소비자 AI 쇼핑"
              />
              <FooterTab
                tab="seller"
                current={tab}
                onSelect={onTabChange}
                label="판매자 AI"
              />
            </FooterGroup>

            <FooterGroup title="바로가기">
              <FooterLink href="/home">쇼핑몰 홈</FooterLink>
              <FooterLink href="/chat">AI 쇼핑 채팅</FooterLink>
            </FooterGroup>

            <FooterGroup title="약관">
              {/* 라우트가 아직 없다 — 링크 대신 상태를 밝힌다 */}
              <li className="text-sm text-muted-foreground/70">
                이용약관
                <span className="ml-1.5 text-xs">준비 중</span>
              </li>
              <li className="text-sm text-muted-foreground/70">
                개인정보처리방침
                <span className="ml-1.5 text-xs">준비 중</span>
              </li>
            </FooterGroup>
          </nav>
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 Narvis. 부트캠프 최종 프로젝트.</p>
          {/* 실재하는 링크만 싣는다 — 문의 채널이 따로 없으므로 저장소를 가리킨다.
              저장소명의 `jarvis-`는 서비스명 변경 전 이름 그대로다(CLAUDE.md). */}
          <a
            href="https://github.com/toss-delta-final/jarvis-frontend"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 items-center rounded-full transition-colors duration-150 ease-out-strong hover:[@media(hover:hover)]:text-foreground"
          >
            프로젝트 저장소
          </a>
        </div>
      </div>
    </footer>
  );
}

function FooterGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-xs font-semibold text-foreground">{title}</h2>
      <ul className="flex flex-col gap-2.5">{children}</ul>
    </div>
  );
}

function FooterLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <li>
      <Link
        href={href}
        className="text-sm text-muted-foreground transition-colors duration-150 ease-out-strong hover:[@media(hover:hover)]:text-foreground"
      >
        {children}
      </Link>
    </li>
  );
}

function FooterTab({
  tab,
  current,
  onSelect,
  label,
}: {
  tab: LandingTab;
  current: LandingTab;
  onSelect: (t: LandingTab) => void;
  label: string;
}) {
  const active = tab === current;
  return (
    <li>
      <a
        href={`/?tab=${tab}`}
        aria-current={active ? "page" : undefined}
        onClick={(e) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
          e.preventDefault();
          onSelect(tab);
          // 탭을 바꾸면 화면 맨 위부터 읽어야 한다 — 푸터에서 눌렀으므로
          // 그대로 두면 새 탭의 마지막 섹션이 보인다.
          window.scrollTo({ top: 0, behavior: "auto" });
        }}
        className={
          active
            ? "text-sm font-semibold text-brand"
            : "text-sm text-muted-foreground transition-colors duration-150 ease-out-strong hover:[@media(hover:hover)]:text-foreground"
        }
      >
        {label}
      </a>
    </li>
  );
}
