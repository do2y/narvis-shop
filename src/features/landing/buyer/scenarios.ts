/**
 * 소비자 데모 시나리오 — 예시 질문 3개와 각 질문의 진행 장면.
 *
 * ⚠️ **이것은 목 데이터다.** 랜딩은 로그인 없이 열리고 서버 호출도 하지 않는다.
 * 실제 응답을 흉내 내되 계약에 없는 필드를 지어내지 않는다 — 조건 칩은
 * `ConditionChip`(field·label)과 같은 모양이고, 카드는 `ProductCard`가 쓰는
 * 필드만 갖는다(shared/types/chat.ts). 계약이 바뀌면 여기도 같이 바뀌어야
 * 화면이 실제 서비스와 어긋나지 않는다.
 *
 * 이미지: 외부 URL을 쓰지 않는다. 랜딩 히어로가 남의 서버 응답을 기다리게 되고
 * (LCP 저하), 그 서버가 죽으면 깨진 이미지가 남는다. `ProductImage`가 실패 시
 * 보여주는 대체 배경과 같은 톤의 정적 표현을 쓴다.
 */

/** 상품 카드 — 랜딩 표시에 필요한 것만. 실제 `ProductCard`의 부분집합이다. */
export interface DemoProduct {
  id: number;
  brandName: string;
  name: string;
  price: number;
  originalPrice: number;
  /** 추천 이유 — 요청 조건과 비교한 근거. 실제 응답의 `reason`과 같은 자리 */
  reason: string;
  /** 이미지 대체 표현. 실제 서비스는 상품 이미지를 쓴다 */
  tone: "sand" | "sage" | "slate" | "clay";
  /** 카테고리별로 결과가 나뉘는 것을 보여줄 때 쓰는 묶음 이름 */
  group?: string;
}

export interface DemoScenario {
  /** 예시 질문 버튼에 그대로 쓰인다 */
  question: string;
  /** 조건 분석 결과 — 순서대로 하나씩 붙는다 */
  chips: { field: string; label: string }[];
  /** AI 답변 도입부 */
  answer: string;
  products: DemoProduct[];
  /** 이어지는 요청("두 번째 담아줘")과 그 결과 */
  followUp: {
    /** 사용자의 후속 발화 */
    request: string;
    /** 담을 대상 — products의 인덱스 */
    targetIndex: number;
    /** 옵션 확인 단계에서 고르는 값. 없으면 옵션 없는 상품 */
    option?: string;
    /** 담기 완료 문구 — 실제로는 서버가 조립한 action.message를 그대로 쓴다 */
    doneMessage: string;
  };
}

export const BUYER_SCENARIOS: readonly DemoScenario[] = [
  {
    question: "유럽 여행에 가져갈 기내 반입용 파우치 추천해줘",
    chips: [
      { field: "situation", label: "유럽여행" },
      { field: "constraint", label: "기내 반입" },
      { field: "attribute", label: "휴대성" },
    ],
    answer:
      "기내 반입 규정에 맞는 크기로 좁혀서 찾아봤어요. 액체류를 따로 담을 수 있는 구성 위주로 골랐습니다.",
    products: [
      {
        id: 1,
        brandName: "트래블로그",
        name: "기내반입 트래블 파우치 3종 세트",
        price: 28900,
        originalPrice: 39000,
        reason: "100ml 용기 규격에 맞는 투명 파우치가 포함돼 있어요",
        tone: "sand",
      },
      {
        id: 2,
        brandName: "모노플랜",
        name: "방수 세면도구 파우치 (행잉형)",
        price: 34000,
        originalPrice: 34000,
        reason: "걸이형이라 좁은 호텔 세면대에서도 펼쳐 쓸 수 있어요",
        tone: "sage",
      },
      {
        id: 3,
        brandName: "케이스뮤트",
        name: "전자기기 정리 파우치 미니",
        price: 19800,
        originalPrice: 25000,
        reason: "충전기·어댑터를 따로 담아 보안검색을 빠르게 통과해요",
        tone: "slate",
      },
    ],
    followUp: {
      request: "두 번째 상품 장바구니에 담아줘",
      targetIndex: 1,
      option: "차콜",
      doneMessage: "방수 세면도구 파우치 (행잉형) 차콜 1개를 장바구니에 담았어요.",
    },
  },
  {
    question: "20만 원 안에서 러닝 입문 장비를 맞춰줘",
    chips: [
      { field: "category", label: "러닝" },
      { field: "priceBand", label: "20만원 이하" },
      { field: "attribute", label: "입문자용" },
      { field: "preference", label: "가벼운 착용감" },
    ],
    answer:
      "예산 안에서 러닝화·상의·소품으로 나눠 구성했어요. 합계 19만 4천 원입니다.",
    products: [
      {
        id: 4,
        brandName: "런웨이브",
        name: "쿠셔닝 러닝화 GX-1",
        price: 119000,
        originalPrice: 149000,
        reason: "입문자 기준 쿠션이 두꺼워 무릎 부담이 적어요",
        tone: "slate",
        group: "러닝화",
      },
      {
        id: 5,
        brandName: "에어릿",
        name: "속건 러닝 반팔 티셔츠",
        price: 39000,
        originalPrice: 39000,
        reason: "말씀하신 가벼운 착용감에 맞는 65g 원단이에요",
        tone: "sage",
        group: "의류",
      },
      {
        id: 6,
        brandName: "스텝코어",
        name: "러닝 암밴드 · 스마트폰 거치",
        price: 16400,
        originalPrice: 22000,
        reason: "남은 예산에 맞춰 필수 소품만 담았어요",
        tone: "clay",
        group: "소품",
      },
    ],
    followUp: {
      request: "러닝화만 좀 더 저렴한 걸로 바꿔줘",
      targetIndex: 0,
      doneMessage: "예산 조건을 다시 맞춰 러닝화를 교체했어요.",
    },
  },
  {
    question: "아까 추천한 두 번째 상품 장바구니에 담아줘",
    chips: [
      { field: "reference", label: "이전 추천 2번" },
      { field: "action", label: "장바구니 담기" },
    ],
    answer:
      "직전에 보여드린 목록의 두 번째 상품이 맞는지 확인해 주세요. 옵션이 있어 선택이 필요해요.",
    products: [
      {
        id: 2,
        brandName: "모노플랜",
        name: "방수 세면도구 파우치 (행잉형)",
        price: 34000,
        originalPrice: 34000,
        reason: "이전 대화에서 두 번째로 추천한 상품이에요",
        tone: "sage",
      },
    ],
    followUp: {
      request: "차콜로 담아줘",
      targetIndex: 0,
      option: "차콜",
      doneMessage: "방수 세면도구 파우치 (행잉형) 차콜 1개를 장바구니에 담았어요.",
    },
  },
] as const;

/** 이미지 자리의 톤 — 상품 이미지가 없을 때의 대체 배경(실제 서비스는 사진을 쓴다) */
export const TONE_CLASS: Record<DemoProduct["tone"], string> = {
  sand: "bg-[#EFE7DA]",
  sage: "bg-[#DFE8DF]",
  slate: "bg-[#DEE3EA]",
  clay: "bg-[#EDE0DC]",
};
