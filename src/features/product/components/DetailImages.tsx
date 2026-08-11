"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/shared/ui/button";

/**
 * 상세 설명 이미지 — 위에서 아래로 이어 붙이는 세로 나열.
 *
 * 상단 ImageGallery와 성격이 다르다: 갤러리는 "같은 상품의 여러 각도"라 골라 보는 것이고,
 * 이건 한 장짜리 긴 상세페이지를 여러 조각으로 자른 것이라 순서대로 이어 봐야 한다.
 * 그래서 썸네일·전환 없이 그냥 쌓는다. 조각 사이를 띄우면 잘린 이미지가 어긋나 보여
 * 간격도 주지 않는다.
 *
 * 세로 길이가 수천 px에 달해 처음부터 다 펼치면 리뷰·추천이 화면 밖으로 밀려난다.
 * 접은 상태를 기본으로 두고 펼치게 한다.
 */

// 접었을 때 보이는 높이(px). 시안의 이 자리 기준 — 더 짧으면 무엇이 있는지 알 수 없고
// 더 길면 접는 의미가 없다.
const COLLAPSED_HEIGHT = 600;

export function DetailImages({ images, alt }: { images: string[]; alt: string }) {
  const [expanded, setExpanded] = useState(false);

  // 빈 값이 섞여 오는 상품이 있다(null·빈 문자열). 그대로 그리면 제목만 뜬 채
  // 아래가 비어 "고장난 화면"으로 보이므로 먼저 걸러낸다.
  const valid = images.filter((src) => typeof src === "string" && src.trim());

  // 쓸 수 있는 이미지가 하나도 없으면 섹션째 그리지 않는다 —
  // 상세 이미지가 아예 없는 상품과 같은 화면이 된다(제목·버튼 없음).
  if (valid.length === 0) return null;

  // 조각이 1장뿐이면 접을 이유가 없다 — 대개 짧은 안내 이미지다.
  const collapsible = valid.length > 1;
  const collapsed = collapsible && !expanded;

  // 접힌 동안에는 잘려서 안 보이는 조각을 아예 렌더하지 않는다.
  //
  // loading="lazy"만으로는 막지 못한다: overflow-hidden은 시각적으로만 자를 뿐
  // 레이아웃 흐름에는 그대로 남아, 브라우저가 "뷰포트 근처"로 판정해 전부 받는다.
  // 실측(상품 8909282005)에서 접힌 화면인데도 이미지 68장 143MB를 받았고,
  // 그중 한 장이 94MB였다. 렌더 자체를 막는 것이 유일하게 확실한 방법이다.
  //
  // 2장을 남기는 이유: 첫 장만 두면 접힌 높이(600px)를 못 채워 그라데이션이
  // 허공에 뜨고, 잘린 느낌이 사라져 더보기 버튼의 근거가 약해진다.
  const COLLAPSED_VISIBLE = 2;
  const rendered = collapsed ? valid.slice(0, COLLAPSED_VISIBLE) : valid;

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-bold">상세 설명</h2>

      {/* 본문(max-w-5xl)보다 좁게 가운데 정렬한다 — 상세 이미지는 대개 700~860px 로
          제작돼, 본문 폭을 꽉 채우면 원본보다 확대돼 흐려진다.
          mx-auto 는 여기(경계)에만 준다. 안쪽 이미지는 w-full 로 이 폭을 따른다. */}
      <div className="relative mx-auto w-full max-w-2xl">
        <div
          className="overflow-hidden"
          style={collapsed ? { maxHeight: COLLAPSED_HEIGHT } : undefined}
        >
          {/* ProductImage(공용 카드용)를 쓰지 않는다 — 실패 대체 화면이 size-full 이라
              높이를 주는 부모가 없는 이 세로 나열에서는 0px 로 찌그러진다.
              여기 이미지는 비율이 제각각이라 부모에 높이를 고정할 수도 없다.

              block: img 는 기본 inline 이라 조각 사이에 여백이 생겨 이어진 그림이 끊겨 보인다.
              첫 조각만 eager 인 이유: 펼친 직후 화면에 남아 있는 것이 그 조각이라
              lazy 로 두면 이미 보이는 자리가 비어 보인다. */}
          {rendered.map((src, i) => (
            /* eslint-disable-next-line @next/next/no-img-element -- long detail slices use native lazy loading and runtime fallback without next/image constraints */
            <img
              key={src}
              src={src}
              // 이어진 한 장이라 조각마다 이름을 읽히면 소음이 된다.
              // 첫 조각만 이름을 주고 나머지는 장식으로 둔다.
              alt={i === 0 ? `${alt} 상세 설명` : ""}
              loading={i === 0 ? "eager" : "lazy"}
              // 실패해도 자리를 남기지 않는다 — 깨진 아이콘이 줄줄이 뜨는 것보다 낫다.
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
              // 로드 전 높이가 0이면 조각들이 한 점에 겹쳐 전부 뷰포트 안으로
              // 판정돼 lazy가 무력해진다(펼친 직후 66장이 동시에 뜨던 원인).
              // 비율을 모르니 최소 높이만 잡아 서로 밀어내게 한다 — 로드되면
              // 실제 높이가 이 값을 덮는다.
              style={i === 0 ? undefined : { minHeight: 400 }}
              className="block w-full"
            />
          ))}
        </div>

        {/* 접힌 상태에서 아래가 잘렸음을 알리는 그라데이션.
            없으면 이미지가 원래 거기서 끝나는 것처럼 보인다. */}
        {collapsed && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-background to-transparent"
          />
        )}
      </div>

      {collapsible && (
        <Button
          variant="outline"
          onClick={() => setExpanded((v) => !v)}
          // 이미지가 아니라 위아래 형제 섹션(상품 정보 표·리뷰)의 폭에 맞춘다.
          // 이미지는 원본 해상도 때문에 max-w-2xl로 좁혀 둔 예외라, 거기 맞추면
          // 버튼만 안쪽으로 들어가 세로 정렬선이 끊긴다.
          className="h-11 w-full gap-1.5"
        >
          {expanded ? "상세 설명 접기" : "상세 설명 더보기"}
          {/* 펼치면 화살표를 뒤집어 접힌다는 것을 보인다. 아이콘 2개를 번갈아 쓰지 않고
              회전시키는 건 AppHeader와 같은 방식 — 상태 전환이 이어져 보인다. */}
          <ChevronDown
            aria-hidden
            className={`size-4 transition-transform ${expanded ? "rotate-180" : ""}`}
          />
        </Button>
      )}
    </section>
  );
}
