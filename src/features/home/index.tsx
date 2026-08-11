"use client";

import { AppHeader } from "@/shared/ui/AppHeader";
import { Hero } from "./components/Hero";
import { CategoryGrid } from "./components/CategoryGrid";
import { PopularProducts } from "./components/PopularProducts";
import { RecommendedProducts } from "./components/RecommendedProducts";
import { HomeFooter } from "./components/HomeFooter";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AppHeader />
      <main className="flex-1">
        <Hero />
        <CategoryGrid />
        {/* 개인화 추천은 로그인 시에만 렌더(게스트는 null) → 인기 상품보다 위 */}
        <RecommendedProducts />
        <PopularProducts />
      </main>
      <HomeFooter />
    </div>
  );
}
