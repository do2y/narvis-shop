"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/shared/stores/authStore";
import type { LandingTab } from "../types";
import { NAV_SECTIONS } from "../types";

interface LandingHeaderProps {
  tab: LandingTab;
  onTabChange: (tab: LandingTab) => void;
  /** 현재 탭의 Primary CTA */
  ctaLabel: string;
  ctaHref: string;
}

/**
 * 랜딩 공통 헤더 — 두 탭이 같은 것을 쓴다.
 *
 * `shared/ui/AppHeader`를 쓰지 않는 이유: 그쪽은 **쇼핑몰 운영 헤더**다(장바구니 뱃지·
 * 찜·계정 드롭다운). 랜딩의 헤더는 서비스를 아직 모르는 사람에게 구조를 알려주는
 * 내비게이션이라 목적이 다르다 — 장바구니 개수를 조회할 이유도 없다(쿼리 1개 절약).
 * 로고·워드마크·색 토큰은 그대로 가져와 같은 브랜드로 읽히게 한다.
 *
 * ## 스크롤 상태
 * 최상단에서는 배경 없이 Hero와 이어지고, 내려가면 흰 배경 + 얇은 구분선 + 낮은 높이로
 * 바뀐다. 높이를 줄이는 건 장식이 아니라 읽는 영역을 돌려주는 것이다.
 * 배경을 완전 불투명 대신 `bg-background/85 + backdrop-blur`로 두는 이유는
 * 콘텐츠가 그 아래로 흘러가는 게 보여야 스크롤 위치 감각이 유지되기 때문이다.
 */
export function LandingHeader({
  tab,
  onTabChange,
  ctaLabel,
  ctaHref,
}: LandingHeaderProps) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = useId();
  const user = useAuthStore((s) => s.user);
  const panelRef = useRef<HTMLDivElement>(null);

  // 스크롤 판정. rAF로 묶어 스크롤 1회당 setState가 여러 번 나가지 않게 한다 —
  // 상태는 boolean이라 어차피 같은 값이면 React가 리렌더를 건너뛰지만,
  // 이벤트마다 핸들러가 도는 것 자체를 줄인다(passive: 스크롤을 막지 않는다).
  //
  // 초기 판정도 rAF 안에서 한다 — 이펙트 본문에서 곧바로 setState 하면 연쇄
  // 렌더가 된다. 새로고침으로 중간에서 시작한 경우에도 첫 프레임 뒤 바로 맞춰진다.
  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        setScrolled(window.scrollY > 8);
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, []);

  // 모바일 메뉴: Esc로 닫기. 열린 패널을 닫는 표준 경로라 없으면 키보드 사용자가 갇힌다.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  // 탭을 고르면 메뉴를 함께 닫는다 — 패널이 남아 있으면 방금 바뀐 화면을
  // 자기가 가린다. 이펙트로 `tab` 변화를 감시하지 않는 이유는 헤더에서 탭을
  // 바꾸는 경로가 여기뿐이기 때문이다(푸터·CrossLink는 스크롤을 맨 위로 올린다).
  const selectTab = (next: LandingTab) => {
    onTabChange(next);
    setMenuOpen(false);
  };

  return (
    <header
      className={cn(
        "sticky top-0 z-40",
        // 높이·배경·구분선이 함께 바뀐다. transition 대상을 명시해 all을 피한다
        // (all은 backdrop-filter까지 잡아 스크롤 중 리페인트를 늘린다).
        "transition-[background-color,box-shadow,border-color] duration-300 ease-out-strong",
        scrolled
          ? "border-b bg-background/85 backdrop-blur-md"
          : "border-b border-transparent bg-transparent",
      )}
    >
      <div
        className={cn(
          "mx-auto flex w-full max-w-6xl items-center gap-3 px-5 sm:px-8",
          "transition-[height] duration-300 ease-out-strong",
          scrolled ? "h-14" : "h-16 sm:h-[72px]",
        )}
      >
        {/* 로고 — 쇼핑몰 홈(/home)으로. 여기(랜딩)가 루트라 "/" 로 두면 제자리 링크가 된다 */}
        <Link
          href="/home"
          aria-label="Narvis 홈"
          className="flex shrink-0 items-center gap-2.5 rounded-full"
        >
          {/* next/image를 쓰지 않는다 — 28px 고정 크기의 정적 PNG라 최적화할 여지가
              없고, AppHeader·SellerHeader도 같은 방식이다(표기가 갈리면 안 된다).
              width·height를 명시해 로드 전에도 자리를 잡아 CLS를 막는다. */}
          {/* eslint-disable-next-line @next/next/no-img-element -- fixed-size local logo mark used consistently across headers */}
          <img
            src="/logo-mark.png"
            alt=""
            aria-hidden
            width={28}
            height={28}
            className="size-7 shrink-0"
          />
          <span className="text-lg font-bold tracking-tight text-wordmark">
            Narvis
          </span>
        </Link>

        {/* 데스크톱 내비 — 섹션 앵커 2개 + 탭 2개.
            섹션 앵커와 탭은 성격이 달라(같은 화면 안 이동 vs 대상 전환)
            사이에 구분선을 둬 두 묶음으로 읽히게 한다 */}
        <nav
          aria-label="랜딩 내비게이션"
          className="ml-6 hidden items-center gap-1 lg:flex"
        >
          {NAV_SECTIONS.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="rounded-full px-3 py-2 text-sm font-medium text-muted-foreground transition-colors duration-150 ease-out-strong hover:[@media(hover:hover)]:bg-muted hover:[@media(hover:hover)]:text-foreground"
            >
              {s.label}
            </a>
          ))}

          <span aria-hidden className="mx-2 h-4 w-px bg-border" />

          <TabLinks tab={tab} onSelect={selectTab} />
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          {/* 이미 로그인했으면 "로그인"은 쓸모가 없다 — 서비스로 들어가는 링크로 바꾼다 */}
          {user ? (
            <Link
              href={user.role === "SELLER" ? "/seller" : "/home"}
              className="hidden h-10 items-center rounded-full px-3.5 text-sm font-medium text-muted-foreground transition-colors duration-150 ease-out-strong hover:[@media(hover:hover)]:bg-muted hover:[@media(hover:hover)]:text-foreground sm:inline-flex"
            >
              {user.role === "SELLER" ? "판매자 홈" : "쇼핑하러 가기"}
            </Link>
          ) : (
            <Link
              href="/login"
              className="hidden h-10 items-center rounded-full px-3.5 text-sm font-medium text-muted-foreground transition-colors duration-150 ease-out-strong hover:[@media(hover:hover)]:bg-muted hover:[@media(hover:hover)]:text-foreground sm:inline-flex"
            >
              로그인
            </Link>
          )}

          {/* Primary CTA — 현재 탭에 따라 문구·목적지가 바뀐다 */}
          <Link
            href={ctaHref}
            className={cn(
              "inline-flex h-10 items-center whitespace-nowrap rounded-full bg-brand px-4 text-sm font-semibold text-brand-foreground",
              "transition-[transform,scale,opacity] duration-150 ease-out-strong active:scale-[0.97]",
              "hover:[@media(hover:hover)]:opacity-90",
              "motion-reduce:transition-none motion-reduce:active:scale-100",
            )}
          >
            {ctaLabel}
          </Link>

          {/* 모바일 메뉴 토글 — 44px 터치 타깃 */}
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            aria-controls={menuId}
            aria-label={menuOpen ? "메뉴 닫기" : "메뉴 열기"}
            className="inline-flex size-11 items-center justify-center rounded-full text-muted-foreground transition-colors duration-150 ease-out-strong hover:[@media(hover:hover)]:bg-muted lg:hidden"
          >
            {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {/* 모바일 패널.
          닫힘 상태에서도 DOM에 두고 높이를 0으로 접는다 — 조건부 렌더면
          여는 전환이 없어 툭 나타난다. `invisible`을 함께 걸어 접힌 동안
          링크가 탭 순서에 잡히지 않게 한다(보이지 않는 것에 포커스가 가면
          키보드 사용자가 화면 밖을 헤맨다). */}
      <div
        id={menuId}
        ref={panelRef}
        className={cn(
          "overflow-hidden border-t bg-background lg:hidden",
          "transition-[max-height,opacity,visibility] duration-300 ease-out-strong",
          menuOpen
            ? "max-h-[420px] opacity-100"
            : "invisible max-h-0 border-transparent opacity-0",
        )}
      >
        <nav
          aria-label="모바일 내비게이션"
          className="flex flex-col gap-1 px-5 py-4 sm:px-8"
        >
          <span className="px-1 pb-1 text-xs font-semibold text-muted-foreground">
            서비스 선택
          </span>
          <TabLinks tab={tab} onSelect={selectTab} block />

          <span aria-hidden className="my-2 h-px bg-border" />

          {NAV_SECTIONS.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              onClick={() => setMenuOpen(false)}
              className="flex h-11 items-center rounded-full px-3.5 text-sm font-medium text-muted-foreground transition-colors duration-150 ease-out-strong hover:[@media(hover:hover)]:bg-muted"
            >
              {s.label}
            </a>
          ))}

          <a
            href={
              user ? (user.role === "SELLER" ? "/seller" : "/home") : "/login"
            }
            className="flex h-11 items-center rounded-full px-3.5 text-sm font-medium text-muted-foreground transition-colors duration-150 ease-out-strong hover:[@media(hover:hover)]:bg-muted sm:hidden"
          >
            {user
              ? user.role === "SELLER"
                ? "판매자 홈"
                : "쇼핑하러 가기"
              : "로그인"}
          </a>
        </nav>
      </div>
    </header>
  );
}

/**
 * 소비자 AI / 판매자 AI 전환.
 *
 * 시각적으로는 탭이지만 **역할은 내비게이션**이다(같은 페이지의 다른 대상).
 * `role="tab"`을 쓰지 않는 이유: 탭 위젯의 ARIA 계약은 좌우 화살표 이동·
 * `aria-controls`로 묶인 tabpanel을 요구하는데, 여기서는 페이지 본문 전체가
 * 바뀌고 URL도 함께 갱신된다. 그 실체는 링크에 가까우므로 `aria-current`로
 * 현재 위치만 알린다 — 스크린리더에 "탭 2개 중 1번"이 아니라 "현재 페이지"로 읽힌다.
 */
function TabLinks({
  tab,
  onSelect,
  block = false,
}: {
  tab: LandingTab;
  onSelect: (t: LandingTab) => void;
  block?: boolean;
}) {
  const items: { id: LandingTab; label: string }[] = [
    { id: "buyer", label: "소비자 AI" },
    { id: "seller", label: "판매자 AI" },
  ];

  return (
    <>
      {items.map((item) => {
        const active = item.id === tab;
        return (
          <a
            key={item.id}
            href={`/?tab=${item.id}`}
            aria-current={active ? "page" : undefined}
            onClick={(e) => {
              // 좌클릭·수식키 없음일 때만 가로챈다 — Ctrl/⌘+클릭·가운데 클릭으로
              // 새 탭에 여는 기본 동작을 뺏지 않기 위해서다.
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
              e.preventDefault();
              onSelect(item.id);
            }}
            className={cn(
              "rounded-full text-sm font-medium",
              "transition-colors duration-150 ease-out-strong",
              block
                ? "flex h-11 items-center px-3.5"
                : "px-3 py-2",
              active
                ? // 현재 위치는 색만으로 구분하지 않는다 — 배경 면과 굵기를 함께 준다
                  "bg-brand/10 font-semibold text-brand"
                : "text-muted-foreground hover:[@media(hover:hover)]:bg-muted hover:[@media(hover:hover)]:text-foreground",
            )}
          >
            {item.label}
          </a>
        );
      })}
    </>
  );
}
