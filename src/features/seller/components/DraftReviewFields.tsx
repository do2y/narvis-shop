import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProductImage } from "@/shared/ui/ProductImage";
import { numeric } from "../interaction";
import type { DraftPreview, SellerDraft } from "@/shared/types/chat";

/**
 * 등록 초안의 항목별 검토 본문 — 이미지 + 필드 표.
 *
 * preview(서버가 만든 표시 사본)가 있으면 그것을 그리고, 없으면 changes(실행 정본)로
 * 대체한다. preview 가 optional 인 계약이라 실제로 없는 턴이 있고, 그때 summary 한 줄만
 * 남으면 판매자는 무엇을 등록하는지 모르는 채 [등록]을 눌러야 한다.
 *
 * 다만 둘은 급이 다르다 — changes 는 categoryId 만 있고 경로로 바꿀 트리가 FE 에 없다.
 * 그래서 대체 경로는 "덜 친절하지만 검토는 된다" 수준을 목표로 하고, 변환이 불가능한
 * 항목은 지어내지 않고 그대로 둔다(계약: 없는 필드를 FE 가 만들지 않는다).
 */

/** field(camelCase) → 화면 라벨. ProductDiffCard 와 같은 어휘를 쓴다 */
const FIELD_LABEL: Record<string, string> = {
  name: "상품명",
  price: "판매가",
  originalPrice: "정상가",
  description: "상품 설명",
  category: "카테고리",
  imageUrl: "이미지",
  status: "판매 상태",
  stockQuantity: "재고",
};

/**
 * 금액·수량 표시 — changes 경로 전용(preview 는 서버가 포맷을 마쳤다).
 *
 * 타입은 `string | number` 지만 **실측은 문자열이다**(계약 §3.6: "수치도 문자열").
 * typeof v === "number" 로만 분기하면 실제 와이어에서 한 번도 타지 않아
 * 60000 원이 "60000" 으로 그대로 나온다. 숫자로 파싱해서 판정한다.
 */
function formatRaw(field: string, v: string | number): string {
  const raw = String(v);
  const n = Number(raw);
  // 숫자로 읽히지 않으면(빈 값·예상 밖 포맷) 손대지 않고 그대로 보여준다
  if (raw.trim() === "" || !Number.isFinite(n)) return raw;

  if (field === "price" || field === "originalPrice")
    return `${n.toLocaleString("ko-KR")}원`;
  if (field === "stockQuantity") return `${n.toLocaleString("ko-KR")}개`;
  return raw;
}

/**
 * 검토 한 줄 — 라벨(좁게·흐리게) + 값(넓게).
 * 좁은 화면에서는 위아래로 쌓아 값이 찌그러지지 않게 한다.
 */
function Field({
  label,
  children,
  emphasis = false,
  missing = false,
}: {
  label: string;
  children?: React.ReactNode;
  /** 등록 전 반드시 확인할 항목(가격·재고) — 값을 키워 먼저 읽히게 */
  emphasis?: boolean;
  missing?: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-0.5 py-3 sm:grid-cols-[7.5rem_minmax(0,1fr)] sm:gap-4 sm:py-3.5">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "min-w-0",
          emphasis ? "text-base font-semibold" : "text-sm",
          // 누락은 회색 본문이 아니라 경고다 — 등록 후에 알아채면 늦는다
          missing && "text-sm font-medium text-destructive",
        )}
      >
        {missing ? "미입력" : children}
      </dd>
    </div>
  );
}

/** 대표 이미지 — 없으면 빈칸이 아니라 "미등록"임을 말한다 */
function DraftImage({
  src,
  placeholder,
}: {
  src: string | null;
  placeholder: boolean;
}) {
  if (placeholder || !src) {
    return (
      <div className="flex size-28 shrink-0 flex-col items-center justify-center gap-1.5 rounded-sm border border-dashed bg-muted/40 text-muted-foreground">
        <ImageOff className="size-5" />
        <span className="text-xs font-medium">이미지 미등록</span>
      </div>
    );
  }
  return (
    <ProductImage
      src={src}
      alt=""
      className="size-28 shrink-0 rounded-sm bg-muted object-cover"
    />
  );
}

/** preview 기반 — 서버가 포맷을 마친 값들을 그대로 표시한다 */
export function PreviewFields({ preview }: { preview: DraftPreview }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start gap-4">
        <DraftImage
          src={preview.imageUrl}
          placeholder={preview.imagePlaceholder}
        />
        <div className="flex min-w-0 flex-col gap-1.5 pt-0.5">
          <p className="text-lg font-bold leading-tight">{preview.title}</p>
          <p className="text-sm text-muted-foreground">
            {preview.categoryPath}
          </p>
          {preview.summary && (
            <p className="text-sm leading-relaxed">{preview.summary}</p>
          )}
        </div>
      </div>

      {/* 테두리 카드 대신 구분선 표 — 항목 수가 적고 값이 짧아 칸을 나눌 이유가 없다 */}
      <dl className="flex flex-col divide-y border-y">
        <Field label="판매가" emphasis>
          <span className="flex flex-wrap items-baseline gap-x-2">
            {/* priceText·stockText 는 서버가 포맷을 마쳤다 — 콤마·단위를 다시 붙이지 않는다 */}
            <span className={numeric}>{preview.priceText}</span>
            {preview.originalPriceText && (
              <span
                className={cn(
                  "text-sm font-normal text-muted-foreground line-through",
                  numeric,
                )}
              >
                {preview.originalPriceText}
              </span>
            )}
            {/* 0% 는 할인이 아니다 — 배지를 숨긴다 */}
            {preview.discountRate > 0 && (
              <span
                className={cn(
                  "rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-bold text-destructive",
                  numeric,
                )}
              >
                {preview.discountRate}% 할인
              </span>
            )}
          </span>
        </Field>

        <Field label="재고" emphasis>
          <span className={numeric}>{preview.stockText}</span>
        </Field>

        <Field label="상품 설명" missing={!preview.description}>
          {preview.description && (
            <p className="whitespace-pre-wrap leading-relaxed text-muted-foreground">
              {preview.description}
            </p>
          )}
        </Field>
      </dl>
    </div>
  );
}

/**
 * changes 기반 — **현재 서버가 실제로 보내는 경로**.
 *
 * 계약 문서 §3.6(실측 페이로드)의 draft 필드는 draftId·op·productId·changes·summary
 * 5개뿐이다. preview 는 타입에 optional 로 선언돼 있을 뿐 아직 오지 않으므로,
 * 이쪽이 예외가 아니라 주 경로다.
 *
 * §3.6 이 정해 주는 것들:
 *  - `op:"create"` 는 `imageUrl` 이 **금지**다 → 등록 초안에 이미지는 원천적으로 없다.
 *    "이미지 미등록"은 오류가 아니라 정상 상태라 경고 톤을 쓰지 않는다.
 *  - `name`·`price`·`stockQuantity` 는 **필수**다(누락되면 draft 자체가 오지 않고
 *    되묻기 token 이 온다) → 이 셋은 여기 도달한 시점에 이미 있다고 봐도 된다.
 *    그래도 미입력 표시를 남겨 둔다 — 계약이 바뀌어도 화면이 조용히 거짓말하지 않게.
 *  - 할인율·카테고리 경로는 만들 수 없다(AI 계산과 어긋날 수 있고, categoryId→경로
 *    트리가 FE 에 없다). 지어내지 않고 있는 값만 적는다.
 */
export function ChangesFields({ draft }: { draft: SellerDraft }) {
  const byField = new Map(draft.changes.map((c) => [c.field, c.after]));
  const name = byField.get("name");

  // 아래에서 따로 그리는 것들은 표에서 뺀다(중복 표시 방지):
  //  - name: 제목으로 이미 썼다
  //  - description: 긴 글이라 표 밖 마지막에 둔다
  //  - originalPrice: 판매가 옆에 취소선으로 붙인다 — 별도 행으로 떼면 두 금액의
  //    관계(정가→판매가)가 끊겨 어느 쪽이 실제 판매 금액인지 한 번 더 생각해야 한다
  //  - imageUrl: create 에서 금지 필드라 오지 않지만, 방어적으로 함께 거른다
  const rows = draft.changes.filter(
    (c) =>
      !["imageUrl", "name", "description", "originalPrice"].includes(
        String(c.field),
      ),
  );
  const description = byField.get("description");
  const originalPrice = byField.get("originalPrice");

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        {name ? (
          <p className="text-lg font-bold leading-tight">{String(name)}</p>
        ) : (
          <p className="text-sm font-medium text-destructive">상품명 미입력</p>
        )}
        {/* 요약은 서버가 준 한 줄 — 항목 표가 못 담는 맥락("~로 등록")을 남긴다 */}
        <p className="text-sm text-muted-foreground">{draft.summary}</p>
      </div>

      {/* 이미지는 등록 초안에 올 수 없다(§3.6 금지 필드) — 자리를 비워 두는 대신
          "등록 후 추가"임을 한 줄로 알린다. 큰 회색 사각형을 띄우면 "빠졌다"로 읽혀
          없는 문제를 만든다 */}
      <p className="flex items-center gap-2 rounded-sm bg-muted/50 px-3 py-2.5 text-sm text-muted-foreground">
        <ImageOff className="size-4 shrink-0" />
        대표 이미지는 등록 후 상품 관리에서 추가할 수 있어요.
      </p>

      <dl className="flex flex-col divide-y border-y">
        {rows.map((c) => {
          const key = String(c.field);
          const emphasis = key === "price" || key === "stockQuantity";
          return (
            <Field key={key} label={FIELD_LABEL[key] ?? key} emphasis={emphasis}>
              <span className="flex flex-wrap items-baseline gap-x-2">
                <span className={emphasis ? numeric : undefined}>
                  {formatRaw(key, c.after)}
                </span>
                {/* 정가는 판매가 옆에 취소선으로 — 할인율(%)은 계산하지 않는다.
                    FE 가 계산하면 AI 가 아는 값과 어긋나는 날이 온다(chat.ts §DraftPreview).
                    두 금액을 나란히 두면 판매자는 차이를 스스로 읽는다 */}
                {key === "price" && originalPrice && (
                  <span
                    className={cn(
                      "text-sm font-normal text-muted-foreground line-through",
                      numeric,
                    )}
                  >
                    {formatRaw("originalPrice", originalPrice)}
                  </span>
                )}
              </span>
            </Field>
          );
        })}
        <Field label="상품 설명" missing={!description}>
          {description && (
            <p className="whitespace-pre-wrap leading-relaxed text-muted-foreground">
              {String(description)}
            </p>
          )}
        </Field>
      </dl>
    </div>
  );
}
