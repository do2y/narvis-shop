const IMG = (seed: string) => `https://picsum.photos/seed/${seed}/600/600`;

export const PLACEHOLDER_DETAIL = {
  // 갤러리 추가 이미지 — 계약 전이라 비워둠(메인 시딩 이미지 1장만 표시).
  // 상세 API에 images[]가 들어오면 그때 채운다.
  images: [] as string[],

  // 옵션은 제품마다 축·개수가 달라 배열로. options[]를 map 렌더하므로 개수 무관.
  options: [
    { name: "컬러", values: ["아이보리", "네이비", "블랙"] },
    { name: "사이즈", values: ["XS", "S", "M", "L", "XL"] },
  ],

  specs: [
    { label: "소재", value: "폴리에스터 95%, 스판덱스 5%" },
    { label: "총장", value: "S 기준 115cm" },
    { label: "어깨너비", value: "S 기준 37cm" },
    { label: "가슴둘레", value: "S 기준 84cm" },
    { label: "세탁방법", value: "손세탁 권장, 드라이클리닝 가능" },
    { label: "원산지", value: "대한민국" },
  ],

  reviewDistribution: { 5: 892, 4: 251, 3: 98, 2: 29, 1: 14 } as Record<
    1 | 2 | 3 | 4 | 5,
    number
  >,

  reviews: [
    {
      author: "김지연",
      rating: 5,
      option: "S",
      date: "2025.06.12",
      content:
        "기념일 저녁 식사에 입고 갔는데 남자친구가 엄청 좋아했어요. 실루엣이 정말 예쁘고 소재도 고급스러워요. 사이즈는 평소와 동일하게 고르시면 됩니다.",
      helpful: 42,
    },
    {
      author: "박소현",
      rating: 5,
      option: "M",
      date: "2025.05.28",
      content:
        "호텔 레스토랑 예약이 있어서 고민하다 구매했는데 정말 만족해요. 너무 화려하지 않으면서 충분히 드레시한 느낌이라 딱이에요.",
      helpful: 31,
    },
    {
      author: "이라서",
      rating: 4,
      option: "S",
      date: "2025.05.15",
      content:
        "색상은 아이보리로 골랐고 사진과 거의 비슷해요. 벨트가 같이 포함되어 있어서 좋고 전체적으로 완성도 높은 옷이에요. 별 하나는 배송이 조금 느렸어요.",
      helpful: 19,
    },
    {
      author: "최수아",
      rating: 5,
      option: "L",
      date: "2025.04.30",
      content:
        "결혼기념일 저녁에 입었어요. 남편이 고급 레스토랑에 잘 어울린다고 해줬어요. 세탁도 간편하고 주름도 잘 안 생겨서 관리하기 편해요.",
      helpful: 28,
    },
  ],

  frequentlyBought: [
    {
      productId: 9001,
      name: "골드 미니 클러치백",
      brandName: "르블랑",
      price: 49000,
      imageUrl: IMG("fb-1"),
    },
    {
      productId: 9002,
      name: "스틸레토 앵클 스트랩 힐",
      brandName: "슈에드",
      price: 89000,
      imageUrl: IMG("fb-2"),
    },
    {
      productId: 9003,
      name: "펄 드롭 이어링",
      brandName: "아뜨리에",
      price: 28000,
      imageUrl: IMG("fb-3"),
    },
    {
      productId: 9004,
      name: "쉬어 메시 스타킹",
      brandName: "필로프트",
      price: 18000,
      imageUrl: IMG("fb-4"),
    },
  ],

  alternatives: [
    {
      productId: 9101,
      name: "플리츠 새틴 롱 원피스 EH2241",
      brandName: "에포모사",
      price: 145000,
      imageUrl: IMG("alt-1"),
      reason: "비슷한 우아한 분위기에 소재가 더 고급스러워요.",
    },
    {
      productId: 9102,
      name: "오프숄더 시폰 미디 드레스 LB-D221",
      brandName: "르블랑",
      price: 89000,
      imageUrl: IMG("alt-2"),
      reason: "조금 더 로맨틱한 분위기를 원하신다면요.",
    },
    {
      productId: 9103,
      name: "새틴 드레이프 원피스 NVOP3300",
      brandName: "라인에디션",
      price: 118000,
      imageUrl: IMG("alt-3"),
      reason: "광택 소재로 더 드레시한 느낌을 줄 수 있어요.",
    },
  ],
};
